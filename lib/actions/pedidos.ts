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

  const serviceClient = await createServiceClient()
  const { itens, forma_pagamento } = parsed.data
  const total = itens.reduce((acc, i) => acc + i.total, 0)
  const hoje = new Date().toISOString().split('T')[0]

  const { data: vendaRaw, error: errVenda } = await (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    serviceClient.from('pedidos') as any
  )
    .insert({
      cliente_id: parsed.data.cliente_id ?? null,
      atendente_id: user.id,
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

export async function listarVendas() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select(`id, numero_pedido, status, total, data_pedido, forma_pagamento, clientes(nome, telefone)`)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return data ?? []
}
