'use server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getLocalAtivoId } from '@/lib/local'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const ItemSchema = z.object({
  produto_id: z.string().uuid(),
  quantidade: z.number().positive(),
  preco_unitario: z.number().positive(),
  total: z.number().positive(),
})

const VendaSchema = z.object({
  // Cliente opcional: venda de balcao pode nao ter cliente identificado.
  cliente_id: z.string().uuid().nullable().optional(),
  forma_pagamento: z.enum(['dinheiro', 'pix', 'cartao_debito', 'cartao_credito']),
  observacoes: z.string().optional(),
  canal: z.enum(['telefone', 'whatsapp', 'balcao']).default('balcao'),
  itens: z.array(ItemSchema).min(1, 'Adicione pelo menos 1 item'),
})

// Registra uma SAIDA (venda) a vista: baixa estoque atomico e gera comprovante.
// Sem fiado, sem ciclo de status de entrega, sem conta a receber.
export async function registrarVenda(data: unknown) {
  const parsed = VendaSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nao autenticado' }

  const localId = await getLocalAtivoId()
  const serviceClient = await createServiceClient()
  const { itens, forma_pagamento } = parsed.data
  const total = itens.reduce((acc, i) => acc + i.total, 0)
  const hoje = new Date().toISOString().split('T')[0]

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
      prazo_pagamento_dias: 0,
      data_vencimento: hoje,
      observacoes: parsed.data.observacoes || null,
      canal: parsed.data.canal,
      subtotal: total,
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
    }))
  )
  if (errItens) return { error: errItens.message }

  for (const item of itens) {
    const { data: estoqueAtual } = await serviceClient
      .from('estoque')
      .select('saldo_atual, custo_medio')
      .eq('produto_id', item.produto_id)
      .single()

    const saldoAtual = (estoqueAtual as { saldo_atual: number } | null)?.saldo_atual ?? 0
    const custoMedio = (estoqueAtual as { custo_medio: number } | null)?.custo_medio ?? 0
    const novoSaldo = saldoAtual - item.quantidade

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (serviceClient.from('estoque') as any).update({
      saldo_atual: novoSaldo,
      updated_at: new Date().toISOString(),
    }).eq('produto_id', item.produto_id)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (serviceClient.from('movimentacoes_estoque') as any).insert({
      produto_id: item.produto_id,
      tipo: 'saida_venda',
      quantidade: -item.quantidade,
      custo_unitario: custoMedio,
      saldo_apos: novoSaldo,
      referencia_tipo: 'pedido',
      referencia_id: venda.id,
      usuario_id: user.id,
    })
  }

  revalidatePath('/movimentacoes')
  revalidatePath('/estoque')
  revalidatePath('/dashboard')
  revalidatePath('/financeiro')

  return { success: true, pedidoId: venda.id, numeroPedido: venda.numero_pedido }
}

export async function buscarPedidoParaCupom(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('pedidos')
    .select(`
      numero_pedido, data_pedido, total, forma_pagamento, prazo_pagamento_dias, observacoes,
      locais(nome),
      clientes(nome, telefone, endereco),
      pedido_itens(quantidade_pedida, preco_unitario, total, produtos(nome, embalagem))
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
    const { data: estoqueAtual } = await serviceClient
      .from('estoque')
      .select('saldo_atual, custo_medio')
      .eq('produto_id', item.produto_id)
      .single()

    const saldoAtual = (estoqueAtual as { saldo_atual: number } | null)?.saldo_atual ?? 0
    const custoMedio = (estoqueAtual as { custo_medio: number } | null)?.custo_medio ?? 0
    const novoSaldo = saldoAtual + item.quantidade_pedida

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (serviceClient.from('estoque') as any).update({
      saldo_atual: novoSaldo,
      updated_at: new Date().toISOString(),
    }).eq('produto_id', item.produto_id)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (serviceClient.from('movimentacoes_estoque') as any).insert({
      produto_id: item.produto_id,
      tipo: 'devolucao_cliente',
      quantidade: item.quantidade_pedida,
      custo_unitario: custoMedio,
      saldo_apos: novoSaldo,
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

  revalidatePath('/movimentacoes')
  revalidatePath('/estoque')
  revalidatePath('/dashboard')
  revalidatePath('/financeiro')
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
