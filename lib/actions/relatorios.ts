'use server'
import { createClient } from '@/lib/supabase/server'
import { getLocalAtivoId } from '@/lib/local'

export type Periodo = { ini: string; fim: string }

// Vendas por período: agrega pedidos concluídos por dia. Query direta (sem RPC).
export async function relatorioVendasPeriodo(p: Periodo) {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  // data_pedido é timestamptz; o limite superior inclui o dia inteiro de p.fim.
  const { data, error } = await supabase
    .from('pedidos')
    .select('data_pedido, total')
    .eq('local_id', localId)
    .eq('status', 'concluida')
    .gte('data_pedido', p.ini)
    .lte('data_pedido', p.fim + 'T23:59:59.999')
    .order('data_pedido')
  if (error) throw error

  const linhas = (data ?? []) as unknown as { data_pedido: string; total: number }[]
  const mapa = new Map<string, { pedidos: number; receita: number }>()
  for (const l of linhas) {
    // Agrupa por dia (YYYY-MM-DD), descartando a hora do timestamp.
    const dia = l.data_pedido.slice(0, 10)
    const acc = mapa.get(dia) ?? { pedidos: 0, receita: 0 }
    acc.pedidos += 1
    acc.receita += Number(l.total ?? 0)
    mapa.set(dia, acc)
  }
  const dias = [...mapa.entries()]
    .map(([data, v]) => ({ data, ...v }))
    .sort((a, b) => a.data.localeCompare(b.data))
  const totalReceita = dias.reduce((s, d) => s + d.receita, 0)
  const totalPedidos = dias.reduce((s, d) => s + d.pedidos, 0)
  const ticketMedio = totalPedidos > 0 ? totalReceita / totalPedidos : 0
  return { totalReceita, totalPedidos, ticketMedio, dias }
}

export async function relatorioVendasProduto(p: Periodo) {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('vendas_por_produto', {
    p_local: localId,
    p_ini: p.ini,
    p_fim: p.fim,
  })
  if (error) throw error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    produto_id: r.produto_id as string,
    nome: r.nome as string,
    unidades: Number(r.unidades ?? 0),
    faturamento: Number(r.faturamento ?? 0),
  }))
}

export async function relatorioVendasCliente(p: Periodo) {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('vendas_por_cliente', {
    p_local: localId,
    p_ini: p.ini,
    p_fim: p.fim,
  })
  if (error) throw error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    cliente_id: (r.cliente_id ?? null) as string | null,
    nome: r.nome as string,
    pedidos: Number(r.pedidos ?? 0),
    total: Number(r.total ?? 0),
  }))
}
