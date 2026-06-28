'use server'
import { createClient } from '@/lib/supabase/server'
import { getLocalAtivoId } from '@/lib/local'

export type StatsCliente = {
  total_compras: number
  valor_total: number
  ticket_medio: number
  ultima_compra: string | null
  produto_favorito: string | null
}

export async function buscarStatsCliente(clienteId: string): Promise<StatsCliente> {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).rpc('stats_cliente', {
    p_cliente_id: clienteId,
    p_local_id: localId,
  })
  const d = (data ?? {}) as Partial<StatsCliente>
  return {
    total_compras: Number(d.total_compras ?? 0),
    valor_total: Number(d.valor_total ?? 0),
    ticket_medio: Number(d.ticket_medio ?? 0),
    ultima_compra: d.ultima_compra ?? null,
    produto_favorito: d.produto_favorito ?? null,
  }
}

export async function buscarHistoricoCliente(clienteId: string, limite = 20) {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const { data } = await supabase
    .from('pedidos')
    .select('id, numero_pedido, data_pedido, total, status, forma_pagamento')
    .eq('cliente_id', clienteId)
    .eq('local_id', localId)
    .neq('status', 'cancelada')
    .order('data_pedido', { ascending: false })
    .limit(limite)
  return (data ?? []) as Array<{
    id: string
    numero_pedido: number
    data_pedido: string
    total: number
    status: string
    forma_pagamento: string
  }>
}

