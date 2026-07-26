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

export type DreMes = DreData & { mes: string }

// Serie dos ultimos N meses numa query so (calcular_dre_serie, fuso
// Brasilia). Custos fixos: o cadastro nao tem historico, entao o total
// atual vale pra todos os meses (aproximacao documentada na spec).
//
// calcular_dre_serie sempre devolve p_meses linhas via a CTE "meses"
// (coalescendo pra 0 quando nao houve venda no mes) quando quem chama e
// admin -- so o early return do gate de cargo (nao-admin) devolve 0 linhas.
// Um array vazio aqui so acontece pelo gate, nunca por "mes real sem
// vendas" -- entao null e a leitura correta nesse caso (nao "mes zerado").
export async function getDreSerie(meses = 6): Promise<DreMes[] | null> {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('calcular_dre_serie', {
    p_local_id: localId,
    p_meses: meses,
  })
  if (error) throw new Error(error.message)

  type Linha = { mes: string; receita: number; cmv: number; perdas: number }
  const linhas = (data ?? []) as Linha[]
  if (linhas.length === 0) return null

  const custosFixos = await getTotalCustosFixosMes()
  return linhas.map((l) => {
    const receita = Number(l.receita ?? 0)
    const cmv = Number(l.cmv ?? 0)
    const perdas = Number(l.perdas ?? 0)
    const margem = receita - cmv
    const lucro = margem - custosFixos - perdas
    return {
      mes: l.mes,
      receita_bruta: receita,
      cmv,
      margem_bruta: margem,
      margem_bruta_pct: receita > 0 ? (margem / receita) * 100 : 0,
      custos_fixos: custosFixos,
      perdas,
      lucro_liquido: lucro,
      lucro_liquido_pct: receita > 0 ? (lucro / receita) * 100 : 0,
    }
  })
}

// calcular_dre devolve null quando quem chama nao e admin (gate de cargo
// dentro da RPC). Antes isso virava "(data ?? {})" e computava um DreData
// falso (lucro_liquido = -custosFixos etc.) -- um resultado com CARA de
// real que o dashboard renderizaria como se fosse. Sem ser admin, ou no
// caso extremo de fail-open com cargo nulo em que a RPC discorda, retorna
// null de verdade em vez de inventar zero.
export async function getDre(mes?: string): Promise<DreData | null> {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const mesFiltro = (mes ?? mesAtualBrasil()) + '-01'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).rpc('calcular_dre', {
    p_local_id: localId,
    p_mes: mesFiltro,
  })
  if (!data) return null

  const raw = data as {
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
