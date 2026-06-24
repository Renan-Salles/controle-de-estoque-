'use server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function buscarPosicaoEstoque(filtro?: 'todos' | 'critico' | 'ruptura') {
  const supabase = await createClient()
  let query = supabase.from('v_posicao_estoque').select('*').order('categoria').order('nome')

  if (filtro === 'critico') query = query.in('status_estoque', ['critico', 'ruptura'])
  if (filtro === 'ruptura') query = query.eq('status_estoque', 'ruptura')

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function darEntrada(data: {
  produto_id: string
  quantidade: number
  custo_unitario: number
  observacao?: string
}) {
  if (!data.produto_id || data.quantidade <= 0) return { error: 'Dados invalidos' }

  const serviceClient = await createServiceClient()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nao autenticado' }

  const { data: estoqueAtual } = await serviceClient
    .from('estoque')
    .select('saldo_atual, custo_medio')
    .eq('produto_id', data.produto_id)
    .single()

  const saldoAtual = estoqueAtual?.saldo_atual ?? 0
  const custoMedioAtual = estoqueAtual?.custo_medio ?? 0
  const novoSaldo = saldoAtual + data.quantidade

  const novoCustoMedio = saldoAtual > 0
    ? ((saldoAtual * custoMedioAtual) + (data.quantidade * data.custo_unitario)) / novoSaldo
    : data.custo_unitario

  await serviceClient.from('estoque').update({
    saldo_atual: novoSaldo,
    custo_medio: novoCustoMedio,
    updated_at: new Date().toISOString(),
  }).eq('produto_id', data.produto_id)

  await serviceClient.from('movimentacoes_estoque').insert({
    produto_id: data.produto_id,
    tipo: 'entrada_compra',
    quantidade: data.quantidade,
    custo_unitario: data.custo_unitario,
    saldo_apos: novoSaldo,
    usuario_id: user.id,
    observacao: data.observacao,
  })

  revalidatePath('/estoque')
  return { success: true }
}

export async function buscarMovimentacoes(produtoId?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('movimentacoes_estoque')
    .select('*, produtos(nome)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (produtoId) query = query.eq('produto_id', produtoId)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}
