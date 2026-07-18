'use server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getLocalAtivoId } from '@/lib/local'
import { getCargoUsuario } from '@/lib/permissoes'
import { addDias, hojeBrasil } from '@/lib/formatos'
import { podeEditarPedido } from '@/lib/pedido-labels'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ItemPedido, FormaVenda } from '@/types'

export type { UsuarioComCargo } from '@/lib/actions/cargos'

const ItemSchema = z.object({
  produto_id: z.string().uuid(),
  quantidade: z.number().positive(),
  preco_unitario: z.number().positive(),
  total: z.number().positive(),
  // Forma de venda escolhida (Unidade, Fardo 12...). Opcional: venda antiga
  // ou sem forma cadastrada continua funcionando, so nao mostra o rotulo.
  embalagem_nome: z.string().optional(),
  embalagem_unidades: z.number().min(1).optional(),
})

const VendaSchema = z.object({
  // Cliente opcional: venda de balcao pode nao ter cliente identificado.
  // Fiado exige cliente (validado abaixo, pois depende de outro campo).
  cliente_id: z.string().uuid().nullable().optional(),
  forma_pagamento: z.enum(['dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'fiado']),
  prazo_dias: z.number().int().min(1).max(180).optional(),
  observacoes: z.string().optional(),
  canal: z.enum(['telefone', 'whatsapp', 'balcao']).default('balcao'),
  itens: z.array(ItemSchema).min(1, 'Adicione pelo menos 1 item'),
  tipo_fulfillment: z.enum(['balcao', 'entrega', 'retirada']).default('balcao'),
  entregador_id: z.string().uuid().nullable().optional(),
  frete: z.number().min(0).default(0),
  pago: z.boolean().optional(),
  // Desconto em R$ sobre a mercadoria (nao sobre o frete). Valida contra o
  // subtotal mais abaixo (depende dos itens).
  desconto: z.number().min(0).default(0),
  // Quanto o cliente entregou em dinheiro (pro cupom mostrar o troco).
  valor_recebido: z.number().min(0).optional(),
  // Fiado parcial: quanto ja entrou na hora (numa forma a vista) e em qual
  // forma. So faz sentido quando forma_pagamento = 'fiado'; validado abaixo
  // porque depende de outro campo do mesmo objeto.
  // Pagamento dividido em 2 formas (generalizado na Task 2 — por enquanto
  // so faz sentido quando forma_pagamento = 'fiado', igual antes).
  valor_secundario: z.number().min(0).optional(),
  forma_pagamento_secundaria: z.enum(['dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'fiado']).optional(),
  // Endereco de entrega em texto livre (sub-projeto 3, ja incluido aqui
  // porque e o mesmo objeto de payload).
  endereco_entrega: z
    .object({
      rua: z.string().optional(),
      numero: z.string().optional(),
      bairro: z.string().optional(),
      cidade: z.string().optional(),
    })
    .optional(),
})

// Registra uma SAIDA (venda): baixa estoque atomico e gera comprovante.
// Fiado gera uma linha em contas_receber com vencimento = hoje + prazo_dias.
export async function registrarVenda(data: unknown) {
  const parsed = VendaSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nao autenticado' }

  const localId = await getLocalAtivoId()
  const serviceClient = await createServiceClient()
  const { itens, forma_pagamento, tipo_fulfillment, frete, desconto } = parsed.data
  const subtotal = itens.reduce((acc, i) => acc + i.total, 0)
  if (desconto > subtotal) {
    return { error: 'Desconto maior que o valor da mercadoria.' }
  }
  const total = +(subtotal + frete - desconto).toFixed(2)

  const formaSecundaria = parsed.data.forma_pagamento_secundaria ?? null
  const valorSecundario = formaSecundaria ? (parsed.data.valor_secundario ?? 0) : 0
  if (formaSecundaria) {
    if (formaSecundaria === forma_pagamento) {
      return { error: 'As duas formas de pagamento precisam ser diferentes' }
    }
    if (valorSecundario <= 0) {
      return { error: 'Informe o valor da segunda forma de pagamento' }
    }
    if (valorSecundario >= total) {
      return { error: 'O valor da segunda forma não pode ser maior ou igual ao total da venda' }
    }
  }

  const pernaFiado =
    forma_pagamento === 'fiado'
      ? { valor: total - valorSecundario }
      : formaSecundaria === 'fiado'
        ? { valor: valorSecundario }
        : null
  if (pernaFiado && !parsed.data.cliente_id) {
    return { error: 'Selecione um cliente para venda fiado' }
  }

  // Limite de credito: fiado so passa se (divida aberta + esta venda) couber
  // no limite do cliente. Limite 0/nulo = sem trava (comportamento de hoje).
  if (pernaFiado && parsed.data.cliente_id) {
    const { data: cli } = await serviceClient
      .from('clientes')
      .select('nome, limite_credito')
      .eq('id', parsed.data.cliente_id)
      .single()
    const limite = Number((cli as { limite_credito?: number } | null)?.limite_credito ?? 0)
    if (limite > 0) {
      const { data: abertas } = await serviceClient
        .from('contas_receber')
        .select('valor, valor_pago')
        .eq('cliente_id', parsed.data.cliente_id)
        .eq('status', 'aberto')
      const divida = ((abertas ?? []) as { valor: number; valor_pago: number }[])
        .reduce((a, c) => a + Number(c.valor ?? 0) - Number(c.valor_pago ?? 0), 0)
      if (divida + pernaFiado.valor > limite) {
        const nome = (cli as { nome?: string } | null)?.nome ?? 'Cliente'
        return {
          error: `Fiado recusado: ${nome} já deve R$ ${divida.toFixed(2).replace('.', ',')} e o limite é R$ ${limite.toFixed(2).replace('.', ',')}. Receba o que está aberto ou aumente o limite no cadastro.`,
        }
      }
    }
  }
  const pago = tipo_fulfillment === 'balcao' ? true : (parsed.data.pago ?? false)
  const concluidoEm = tipo_fulfillment === 'balcao' ? new Date().toISOString() : null
  const hoje = hojeBrasil()
  const prazoDias = pernaFiado ? (parsed.data.prazo_dias ?? 7) : 0
  const dataVencimento = pernaFiado ? addDias(hoje, prazoDias) : hoje

  // Valida o estoque de TODOS os itens antes de criar a venda: não deixa o
  // saldo ficar negativo (vender mais do que tem deixaria o estoque mentindo).
  for (const item of itens) {
    const { data: est } = await serviceClient
      .from('estoque')
      .select('saldo_atual, produtos(nome)')
      .eq('produto_id', item.produto_id)
      .single()
    const saldo = (est as { saldo_atual: number } | null)?.saldo_atual ?? 0
    if (saldo < item.quantidade) {
      const rel = (est as { produtos: { nome: string } | { nome: string }[] | null } | null)?.produtos
      const nome = (Array.isArray(rel) ? rel[0] : rel)?.nome ?? 'produto'
      return {
        error: `Estoque insuficiente de ${nome}: tem ${saldo}, e a venda pede ${item.quantidade}.`,
      }
    }
  }

  const { data: vendaRaw, error: errVenda } = await (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    serviceClient.from('pedidos') as any
  )
    .insert({
      cliente_id: parsed.data.cliente_id ?? null,
      atendente_id: user.id,
      local_id: localId,
      status: 'concluida',
      forma_pagamento,
      prazo_pagamento_dias: prazoDias,
      data_vencimento: dataVencimento,
      observacoes: parsed.data.observacoes || null,
      canal: parsed.data.canal,
      tipo_fulfillment,
      entregador_id: tipo_fulfillment === 'entrega' ? parsed.data.entregador_id : null,
      frete,
      pago,
      concluido_em: concluidoEm,
      subtotal,
      desconto_total: desconto,
      valor_recebido:
        forma_pagamento === 'dinheiro' && parsed.data.valor_recebido != null && parsed.data.valor_recebido > 0
          ? parsed.data.valor_recebido
          : null,
      valor_secundario: formaSecundaria ? valorSecundario : 0,
      forma_pagamento_secundaria: formaSecundaria,
      endereco_entrega:
        tipo_fulfillment === 'entrega' && !parsed.data.cliente_id && parsed.data.endereco_entrega
          ? parsed.data.endereco_entrega
          : null,
      total,
    })
    .select('id, numero_pedido')
    .single()

  const venda = vendaRaw as { id: string; numero_pedido: number } | null
  if (errVenda || !venda) return { error: errVenda?.message ?? 'Erro ao registrar venda' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: errItens } = await (serviceClient.from('pedido_itens') as any).insert(
    itens.map(i => ({
      pedido_id: venda.id,
      produto_id: i.produto_id,
      quantidade_pedida: i.quantidade,
      preco_unitario: i.preco_unitario,
      total: i.total,
      embalagem_nome: i.embalagem_nome ?? null,
      embalagem_unidades: i.embalagem_unidades ?? null,
    }))
  )
  if (errItens) return { error: errItens.message }

  if (pernaFiado) {
    const restante = +pernaFiado.valor.toFixed(2)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: errReceber } = await (serviceClient.from('contas_receber') as any).insert({
      pedido_id: venda.id,
      cliente_id: parsed.data.cliente_id,
      descricao: `Venda #${String(venda.numero_pedido).padStart(4, '0')}`,
      valor: restante,
      valor_pago: 0,
      status: restante <= 0 ? 'pago' : 'aberto',
      data_emissao: hoje,
      data_pagamento: restante <= 0 ? hoje : null,
      data_vencimento: dataVencimento,
      forma_pagamento: 'fiado',
    })
    if (errReceber) return { error: errReceber.message }
  }

  // ajustar_estoque() trava a linha (SELECT ... FOR UPDATE) antes de ler e
  // escrever: fecha a corrida que o padrao antigo (ler saldo, calcular em
  // JS, escrever) tinha entre vendas concorrentes do mesmo produto.
  for (const item of itens) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ajusteRaw, error: errAjuste } = await (serviceClient as any).rpc('ajustar_estoque', {
      p_produto_id: item.produto_id,
      p_delta: -item.quantidade,
    })
    if (errAjuste) {
      // Pode acontecer mesmo com a pre-checagem acima (corrida entre a
      // checagem e a baixa de verdade): venda ja foi criada, mas esse item
      // nao pode ser baixado. Erro explicito em vez de deixar o saldo
      // mentir.
      return { error: `Falha ao baixar estoque: ${errAjuste.message}` }
    }
    const ajuste = (ajusteRaw as { saldo_novo: number; custo_medio: number }[] | null)?.[0]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (serviceClient.from('movimentacoes_estoque') as any).insert({
      produto_id: item.produto_id,
      tipo: 'saida_venda',
      quantidade: -item.quantidade,
      custo_unitario: ajuste?.custo_medio ?? 0,
      saldo_apos: ajuste?.saldo_novo ?? 0,
      referencia_tipo: 'pedido',
      referencia_id: venda.id,
      usuario_id: user.id,
    })
  }

  revalidatePath('/movimentacoes')
  revalidatePath('/estoque')
  revalidatePath('/dashboard')
  revalidatePath('/financeiro')
  revalidatePath('/financeiro/a-receber')

  return { success: true, pedidoId: venda.id, numeroPedido: venda.numero_pedido }
}

export async function buscarPedidoParaCupom(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('pedidos')
    .select(`
      numero_pedido, data_pedido, total, subtotal, desconto_total, frete, valor_recebido, forma_pagamento, prazo_pagamento_dias, observacoes, valor_secundario, forma_pagamento_secundaria,
      locais(nome),
      clientes(nome, telefone, endereco),
      pedido_itens(quantidade_pedida, preco_unitario, total, embalagem_nome, embalagem_unidades, produtos(nome, embalagem))
    `)
    .eq('id', id)
    .single()
  return data
}

// Cancela/estorna uma venda concluida: devolve os itens ao estoque, registra
// movimentacao de devolucao por item e marca o pedido como 'cancelada'.
export async function cancelarVenda(pedidoId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nao autenticado' }

  const serviceClient = await createServiceClient()

  const { data: pedidoRaw, error: errPedido } = await serviceClient
    .from('pedidos')
    .select('id, status')
    .eq('id', pedidoId)
    .single()

  const pedido = pedidoRaw as { id: string; status: string } | null
  if (errPedido || !pedido) return { error: errPedido?.message ?? 'Venda nao encontrada' }
  if (pedido.status === 'cancelada') return { error: 'Venda já cancelada' }
  if (pedido.status !== 'concluida') return { error: 'Só é possível cancelar vendas concluídas' }

  const { data: itensRaw, error: errItens } = await serviceClient
    .from('pedido_itens')
    .select('produto_id, quantidade_pedida')
    .eq('pedido_id', pedidoId)
  if (errItens) return { error: errItens.message }

  const itens = (itensRaw ?? []) as { produto_id: string; quantidade_pedida: number }[]

  for (const item of itens) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ajusteRaw, error: errAjuste } = await (serviceClient as any).rpc('ajustar_estoque', {
      p_produto_id: item.produto_id,
      p_delta: item.quantidade_pedida,
    })
    if (errAjuste) return { error: `Falha ao devolver estoque: ${errAjuste.message}` }
    const ajuste = (ajusteRaw as { saldo_novo: number; custo_medio: number }[] | null)?.[0]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (serviceClient.from('movimentacoes_estoque') as any).insert({
      produto_id: item.produto_id,
      tipo: 'devolucao_cliente',
      quantidade: item.quantidade_pedida,
      custo_unitario: ajuste?.custo_medio ?? 0,
      saldo_apos: ajuste?.saldo_novo ?? 0,
      referencia_tipo: 'pedido',
      referencia_id: pedidoId,
      usuario_id: user.id,
      observacao: 'Cancelamento da venda',
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: errStatus } = await (serviceClient.from('pedidos') as any)
    .update({ status: 'cancelada', updated_at: new Date().toISOString() })
    .eq('id', pedidoId)
  if (errStatus) return { error: errStatus.message }

  // Se era fiado, cancela a conta a receber junto (a nao ser que ja tenha sido paga).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: errReceber } = await (serviceClient.from('contas_receber') as any)
    .update({ status: 'cancelado' })
    .eq('pedido_id', pedidoId)
    .neq('status', 'pago')
  // Venda ja foi cancelada e estoque ja voltou (idempotente: proxima chamada
  // cai no "Venda já cancelada" acima), entao um erro aqui vira aviso, nao
  // reverte o que ja foi feito -- mas o usuario precisa saber que a conta a
  // receber pode ter ficado aberta.
  if (errReceber) {
    return { error: `Venda cancelada, mas a conta a receber vinculada não pôde ser atualizada: ${errReceber.message}` }
  }

  revalidatePath('/movimentacoes')
  revalidatePath('/estoque')
  revalidatePath('/dashboard')
  revalidatePath('/financeiro')
  revalidatePath('/financeiro/a-receber')
  revalidatePath(`/pedidos/${pedidoId}`)

  return { success: true }
}

export async function listarVendas() {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select(`id, numero_pedido, status, total, data_pedido, forma_pagamento, clientes(nome, telefone)`)
    .eq('local_id', localId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return data ?? []
}

// Pedidos de entrega/retirada ainda nao confirmados como
// entregues/retirados, do local ativo. Mesmo criterio dos filtros
// "Aguardando entrega/retirada" em /movimentacoes, somado.
export async function contarPedidosPendentes(): Promise<number> {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('pedidos')
    .select('id', { count: 'exact', head: true })
    .eq('local_id', localId)
    .eq('status', 'concluida')
    .in('tipo_fulfillment', ['entrega', 'retirada'])
    .is('concluido_em', null)
  if (error) throw error
  return count ?? 0
}

// Confirma que o pagamento da entrega/retirada foi recebido. Independente
// da conclusão (pode confirmar pagamento antes ou depois de entregar).
export async function marcarPagoPedido(pedidoId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nao autenticado' }

  const serviceClient = await createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (serviceClient.from('pedidos') as any)
    .update({ pago: true, updated_at: new Date().toISOString() })
    .eq('id', pedidoId)
  if (error) return { error: error.message }

  revalidatePath(`/pedidos/${pedidoId}`)
  revalidatePath('/movimentacoes')
  revalidatePath('/pedidos')
  return { success: true as const }
}

// Confirma que a entrega/retirada aconteceu.
export async function marcarConcluidoPedido(pedidoId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nao autenticado' }

  const serviceClient = await createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (serviceClient.from('pedidos') as any)
    .update({ concluido_em: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', pedidoId)
  if (error) return { error: error.message }

  revalidatePath(`/pedidos/${pedidoId}`)
  revalidatePath('/movimentacoes')
  revalidatePath('/pedidos')
  return { success: true as const }
}

// Marca que o entregador saiu para a entrega (so tipo_fulfillment
// 'entrega' -- retirada nao tem trajeto). Junto com concluido_em da
// pra calcular quanto tempo a entrega levou.
export async function marcarSaiuEntregaPedido(pedidoId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nao autenticado' }

  const serviceClient = await createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error, count } = await (serviceClient.from('pedidos') as any)
    .update({ saiu_entrega_em: new Date().toISOString() }, { count: 'exact' })
    .eq('id', pedidoId)
    .eq('tipo_fulfillment', 'entrega')
  if (error) return { error: error.message }
  if (count === 0) return { error: 'Pedido não encontrado ou não é uma entrega.' }

  revalidatePath(`/pedidos/${pedidoId}`)
  revalidatePath('/pedidos')
  return { success: true as const }
}

// Aba "Em andamento" de /pedidos: mesmo criterio que ja usava
// contarPedidosPendentes(), agora retornando as linhas tambem.
export async function listarPedidosEmAndamento() {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select(
      'id, numero_pedido, tipo_fulfillment, data_pedido, saiu_entrega_em, clientes(nome), entregador:profiles!pedidos_entregador_id_fkey(nome)',
    )
    .eq('local_id', localId)
    .eq('status', 'concluida')
    .in('tipo_fulfillment', ['entrega', 'retirada'])
    .is('concluido_em', null)
    .order('data_pedido', { ascending: false })
  if (error) throw error
  return data ?? []
}

// Tela do Entregador: entregas designadas ao usuario logado, ainda nao
// confirmadas. So entrega (retirada nao tem trajeto), do local dele. Traz
// o que ele precisa pra rodar: cliente + telefone + endereco + valor +
// forma de pagamento (pra saber se cobra na entrega).
export async function listarMinhasEntregas() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const localId = await getLocalAtivoId()
  const { data, error } = await supabase
    .from('pedidos')
    .select(
      'id, numero_pedido, total, forma_pagamento, pago, data_pedido, saiu_entrega_em, endereco_entrega, clientes(nome, telefone, endereco)',
    )
    .eq('local_id', localId)
    .eq('entregador_id', user.id)
    .eq('tipo_fulfillment', 'entrega')
    .eq('status', 'concluida')
    .is('concluido_em', null)
    .order('data_pedido', { ascending: false })
  if (error) throw error
  return data ?? []
}

// Aba "Concluidos" de /pedidos: historico operacional (quem entregou,
// quanto tempo levou) -- sem valor/pagamento, isso e papel do extrato
// em Movimentacoes.
export async function listarPedidosConcluidos() {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select(
      'id, numero_pedido, tipo_fulfillment, data_pedido, concluido_em, saiu_entrega_em, clientes(nome), entregador:profiles!pedidos_entregador_id_fkey(nome)',
    )
    .eq('local_id', localId)
    .eq('status', 'concluida')
    .not('concluido_em', 'is', null)
    .order('concluido_em', { ascending: false })
    .limit(200)
  if (error) throw error
  return data ?? []
}

// Entregador aceita uma entrega da fila (sem ninguem designado ainda).
// A trava de concorrencia mora na funcao SQL security definer.
export async function aceitarEntrega(pedidoId: string) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('aceitar_entrega', { p_pedido_id: pedidoId })
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { success: true }
}

// Entregas de "entrega" sem entregador ainda, do local ativo -- a fila que
// a tela do Entregador mostra pra aceitar. Mesmo shape de listarMinhasEntregas().
export async function listarEntregasDisponiveis() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const localId = await getLocalAtivoId()
  const { data, error } = await supabase
    .from('pedidos')
    .select(
      'id, numero_pedido, total, forma_pagamento, pago, data_pedido, saiu_entrega_em, endereco_entrega, clientes(nome, telefone, endereco)',
    )
    .eq('local_id', localId)
    .is('entregador_id', null)
    .eq('tipo_fulfillment', 'entrega')
    .eq('status', 'concluida')
    .is('concluido_em', null)
    .order('data_pedido', { ascending: false })
  if (error) throw error
  return data ?? []
}

// Escape manual: admin/funcionario atribui um entregador direto, sem
// passar pela fila (ex.: fila travada, entrega urgente). So funciona
// enquanto ninguem aceitou ainda (mesma defesa de corrida da funcao SQL).
export async function atribuirEntregadorManual(pedidoId: string, entregadorId: string) {
  const cargo = await getCargoUsuario()
  if (!cargo?.admin && cargo?.nome !== 'Funcionario') {
    return { error: 'Sem permissão' }
  }
  const s = await createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error, count } = await (s.from('pedidos') as any)
    .update({ entregador_id: entregadorId }, { count: 'exact' })
    .eq('id', pedidoId)
    .is('entregador_id', null)
  if (error) return { error: error.message }
  if (!count) return { error: 'Essa entrega já tem um entregador atribuído' }
  revalidatePath(`/pedidos/${pedidoId}`)
  return { success: true }
}

export async function caixaFechadoHoje(localId: string): Promise<boolean> {
  const supabase = await createClient()
  const hoje = hojeBrasil()
  const { data } = await supabase
    .from('caixa_fechamentos')
    .select('id')
    .eq('local_id', localId)
    .eq('data', hoje)
    .maybeSingle()
  return !!data
}

export async function buscarItensParaEditar(pedidoId: string): Promise<ItemPedido[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedido_itens')
    .select(
      'produto_id, quantidade_pedida, preco_unitario, total, embalagem_nome, embalagem_unidades, produtos(nome, categorias(nome), preco_venda_padrao, produto_embalagens(id, nome, unidades, preco, padrao), estoque(saldo_atual))',
    )
    .eq('pedido_id', pedidoId)
  if (error) throw error

  type Rel<T> = T | T[] | null
  const umaRel = <T,>(rel: Rel<T>): T | null => (Array.isArray(rel) ? (rel[0] ?? null) : rel)

  type ItemRaw = {
    produto_id: string
    quantidade_pedida: number
    preco_unitario: number
    total: number
    embalagem_nome: string | null
    embalagem_unidades: number | null
    produtos: {
      nome: string
      categorias: Rel<{ nome: string }>
      preco_venda_padrao: number
      produto_embalagens: FormaVenda[] | null
      estoque: Rel<{ saldo_atual: number }>
    } | null
  }

  return ((data ?? []) as unknown as ItemRaw[]).map((item): ItemPedido => {
    const produto = item.produtos
    const formasCadastradas =
      produto?.produto_embalagens && produto.produto_embalagens.length > 0
        ? [...produto.produto_embalagens].sort(
            (a, b) => Number(b.padrao) - Number(a.padrao) || a.unidades - b.unidades,
          )
        : [
            {
              id: `fallback-${item.produto_id}`,
              nome: 'Unidade',
              unidades: 1,
              preco: produto?.preco_venda_padrao ?? item.preco_unitario,
              padrao: true,
            },
          ]

    const formaExistente = formasCadastradas.find(
      (f) => f.nome === item.embalagem_nome && f.unidades === (item.embalagem_unidades ?? 1),
    )
    const unidades = item.embalagem_unidades ?? 1
    const formas = formaExistente
      ? formasCadastradas
      : [
          ...formasCadastradas,
          {
            id: `custom-${item.produto_id}`,
            nome: item.embalagem_nome ?? 'Unidade',
            unidades,
            preco: +(item.preco_unitario * unidades).toFixed(2),
            padrao: false,
          },
        ]
    const formaId = formaExistente?.id ?? `custom-${item.produto_id}`

    return {
      produto_id: item.produto_id,
      nome: produto?.nome ?? 'Produto',
      categoria: umaRel(produto?.categorias ?? null)?.nome ?? '',
      preco_unitario: item.preco_unitario,
      quantidade: item.quantidade_pedida,
      total: item.total,
      saldo_atual: umaRel(produto?.estoque ?? null)?.saldo_atual ?? 0,
      formas,
      formaId,
      qtdFormas: item.quantidade_pedida / unidades,
      precoForma: +(item.preco_unitario * unidades).toFixed(2),
    }
  })
}

export async function editarVenda(
  pedidoId: string,
  itens: Array<{
    produto_id: string
    quantidade: number
    preco_unitario: number
    total: number
    embalagem_nome?: string
    embalagem_unidades?: number
  }>,
) {
  if (itens.length === 0) return { error: 'A venda precisa ter pelo menos 1 item' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const serviceClient = await createServiceClient()

  const { data: pedidoRaw, error: errPedido } = await serviceClient
    .from('pedidos')
    .select('id, local_id, status, data_pedido, concluido_em, tipo_fulfillment, frete, desconto_total, forma_pagamento')
    .eq('id', pedidoId)
    .single()
  type PedidoRow = {
    id: string
    local_id: string
    status: string
    data_pedido: string
    concluido_em: string | null
    tipo_fulfillment: string
    frete: number
    desconto_total: number
    forma_pagamento: string
  }
  const pedido = pedidoRaw as PedidoRow | null
  if (errPedido || !pedido) return { error: errPedido?.message ?? 'Venda não encontrada' }

  const fechado = await caixaFechadoHoje(pedido.local_id)
  if (!podeEditarPedido(pedido, fechado)) {
    return { error: 'Essa venda não pode mais ser editada (fora do dia, caixa fechado ou já concluída)' }
  }

  const { data: itensAntigosRaw, error: errItensAntigos } = await serviceClient
    .from('pedido_itens')
    .select('produto_id, quantidade_pedida')
    .eq('pedido_id', pedidoId)
  if (errItensAntigos) return { error: errItensAntigos.message }
  const itensAntigos = (itensAntigosRaw ?? []) as { produto_id: string; quantidade_pedida: number }[]

  const qtdAntiga = new Map<string, number>()
  for (const i of itensAntigos) qtdAntiga.set(i.produto_id, i.quantidade_pedida)
  const qtdNova = new Map<string, number>()
  for (const i of itens) qtdNova.set(i.produto_id, (qtdNova.get(i.produto_id) ?? 0) + i.quantidade)

  const produtoIds = new Set([...qtdAntiga.keys(), ...qtdNova.keys()])
  const deltas = new Map<string, number>()
  for (const produtoId of produtoIds) {
    const delta = (qtdNova.get(produtoId) ?? 0) - (qtdAntiga.get(produtoId) ?? 0)
    if (delta !== 0) deltas.set(produtoId, delta)
  }

  // Pre-checagem de estoque: todo produto que precisa de MAIS unidades
  // (delta > 0) tem que ter saldo suficiente antes de mexer em qualquer coisa.
  for (const [produtoId, delta] of deltas) {
    if (delta <= 0) continue
    const { data: est } = await serviceClient
      .from('estoque')
      .select('saldo_atual, produtos(nome)')
      .eq('produto_id', produtoId)
      .single()
    const saldo = (est as { saldo_atual: number } | null)?.saldo_atual ?? 0
    if (saldo < delta) {
      const rel = (est as { produtos: { nome: string } | { nome: string }[] | null } | null)?.produtos
      const nome = (Array.isArray(rel) ? rel[0] : rel)?.nome ?? 'produto'
      return { error: `Estoque insuficiente de ${nome}: tem ${saldo}, precisa de mais ${delta}.` }
    }
  }

  for (const [produtoId, delta] of deltas) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ajusteRaw, error: errAjuste } = await (serviceClient as any).rpc('ajustar_estoque', {
      p_produto_id: produtoId,
      p_delta: -delta,
    })
    if (errAjuste) return { error: `Falha ao ajustar estoque: ${errAjuste.message}` }
    const ajuste = (ajusteRaw as { saldo_novo: number; custo_medio: number }[] | null)?.[0]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (serviceClient.from('movimentacoes_estoque') as any).insert({
      produto_id: produtoId,
      tipo: delta > 0 ? 'saida_venda' : 'devolucao_cliente',
      quantidade: -delta,
      custo_unitario: ajuste?.custo_medio ?? 0,
      saldo_apos: ajuste?.saldo_novo ?? 0,
      referencia_tipo: 'pedido',
      referencia_id: pedidoId,
      usuario_id: user.id,
      observacao: 'Edição da venda',
    })
  }

  await serviceClient.from('pedido_itens').delete().eq('pedido_id', pedidoId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: errInsert } = await (serviceClient.from('pedido_itens') as any).insert(
    itens.map((i) => ({
      pedido_id: pedidoId,
      produto_id: i.produto_id,
      quantidade_pedida: i.quantidade,
      preco_unitario: i.preco_unitario,
      total: i.total,
      embalagem_nome: i.embalagem_nome ?? null,
      embalagem_unidades: i.embalagem_unidades ?? null,
    })),
  )
  if (errInsert) return { error: errInsert.message }

  const subtotal = +itens.reduce((acc, i) => acc + i.total, 0).toFixed(2)
  const novoTotal = +(subtotal + pedido.frete - pedido.desconto_total).toFixed(2)

  if (pedido.forma_pagamento === 'fiado') {
    const { data: contaRaw } = await serviceClient
      .from('contas_receber')
      .select('id, valor_pago')
      .eq('pedido_id', pedidoId)
      .maybeSingle()
    const conta = contaRaw as { id: string; valor_pago: number } | null
    if (conta) {
      if (novoTotal < conta.valor_pago) {
        return {
          error: `Não é possível reduzir o total abaixo do que já foi pago (R$ ${conta.valor_pago.toFixed(2).replace('.', ',')})`,
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (serviceClient.from('contas_receber') as any)
        .update({
          valor: novoTotal,
          status: conta.valor_pago >= novoTotal ? 'pago' : 'aberto',
        })
        .eq('id', conta.id)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: errTotal } = await (serviceClient.from('pedidos') as any)
    .update({ subtotal, total: novoTotal })
    .eq('id', pedidoId)
  if (errTotal) return { error: errTotal.message }

  revalidatePath(`/pedidos/${pedidoId}`)
  revalidatePath('/pedidos')
  revalidatePath('/dashboard')
  return { success: true as const }
}

export type PedidoRecente = {
  id: string
  numero_pedido: number
  status: string
  total: number
  data_pedido: string
  concluido_em: string | null
  tipo_fulfillment: string
  cliente_nome: string | null
}

export async function listarPedidosRecentes(limite = 5): Promise<PedidoRecente[]> {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, numero_pedido, status, total, data_pedido, concluido_em, tipo_fulfillment, clientes(nome)')
    .eq('local_id', localId)
    .order('data_pedido', { ascending: false })
    .limit(limite)
  if (error) throw error

  type Rel<T> = T | T[] | null
  const umaRel = <T,>(rel: Rel<T>): T | null => (Array.isArray(rel) ? (rel[0] ?? null) : rel)
  type Raw = Omit<PedidoRecente, 'cliente_nome'> & { clientes: Rel<{ nome: string }> }

  return ((data ?? []) as unknown as Raw[]).map((p) => ({
    ...p,
    cliente_nome: umaRel(p.clientes)?.nome ?? null,
  }))
}
