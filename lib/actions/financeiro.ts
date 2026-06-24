'use server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getLocalAtivoId } from '@/lib/local'
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
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  let query = supabase
    .from('contas_pagar')
    .select('*')
    .eq('local_id', localId)
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
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from('contas_pagar').insert({ ...data, local_id: localId } as any)
  if (error) return { error: error.message }
  revalidatePath('/financeiro')
  return { success: true }
}

// Recebimentos por forma de pagamento (todas as vendas sao a vista).
// Mostra quanto entrou em cada forma e quais o cliente mais usa.
export async function buscarFormasPagamento(periodo: 'mes' | 'tudo' = 'mes') {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  let query = supabase
    .from('pedidos')
    .select('forma_pagamento, total, data_pedido')
    .eq('status', 'concluida')
    .eq('local_id', localId)

  if (periodo === 'mes') {
    const inicioMes = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`
    query = query.gte('data_pedido', `${inicioMes}T00:00:00`)
  }

  const { data, error } = await query
  if (error) throw error

  const rows = (data ?? []) as { forma_pagamento: string; total: number }[]
  const formas = ['dinheiro', 'pix', 'cartao_debito', 'cartao_credito'] as const
  const resumo = formas.map((f) => {
    const dela = rows.filter((r) => r.forma_pagamento === f)
    const valor = dela.reduce((a, r) => a + Number(r.total ?? 0), 0)
    return { forma: f, valor, quantidade: dela.length }
  })
  const totalGeral = resumo.reduce((a, r) => a + r.valor, 0)
  const totalVendas = rows.length

  return {
    resumo: resumo.map((r) => ({
      ...r,
      pct: totalGeral > 0 ? (r.valor / totalGeral) * 100 : 0,
    })),
    totalGeral,
    totalVendas,
  }
}

export async function buscarResumoFinanceiro() {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const inicioMes = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`

  const [{ data: receber }, { data: pagar }] = await Promise.all([
    supabase.from('contas_receber').select('valor, valor_pago, status').gte('data_emissao', inicioMes),
    supabase.from('contas_pagar').select('valor, valor_pago, status').eq('local_id', localId).gte('data_emissao', inicioMes),
  ])

  const totalReceber = (receber ?? []).reduce((a, c) => a + c.valor, 0)
  const totalRecebido = (receber ?? []).reduce((a, c) => a + (c.valor_pago ?? 0), 0)
  const totalPagar = (pagar ?? []).reduce((a, c) => a + c.valor, 0)
  const totalPago = (pagar ?? []).reduce((a, c) => a + (c.valor_pago ?? 0), 0)
  const inadimplente = (receber ?? []).filter(c => c.status === 'vencido').reduce((a, c) => a + (c.valor - (c.valor_pago ?? 0)), 0)

  return { totalReceber, totalRecebido, totalPagar, totalPago, inadimplente, lucroEstimado: totalRecebido - totalPago }
}
