'use server'
import { createClient } from '@/lib/supabase/server'
import { getLocalAtivoId } from '@/lib/local'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { CATEGORIAS, RECORRENCIAS } from '@/lib/constants/custos-fixos'

export type CustoFixo = {
  id: string
  nome: string
  categoria: string
  valor: number
  recorrencia: string
  ativo: boolean
}

const Schema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  categoria: z.enum(CATEGORIAS),
  valor: z.number().min(0, 'Valor deve ser positivo'),
  recorrencia: z.enum(RECORRENCIAS).default('mensal'),
  ativo: z.boolean().default(true),
})

export async function listarCustosFixos(): Promise<CustoFixo[]> {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from('custos_fixos') as any)
    .select('id, nome, categoria, valor, recorrencia, ativo')
    .eq('local_id', localId)
    .order('categoria')
  return (data ?? []) as CustoFixo[]
}

export async function getTotalCustosFixosMes(): Promise<number> {
  const custos = await listarCustosFixos()
  return custos.filter((c) => c.ativo).reduce((acc, c) => {
    if (c.recorrencia === 'mensal') return acc + c.valor
    if (c.recorrencia === 'anual') return acc + c.valor / 12
    return acc
  }, 0)
}

export async function criarCustoFixo(raw: Record<string, unknown>) {
  const parsed = Schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('custos_fixos') as any)
    .insert({ ...parsed.data, local_id: localId })
  if (error) return { error: error.message }
  revalidatePath('/financeiro/custos-fixos')
  return { success: true }
}

export async function atualizarCustoFixo(id: string, raw: Record<string, unknown>) {
  const parsed = Schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error, count } = await (supabase.from('custos_fixos') as any)
    .update(parsed.data, { count: 'exact' }).eq('id', id).eq('local_id', localId)
  if (error) return { error: error.message }
  if (count === 0) return { error: 'Custo fixo não encontrado neste local.' }
  revalidatePath('/financeiro/custos-fixos')
  return { success: true }
}

export async function deletarCustoFixo(id: string) {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error, count } = await (supabase.from('custos_fixos') as any)
    .delete({ count: 'exact' }).eq('id', id).eq('local_id', localId)
  if (error) return { error: error.message }
  if (count === 0) return { error: 'Custo fixo não encontrado neste local.' }
  revalidatePath('/financeiro/custos-fixos')
  return { success: true }
}
