'use server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const EntradaItemSchema = z.object({
  produto_id: z.string().uuid(),
  quantidade: z.number().positive(),
  custo_unitario: z.number().min(0),
})

const EntradaSchema = z.object({
  fornecedor_nome: z.string().optional(),
  observacoes: z.string().optional(),
  itens: z.array(EntradaItemSchema).min(1, 'Adicione pelo menos 1 item'),
})

// Registra uma ENTRADA (compra de estoque): aumenta saldo e recalcula custo medio
// ponderado de cada item. Agrupa os itens por um id de lote.
export async function registrarEntrada(data: unknown) {
  const parsed = EntradaSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nao autenticado' }

  const service = await createServiceClient()
  const lote = crypto.randomUUID()
  const obs = parsed.data.fornecedor_nome
    ? `Compra: ${parsed.data.fornecedor_nome}`
    : parsed.data.observacoes || 'Compra de mercadoria'

  for (const item of parsed.data.itens) {
    const { data: est } = await service
      .from('estoque')
      .select('saldo_atual, custo_medio')
      .eq('produto_id', item.produto_id)
      .single()

    const saldo = (est as { saldo_atual: number } | null)?.saldo_atual ?? 0
    const custoMedioAtual = (est as { custo_medio: number } | null)?.custo_medio ?? 0
    const novoSaldo = saldo + item.quantidade
    const novoCusto = saldo > 0
      ? (saldo * custoMedioAtual + item.quantidade * item.custo_unitario) / novoSaldo
      : item.custo_unitario

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service.from('estoque') as any).update({
      saldo_atual: novoSaldo,
      custo_medio: novoCusto,
      updated_at: new Date().toISOString(),
    }).eq('produto_id', item.produto_id)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service.from('movimentacoes_estoque') as any).insert({
      produto_id: item.produto_id,
      tipo: 'entrada_compra',
      quantidade: item.quantidade,
      custo_unitario: item.custo_unitario,
      saldo_apos: novoSaldo,
      referencia_tipo: 'entrada',
      referencia_id: lote,
      usuario_id: user.id,
      observacao: obs,
    })
  }

  revalidatePath('/movimentacoes')
  revalidatePath('/estoque')
  revalidatePath('/dashboard')
  return { success: true }
}

// Histórico unificado: vendas (saidas) + entradas (compras de estoque).
export async function listarMovimentacoes() {
  const supabase = await createClient()
  const [{ data: vendas }, { data: entradas }] = await Promise.all([
    supabase
      .from('pedidos')
      .select('id, numero_pedido, total, data_pedido, forma_pagamento, status, clientes(nome)')
      .order('data_pedido', { ascending: false })
      .limit(150),
    supabase
      .from('movimentacoes_estoque')
      .select('id, quantidade, custo_unitario, created_at, observacao, produtos(nome)')
      .eq('tipo', 'entrada_compra')
      .order('created_at', { ascending: false })
      .limit(150),
  ])
  return { vendas: vendas ?? [], entradas: entradas ?? [] }
}
