'use server'
import { createClient } from '@/lib/supabase/server'
import { getLocalAtivoId } from '@/lib/local'
import { getTotalCustosFixosMes } from '@/lib/actions/custos-fixos'
import { mesAtualBrasil } from '@/lib/formatos'

export type DreData = {
  receita_bruta: number
  cmv: number
  margem_bruta: number
  margem_bruta_pct: number
  custos_fixos: number
  perdas: number
  lucro_liquido: number
  lucro_liquido_pct: number
}

export async function getDre(mes?: string): Promise<DreData> {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const mesFiltro = (mes ?? mesAtualBrasil()) + '-01'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).rpc('calcular_dre', {
    p_local_id: localId,
    p_mes: mesFiltro,
  })

  const raw = (data ?? {}) as {
    receita_bruta?: number
    cmv?: number
    margem_bruta?: number
    perdas?: number
  }
  const receita = raw.receita_bruta ?? 0
  const cmv = raw.cmv ?? 0
  const margem = raw.margem_bruta ?? (receita - cmv)
  const perdas = raw.perdas ?? 0
  const custosFixos = await getTotalCustosFixosMes()
  const lucro = margem - custosFixos - perdas

  return {
    receita_bruta: receita,
    cmv,
    margem_bruta: margem,
    margem_bruta_pct: receita > 0 ? (margem / receita) * 100 : 0,
    custos_fixos: custosFixos,
    perdas,
    lucro_liquido: lucro,
    lucro_liquido_pct: receita > 0 ? (lucro / receita) * 100 : 0,
  }
}
