'use server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getLocalAtivoId } from '@/lib/local'
import { addDias, hojeBrasil } from '@/lib/formatos'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

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
  valor_pago_agora: z.number().min(0).optional(),
  forma_pagamento_parcial: z.enum(['dinheiro', 'pix', 'cartao_debito', 'cartao_credito']).optional(),
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
  if (parsed.data.forma_pagamento === 'fiado' && !parsed.data.cliente_id) {
    return { error: 'Selecione um cliente para venda fiado' }
  }
  if (parsed.data.tipo_fulfillment === 'entrega' && !parsed.data.entregador_id) {
    return { error: 'Escolha quem vai entregar' }
  }
  const valorPagoAgora = parsed.data.forma_pagamento === 'fiado' ? (parsed.data.valor_pago_agora ?? 0) : 0
  if (valorPagoAgora > 0 && !parsed.data.forma_pagamento_parcial) {
    return { error: 'Escolha em qual forma o valor pago agora entrou' }
  }

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
  if (valorPagoAgora > total) {
    return { error: 'Valor pago agora não pode ser maior que o total da venda' }
  }

  // Limite de credito: fiado so passa se (divida aberta + esta venda) couber
  // no limite do cliente. Limite 0/nulo = sem trava (comportamento de hoje).
  if (forma_pagamento === 'fiado' && parsed.data.cliente_id) {
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
      if (divida + total > limite) {
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
  const prazoDias = forma_pagamento === 'fiado' ? (parsed.data.prazo_dias ?? 7) : 0
  const dataVencimento = forma_pagamento === 'fiado' ? addDias(hoje, prazoDias) : hoje

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
      valor_pago_agora: valorPagoAgora,
      forma_pagamento_parcial: valorPagoAgora > 0 ? parsed.data.forma_pagamento_parcial : null,
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

  if (forma_pagamento === 'fiado') {
    const restante = +(total - valorPagoAgora).toFixed(2)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: errReceber } = await (serviceClient.from('contas_receber') as any).insert({
      pedido_id: venda.id,
      cliente_id: parsed.data.cliente_id,
      descricao: `Venda #${String(venda.numero_pedido).padStart(4, '0')}`,
      valor: total,
      valor_pago: valorPagoAgora,
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
      numero_pedido, data_pedido, total, subtotal, desconto_total, frete, valor_recebido, forma_pagamento, prazo_pagamento_dias, observacoes, valor_pago_agora, forma_pagamento_parcial,
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
