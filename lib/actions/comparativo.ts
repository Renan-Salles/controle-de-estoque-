'use server'
import { createClient } from '@/lib/supabase/server'

export type ComparativoLocal = {
  local_id: string
  local_nome: string
  receita: number
  vendas: number
  ticket: number
  cmv: number
  lucro_bruto: number
}

// Mes corrente por local (admin only -- o gate de verdade esta dentro da
// funcao Postgres comparativo_locais, security definer).
export async function comparativoLocais(): Promise<ComparativoLocal[]> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('comparativo_locais', {})
  if (error) throw new Error(error.message)
  type Raw = Omit<ComparativoLocal, 'lucro_bruto'>
  return ((data ?? []) as Raw[]).map((l) => ({
    ...l,
    receita: Number(l.receita),
    vendas: Number(l.vendas),
    ticket: Number(l.ticket),
    cmv: Number(l.cmv),
    lucro_bruto: Number(l.receita) - Number(l.cmv),
  }))
}
