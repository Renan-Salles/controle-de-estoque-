'use server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const ItemSchema = z.object({
  produto_id: z.string().uuid(),
  quantidade: z.number().positive(),
  preco_unitario: z.number().positive(),
  total: z.number().positive(),
})

const PedidoSchema = z.object({
  cliente_id: z.string().uuid(),
  forma_pagamento: z.enum(['dinheiro', 'pix', 'fiado', 'cartao_debito', 'cartao_credito', 'boleto']),
  prazo_pagamento_dias: z.number().default(0),
  data_entrega_prevista: z.string().optional(),
  observacoes: z.string().optional(),
  canal: z.enum(['telefone', 'whatsapp', 'balcao']).default('telefone'),
  itens: z.array(ItemSchema).min(1, 'Adicione pelo menos 1 item'),
})

export async function confirmarPedido(data: unknown) {
  const parsed = PedidoSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nao autenticado' }

  const serviceClient = await createServiceClient()
  const { itens, forma_pagamento, prazo_pagamento_dias } = parsed.data

  const total = itens.reduce((acc, i) => acc + i.total, 0)
  const data_vencimento = prazo_pagamento_dias > 0
    ? new Date(Date.now() + prazo_pagamento_dias * 86400000).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0]

  const { data: novoPedido, error: errPedido } = await serviceClient
    .from('pedidos')
    .insert({
      cliente_id: parsed.data.cliente_id,
      atendente_id: user.id,
      status: 'confirmado',
      forma_pagamento,
      prazo_pagamento_dias,
      data_vencimento,
      data_entrega_prevista: parsed.data.data_entrega_prevista || null,
      observacoes: parsed.data.observacoes || null,
      canal: parsed.data.canal,
      subtotal: total,
      total,
    })
    .select('id, numero_pedido')
    .single()

  if (errPedido || !novoPedido) return { error: errPedido?.message ?? 'Erro ao criar pedido' }

  const { error: errItens } = await serviceClient.from('pedido_itens').insert(
    itens.map(i => ({
      pedido_id: novoPedido.id,
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

    const novoSaldo = (estoqueAtual?.saldo_atual ?? 0) - item.quantidade

    await serviceClient.from('estoque').update({
      saldo_atual: novoSaldo,
      updated_at: new Date().toISOString(),
    }).eq('produto_id', item.produto_id)

    await serviceClient.from('movimentacoes_estoque').insert({
      produto_id: item.produto_id,
      tipo: 'saida_venda',
      quantidade: -item.quantidade,
      custo_unitario: estoqueAtual?.custo_medio ?? 0,
      saldo_apos: novoSaldo,
      referencia_tipo: 'pedido',
      referencia_id: novoPedido.id,
      usuario_id: user.id,
    })
  }

  if (forma_pagamento !== 'dinheiro') {
    await serviceClient.from('contas_receber').insert({
      pedido_id: novoPedido.id,
      cliente_id: parsed.data.cliente_id,
      descricao: `Pedido #${novoPedido.numero_pedido}`,
      valor: total,
      data_vencimento,
    })
  }

  revalidatePath('/pedidos')
  revalidatePath('/estoque')
  revalidatePath('/dashboard')

  return { success: true, pedidoId: novoPedido.id, numeroPedido: novoPedido.numero_pedido }
}

export async function listarPedidos(filtros?: { status?: string }) {
  const supabase = await createClient()
  let query = supabase
    .from('pedidos')
    .select(`id, numero_pedido, status, total, data_pedido, forma_pagamento, observacoes, clientes(nome, telefone)`)
    .order('created_at', { ascending: false })

  if (filtros?.status) query = query.eq('status', filtros.status)
  const { data, error } = await query.limit(100)
  if (error) throw error
  return data ?? []
}

export async function atualizarStatusPedido(pedidoId: string, status: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('pedidos').update({ status }).eq('id', pedidoId)
  if (error) return { error: error.message }
  revalidatePath('/pedidos')
  return { success: true }
}
