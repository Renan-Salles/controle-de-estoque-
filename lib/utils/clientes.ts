import type { StatsCliente } from '@/lib/actions/clientes-stats'

export function classificarCliente(stats: StatsCliente): 'vip' | 'regular' | 'sumido' {
  if (!stats.ultima_compra) return 'sumido'
  const dias = Math.floor((Date.now() - new Date(stats.ultima_compra).getTime()) / 86400000)
  if (dias > 60) return 'sumido'
  if (stats.valor_total >= 2000) return 'vip'
  return 'regular'
}
