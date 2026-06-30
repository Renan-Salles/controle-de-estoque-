'use server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getLocalAtivoId } from '@/lib/local'
import { addDias } from '@/lib/formatos'
import { revalidatePath } from 'next/cache'

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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const localId = await getLocalAtivoId()
  const serviceClient = await createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (serviceClient.from('contas_pagar') as any).insert({ ...data, local_id: localId })
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

// Helper: primeiro dia do mês corrente em ISO date (YYYY-MM-01).
function inicioMesAtual() {
  const agora = new Date()
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-01`
}

// Resultado do mês (DRE simplificada) do local ativo.
// receita      = soma de pedidos.total (concluida, mês, local)
// custoVendas  = soma de |quantidade| * custo_unitario das movimentacoes
//                'saida_venda' do mês (join produtos!inner.local_id)
// despesas     = soma de contas_pagar.valor emitidas no mês (local); informamos
//                também quanto já foi pago (valor_pago).
// lucroBruto   = receita - custoVendas ; lucroLiquido = lucroBruto - despesas.
export async function buscarResultadoMes(_periodo: 'mes' = 'mes') {
  void _periodo
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const inicioMes = inicioMesAtual()

  const [
    { data: pedidosRaw, error: errPedidos },
    { data: movRaw, error: errMov },
    { data: pagarRaw, error: errPagar },
  ] = await Promise.all([
    supabase
      .from('pedidos')
      .select('total')
      .eq('status', 'concluida')
      .eq('local_id', localId)
      .gte('data_pedido', `${inicioMes}T00:00:00`),
    // movimentacoes_estoque não tem local_id: filtra pelo local do produto.
    // Inclui devolucao_cliente (estorno de cancelamento) para abater o custo das
    // vendas que foram canceladas — senão o custo conta vendas que nem valeram.
    supabase
      .from('movimentacoes_estoque')
      .select('tipo, quantidade, custo_unitario, produtos!inner(local_id)')
      .in('tipo', ['saida_venda', 'devolucao_cliente'])
      .eq('produtos.local_id', localId)
      .gte('created_at', `${inicioMes}T00:00:00`),
    supabase
      .from('contas_pagar')
      .select('valor, valor_pago')
      .eq('local_id', localId)
      .gte('data_emissao', inicioMes),
  ])

  if (errPedidos) throw errPedidos
  if (errMov) throw errMov
  if (errPagar) throw errPagar

  const pedidos = (pedidosRaw ?? []) as { total: number | string | null }[]
  const movimentacoes = (movRaw ?? []) as {
    tipo: string
    quantidade: number | string | null
    custo_unitario: number | string | null
  }[]
  const contas = (pagarRaw ?? []) as {
    valor: number | string | null
    valor_pago: number | string | null
  }[]

  // Valores de sum()/agregação chegam STRING via PostgREST: sempre Number().
  const receita = pedidos.reduce((a, p) => a + Number(p.total ?? 0), 0)
  const quantidadeVendas = pedidos.length
  const ticketMedio = quantidadeVendas > 0 ? receita / quantidadeVendas : 0

  const custoVendas = movimentacoes.reduce((a, m) => {
    const custo = Math.abs(Number(m.quantidade ?? 0)) * Number(m.custo_unitario ?? 0)
    // saída soma custo; devolução (venda cancelada) abate o mesmo custo.
    return m.tipo === 'devolucao_cliente' ? a - custo : a + custo
  }, 0)

  const despesas = contas.reduce((a, c) => a + Number(c.valor ?? 0), 0)
  const despesasPagas = contas.reduce((a, c) => a + Number(c.valor_pago ?? 0), 0)

  const lucroBruto = receita - custoVendas
  const lucroLiquido = lucroBruto - despesas

  const margemBruta = receita > 0 ? lucroBruto / receita : 0
  const margemLiquida = receita > 0 ? lucroLiquido / receita : 0

  return {
    receita,
    custoVendas,
    despesas,
    despesasPagas,
    lucroBruto,
    lucroLiquido,
    margemBruta,
    margemLiquida,
    quantidadeVendas,
    ticketMedio,
  }
}

// Fechamento de caixa do DIA de hoje, do local: total por forma de pagamento e
// total geral + contagem de vendas. Espelha buscarFormasPagamento, mas só hoje.
export async function buscarCaixaDia() {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()

  const agora = new Date()
  const hoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('pedidos')
    .select('forma_pagamento, total')
    .eq('status', 'concluida')
    .eq('local_id', localId)
    .gte('data_pedido', `${hoje}T00:00:00`)
    .lte('data_pedido', `${hoje}T23:59:59.999`)

  if (error) throw error

  const rows = (data ?? []) as { forma_pagamento: string; total: number | string | null }[]
  const formas = ['dinheiro', 'pix', 'cartao_debito', 'cartao_credito'] as const
  const resumo = formas.map((f) => {
    const dela = rows.filter((r) => r.forma_pagamento === f)
    const valor = dela.reduce((a, r) => a + Number(r.total ?? 0), 0)
    return { forma: f, valor, quantidade: dela.length }
  })
  const totalGeral = resumo.reduce((a, r) => a + r.valor, 0)
  const totalVendas = rows.length

  return { resumo, totalGeral, totalVendas, data: hoje }
}

// Resumo de contas a pagar do mês (do local ativo).
// Para o lado do fiado/contas a receber, ver buscarResumoFiado() abaixo.
export async function buscarResumoFinanceiro() {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const inicioMes = inicioMesAtual()

  const { data: pagar } = await supabase
    .from('contas_pagar')
    .select('valor, valor_pago')
    .eq('local_id', localId)
    .gte('data_emissao', inicioMes)

  const contas = (pagar ?? []) as { valor: number | string | null; valor_pago: number | string | null }[]
  // numeric chega string via PostgREST: sempre Number().
  const totalPagar = contas.reduce((a, c) => a + Number(c.valor ?? 0), 0)
  const totalPago = contas.reduce((a, c) => a + Number(c.valor_pago ?? 0), 0)

  return { totalPagar, totalPago }
}

// Lista os fiados (contas_receber) do local ativo, com dados do cliente.
// contas_receber nao tem local_id direto: filtra via pedidos!inner(local_id).
export async function buscarContasReceber(status?: string) {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  let query = supabase
    .from('contas_receber')
    .select(
      'id, pedido_id, descricao, valor, valor_pago, status, data_emissao, data_vencimento, clientes(nome, telefone), pedidos!inner(numero_pedido, local_id)',
    )
    .eq('pedidos.local_id', localId)
    .order('data_vencimento')
  if (status && status !== 'todas') query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

// Marca um fiado como recebido: baixa o valor integral e fecha a conta.
export async function marcarContaReceberPaga(id: string) {
  const supabase = await createClient()
  const { data: contaRaw } = await supabase
    .from('contas_receber')
    .select('valor')
    .eq('id', id)
    .single()
  const conta = contaRaw as { valor: number } | null
  if (!conta) return { error: 'Conta não encontrada' }

  const hoje = new Date().toISOString().split('T')[0]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('contas_receber') as any)
    .update({ status: 'pago', valor_pago: conta.valor, data_pagamento: hoje })
    .eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/financeiro/a-receber')
  revalidatePath('/dashboard')
  return { success: true }
}

// Resumo do fiado em aberto: total a receber, quanto vence nos proximos 3 dias
// e quanto ja venceu. Alimenta o banner do dashboard e os KPIs de a-receber.
export async function buscarResumoFiado() {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const hoje = new Date().toISOString().split('T')[0]
  const em3dias = addDias(hoje, 3)

  const { data } = await supabase
    .from('contas_receber')
    .select('valor, valor_pago, data_vencimento, pedidos!inner(local_id)')
    .eq('pedidos.local_id', localId)
    .in('status', ['aberto', 'parcial'])

  const rows = (data ?? []) as {
    valor: number | string
    valor_pago: number | string
    data_vencimento: string
  }[]
  const abertas = rows.map((r) => ({
    data_vencimento: r.data_vencimento,
    saldo: Number(r.valor) - Number(r.valor_pago),
  }))
  const vencidas = abertas.filter((r) => r.data_vencimento < hoje)
  const vencendo = abertas.filter((r) => r.data_vencimento >= hoje && r.data_vencimento <= em3dias)

  return {
    totalAberto: abertas.reduce((a, r) => a + r.saldo, 0),
    qtdVencidas: vencidas.length,
    totalVencido: vencidas.reduce((a, r) => a + r.saldo, 0),
    qtdVencendo: vencendo.length,
    totalVencendo: vencendo.reduce((a, r) => a + r.saldo, 0),
  }
}
