'use server'
import { createClient } from '@/lib/supabase/server'
import { getLocalAtivoId } from '@/lib/local'

export type LinhaEntregador = {
  entregador_id: string
  nome: string
  entregas: number
  tempo_medio_min: number | null
  frete_total: number
}

// Desempenho dos entregadores no periodo: entregas concluidas, tempo medio
// (so das que tem saiu_entrega_em E concluido_em) e frete somado.
export async function relatorioEntregadores(p: {
  ini: string
  fim: string
}): Promise<LinhaEntregador[]> {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select('entregador_id, frete, saiu_entrega_em, concluido_em, entregador:profiles!pedidos_entregador_id_fkey(nome)')
    .eq('local_id', localId)
    .eq('tipo_fulfillment', 'entrega')
    .eq('status', 'concluida')
    .not('concluido_em', 'is', null)
    .not('entregador_id', 'is', null)
    .gte('data_pedido', p.ini)
    .lte('data_pedido', p.fim + 'T23:59:59.999')
  if (error) throw new Error(error.message)

  type Rel<T> = T | T[] | null
  const umaRel = <T,>(rel: Rel<T>): T | null =>
    !rel ? null : Array.isArray(rel) ? (rel[0] ?? null) : rel
  type Raw = {
    entregador_id: string
    frete: number
    saiu_entrega_em: string | null
    concluido_em: string
    entregador: Rel<{ nome: string }>
  }

  const acc = new Map<
    string,
    { nome: string; entregas: number; somaMin: number; comTempo: number; frete: number }
  >()
  for (const r of (data ?? []) as unknown as Raw[]) {
    const atual = acc.get(r.entregador_id) ?? {
      nome: umaRel(r.entregador)?.nome ?? '?',
      entregas: 0,
      somaMin: 0,
      comTempo: 0,
      frete: 0,
    }
    atual.entregas += 1
    atual.frete += Number(r.frete ?? 0)
    if (r.saiu_entrega_em) {
      const min =
        (new Date(r.concluido_em).getTime() - new Date(r.saiu_entrega_em).getTime()) / 60000
      if (Number.isFinite(min) && min >= 0) {
        atual.somaMin += min
        atual.comTempo += 1
      }
    }
    acc.set(r.entregador_id, atual)
  }

  return Array.from(acc.entries())
    .map(([entregador_id, a]) => ({
      entregador_id,
      nome: a.nome,
      entregas: a.entregas,
      tempo_medio_min: a.comTempo > 0 ? Math.round(a.somaMin / a.comTempo) : null,
      frete_total: +a.frete.toFixed(2),
    }))
    .sort((a, b) => b.entregas - a.entregas)
}
