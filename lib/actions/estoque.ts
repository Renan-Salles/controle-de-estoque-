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
  if (!user) return { error: 'Não autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ajusteRaw, error: errAjuste } = await (serviceClient as any).rpc('ajustar_estoque', {
    p_produto_id: data.produto_id,
    p_delta: data.quantidade,
    p_novo_custo_unitario: data.custo_unitario,
  })
  if (errAjuste) return { error: `Falha ao dar entrada no estoque: ${errAjuste.message}` }
  const ajuste = (ajusteRaw as { saldo_novo: number }[] | null)?.[0]
  const novoSaldo = ajuste?.saldo_novo ?? 0

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

  // Acerto: a quantidade e o NOVO saldo absoluto (p_novo_saldo). Demais:
  // quanto SAI (p_delta negativo). ajustar_estoque() trava a linha e calcula
  // o delta de verdade dentro da transacao, sem depender de uma leitura
  // previa que pode ficar desatualizada por uma corrida.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ajusteRaw, error: errAjuste } = await (serviceClient as any).rpc('ajustar_estoque', {
    p_produto_id: data.produto_id,
    ...(data.tipo === 'acerto'
      ? { p_novo_saldo: data.quantidade }
      : { p_delta: -data.quantidade }),
  })
  if (errAjuste) {
    if (errAjuste.message?.startsWith('ESTOQUE_INSUFICIENTE')) {
      return { error: `Saldo insuficiente para essa saída.` }
    }
    return { error: errAjuste.message }
  }
  const ajuste = (ajusteRaw as { saldo_novo: number; custo_medio: number; delta_aplicado: number }[] | null)?.[0]
  if (!ajuste) return { error: 'Falha ao ajustar estoque' }
  if (ajuste.delta_aplicado === 0) return { error: 'Sem mudança no saldo' }

  const novoSaldo = ajuste.saldo_novo
  const tipoMov =
    data.tipo === 'acerto' ? 'ajuste_inventario' : 'descarte'
  const obs = data.observacao
    ? `${ROTULO_AJUSTE[data.tipo]}: ${data.observacao}`
    : ROTULO_AJUSTE[data.tipo]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (serviceClient.from('movimentacoes_estoque') as any).insert({
    produto_id: data.produto_id,
    tipo: tipoMov,
    quantidade: ajuste.delta_aplicado,
    custo_unitario: ajuste.custo_medio,
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
      // Entrou na lista pelo status do produto (alerta/critico/ruptura) ou
      // so pelo piso de seguranca de 12? No segundo caso o status_estoque e
      // 'ok', e mostrar "OK" ao lado de uma sugestao de compra confunde --
      // a tela usa 'motivo' pra dizer "abaixo do piso" em vez de "OK".
      const motivo: 'status' | 'piso' =
        (p.status_estoque as string) === 'ok' ? 'piso' : 'status'
      return { ...p, sugestao_compra: sugestao, motivo }
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
  // busca IDs dos produtos do local ativo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prods } = await (supabase.from('produtos') as any)
    .select('id')
    .eq('local_id', localId)
  const ids: string[] = (prods ?? []).map((p: { id: string }) => p.id)
  if (!ids.length) return []

  const { data, error } = await supabase
    .from('movimentacoes_estoque')
    .select('id, produto_id, quantidade, custo_unitario, observacao, created_at, produtos(nome)')
    .eq('tipo', 'descarte')
    .in('produto_id', ids)
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
