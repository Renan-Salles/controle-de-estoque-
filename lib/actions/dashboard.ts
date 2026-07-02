'use server'
import { createClient } from '@/lib/supabase/server'
import { getLocalAtivoId } from '@/lib/local'
import { hojeBrasil, mesAtualBrasil } from '@/lib/formatos'

export type DashStats = {
  vendaHoje: number
  vendasMes: number
  quantidadeMes: number
  ticketMedio: number
  clienteVip: string | null
}

export async function getDashStats(): Promise<DashStats> {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const hoje = hojeBrasil()
  const inicioMes = mesAtualBrasil() + '-01'

  const [rHoje, rMes, rVip] = await Promise.all([
    supabase
      .from('pedidos')
      .select('total')
      .eq('local_id', localId)
      .gte('data_pedido', hoje)
      .neq('status', 'cancelada'),
    supabase
      .from('pedidos')
      .select('total')
      .eq('local_id', localId)
      .gte('data_pedido', inicioMes)
      .neq('status', 'cancelada'),
    supabase
      .from('pedidos')
      .select('total, clientes(nome)')
      .eq('local_id', localId)
      .gte('data_pedido', inicioMes)
      .neq('status', 'cancelada')
      .order('total', { ascending: false })
      .limit(1),
  ])

  const vendaHoje = (rHoje.data ?? []).reduce((a: number, p: { total: number }) => a + Number(p.total ?? 0), 0)
  const vendasMes = (rMes.data ?? []).reduce((a: number, p: { total: number }) => a + Number(p.total ?? 0), 0)
  const quantidadeMes = (rMes.data ?? []).length
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clienteVip = ((rVip.data?.[0] as any)?.clientes?.nome as string | undefined) ?? null

  return {
    vendaHoje,
    vendasMes,
    quantidadeMes,
    ticketMedio: quantidadeMes > 0 ? vendasMes / quantidadeMes : 0,
    clienteVip,
  }
}
