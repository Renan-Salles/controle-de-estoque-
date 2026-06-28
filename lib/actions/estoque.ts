'use server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getLocalAtivoId } from '@/lib/local'
import { revalidatePath } from 'next/cache'

export async function buscarPosicaoEstoque(filtro?: 'todos' | 'critico' | 'ruptura') {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  let query = supabase.from('v_posicao_estoque').select('*').eq('local_id', localId).order('categoria').order('nome')

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

  const atual = estoqueAtual as { saldo_atual: number; custo_medio: number } | null
  const saldoAtual = atual?.saldo_atual ?? 0
  const custoMedioAtual = atual?.custo_medio ?? 0
  const novoSaldo = saldoAtual + data.quantidade

  const novoCustoMedio = saldoAtual > 0
    ? ((saldoAtual * custoMedioAtual) + (data.quantidade * data.custo_unitario)) / novoSaldo
    : data.custo_unitario

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (serviceClient.from('estoque') as any).update({
    saldo_atual: novoSaldo,
    custo_medio: novoCustoMedio,
    updated_at: new Date().toISOString(),
  }).eq('produto_id', data.produto_id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (serviceClient.from('movimentacoes_estoque') as any).insert({
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

type TipoAjuste = 'perda' | 'quebra' | 'vencimento' | 'cortesia' | 'acerto'

const TIPOS_AJUSTE: TipoAjuste[] = [
  'perda',
  'quebra',
  'vencimento',
  'cortesia',
  'acerto',
]

const ROTULO_AJUSTE: Record<TipoAjuste, string> = {
  perda: 'Perda',
  quebra: 'Quebra',
  vencimento: 'Vencido',
  cortesia: 'Cortesia',
  acerto: 'Acerto de inventário',
}

// Ajuste de estoque manual: perda/quebra/vencimento/cortesia (saída) ou
// acerto de inventário (define o saldo correto). Lança a movimentação e
// atualiza o saldo. Não recalcula custo médio (saída/correção usa o atual).
export async function ajustarEstoque(data: {
  produto_id: string
  tipo: TipoAjuste
  quantidade: number
  observacao?: string
}) {
  if (!data.produto_id) return { error: 'Produto inválido' }
  if (!TIPOS_AJUSTE.includes(data.tipo)) return { error: 'Tipo inválido' }
  if (!Number.isFinite(data.quantidade) || data.quantidade < 0)
    return { error: 'Quantidade inválida' }
  if (data.tipo !== 'acerto' && data.quantidade <= 0)
    return { error: 'Informe quanto saiu' }

  const serviceClient = await createServiceClient()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { data: estoqueAtual } = await serviceClient
    .from('estoque')
    .select('saldo_atual, custo_medio')
    .eq('produto_id', data.produto_id)
    .single()

  const atual = estoqueAtual as { saldo_atual: number; custo_medio: number } | null
  const saldoAtual = atual?.saldo_atual ?? 0
  const custoMedio = atual?.custo_medio ?? 0

  // Acerto: a quantidade é o NOVO saldo absoluto. Demais: quanto SAI.
  const delta =
    data.tipo === 'acerto'
      ? data.quantidade - saldoAtual
      : -data.quantidade

  if (delta === 0) return { error: 'Sem mudança no saldo' }

  // Saída maior que o disponível não é permitida (não deixa negativo).
  if (data.tipo !== 'acerto' && saldoAtual + delta < 0)
    return { error: `Saldo insuficiente (atual: ${saldoAtual})` }

  const novoSaldo = Math.max(0, saldoAtual + delta)

  const tipoMov =
    data.tipo === 'acerto' ? 'ajuste_inventario' : 'descarte'
  const obs = data.observacao
    ? `${ROTULO_AJUSTE[data.tipo]}: ${data.observacao}`
    : ROTULO_AJUSTE[data.tipo]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (serviceClient.from('estoque') as any)
    .update({
      saldo_atual: novoSaldo,
      updated_at: new Date().toISOString(),
    })
    .eq('produto_id', data.produto_id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (serviceClient.from('movimentacoes_estoque') as any).insert({
    produto_id: data.produto_id,
    tipo: tipoMov,
    quantidade: delta,
    custo_unitario: custoMedio,
    saldo_apos: novoSaldo,
    usuario_id: user.id,
    observacao: obs,
  })

  revalidatePath('/estoque')
  return { success: true, saldo: novoSaldo }
}

// Lista de reposição: produtos acabando, com sugestão de quanto comprar.
// "Acabando" = status alerta/critico/ruptura OU saldo <= max(mínimo, 12).
// Mesmo sem mínimo configurado, avisa quando saldo <= 12 (piso padrão).
// Sugestão de compra simples = max(mínimo*2, 24) − saldo (mínimo 0).
export async function buscarReposicao() {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('v_posicao_estoque')
    .select('*')
    .eq('local_id', localId)

  if (error) throw error

  const PISO = 12
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lista = (data ?? []) as any[]

  const acabando = lista
    .filter((p) => {
      const status = p.status_estoque as string
      const limiar = Math.max(p.estoque_minimo ?? 0, PISO)
      return (
        status === 'alerta' ||
        status === 'critico' ||
        status === 'ruptura' ||
        (p.saldo_atual ?? 0) <= limiar
      )
    })
    .map((p) => {
      const alvo = Math.max((p.estoque_minimo ?? 0) * 2, 24)
      const sugestao = Math.max(0, Math.round(alvo - (p.saldo_atual ?? 0)))
      return { ...p, sugestao_compra: sugestao }
    })
    .sort((a, b) => (a.saldo_atual ?? 0) - (b.saldo_atual ?? 0))

  return acabando
}

export async function buscarMovimentacoes(produtoId?: string) {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  let query = supabase
    .from('movimentacoes_estoque')
    .select('*, produtos!inner(nome, local_id)')
    .eq('produtos.local_id', localId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (produtoId) query = query.eq('produto_id', produtoId)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function buscarDescartes(limite = 50) {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('movimentacoes_estoque')
    .select('id, produto_id, quantidade, custo_unitario, observacao, created_at, produtos!inner(nome, local_id)')
    .eq('tipo', 'descarte')
    .eq('produtos.local_id', localId)
    .order('created_at', { ascending: false })
    .limit(limite)
  if (error) throw error
  return (data ?? []) as Array<{
    id: string
    produto_id: string
    quantidade: number
    custo_unitario: number | null
    observacao: string | null
    created_at: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    produtos: any
  }>
}
