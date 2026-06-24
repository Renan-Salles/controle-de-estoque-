'use server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function registrarPagamento(contaId: string, valor: number, formaPagamento: string) {
  const serviceClient = await createServiceClient()
  const { data: conta } = await serviceClient.from('contas_receber').select('*').eq('id', contaId).single()
  if (!conta) return { error: 'Conta nao encontrada' }

  const totalPago = (conta.valor_pago ?? 0) + valor
  const novoStatus = totalPago >= conta.valor ? 'pago' : 'parcial'

  const { error } = await serviceClient.from('contas_receber').update({
    valor_pago: totalPago,
    status: novoStatus,
    data_pagamento: novoStatus === 'pago' ? new Date().toISOString().split('T')[0] : null,
    forma_pagamento: formaPagamento,
  }).eq('id', contaId)

  if (error) return { error: error.message }
  revalidatePath('/financeiro/a-receber')
  return { success: true }
}

export async function buscarContasReceber(status?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('contas_receber')
    .select('*, clientes(nome, telefone)')
    .order('data_vencimento')
  if (status && status !== 'todas') query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function buscarContasPagar(status?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('contas_pagar')
    .select('*')
    .order('data_vencimento')
  if (status && status !== 'todas') query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function criarContaPagar(data: {
  categoria: string
  descricao: string
  valor: number
  data_vencimento: string
  observacoes?: string
}) {
  const supabase = await createClient()
  const { error } = await supabase.from('contas_pagar').insert(data)
  if (error) return { error: error.message }
  revalidatePath('/financeiro')
  return { success: true }
}

export async function buscarResumoFinanceiro() {
  const supabase = await createClient()
  const inicioMes = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`

  const [{ data: receber }, { data: pagar }] = await Promise.all([
    supabase.from('contas_receber').select('valor, valor_pago, status').gte('data_emissao', inicioMes),
    supabase.from('contas_pagar').select('valor, valor_pago, status').gte('data_emissao', inicioMes),
  ])

  const totalReceber = (receber ?? []).reduce((a, c) => a + c.valor, 0)
  const totalRecebido = (receber ?? []).reduce((a, c) => a + (c.valor_pago ?? 0), 0)
  const totalPagar = (pagar ?? []).reduce((a, c) => a + c.valor, 0)
  const totalPago = (pagar ?? []).reduce((a, c) => a + (c.valor_pago ?? 0), 0)
  const inadimplente = (receber ?? []).filter(c => c.status === 'vencido').reduce((a, c) => a + (c.valor - (c.valor_pago ?? 0)), 0)

  return { totalReceber, totalRecebido, totalPagar, totalPago, inadimplente, lucroEstimado: totalRecebido - totalPago }
}
