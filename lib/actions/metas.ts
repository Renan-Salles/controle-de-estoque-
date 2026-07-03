'use server'
import { createClient } from '@/lib/supabase/server'
import { getLocalAtivoId } from '@/lib/local'
import { getCargoUsuario } from '@/lib/permissoes'
import { mesAtualBrasil } from '@/lib/formatos'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Meta do mes (YYYY-MM) do local ativo. null = sem meta cadastrada.
export async function getMeta(mes?: string): Promise<number | null> {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const { data } = await supabase
    .from('metas_venda')
    .select('valor')
    .eq('local_id', localId)
    .eq('mes', mes ?? mesAtualBrasil())
    .maybeSingle()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any)?.valor != null ? Number((data as any).valor) : null
}

const MetaSchema = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}$/, 'Mês inválido'),
  valor: z.number().positive('Meta precisa ser maior que zero'),
})

// So admin define meta (fail-open do cargo nulo NAO vale aqui: escrita).
export async function salvarMeta(input: unknown) {
  const parsed = MetaSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const cargo = await getCargoUsuario()
  if (cargo && !cargo.admin) return { error: 'Só administrador define metas.' }

  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('metas_venda') as any).upsert(
    { local_id: localId, mes: parsed.data.mes, valor: parsed.data.valor },
    { onConflict: 'local_id,mes' },
  )
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  revalidatePath('/configuracoes/metas')
  return { success: true as const }
}

export async function listarMetas(limite = 12) {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('metas_venda')
    .select('mes, valor')
    .eq('local_id', localId)
    .order('mes', { ascending: false })
    .limit(limite)
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as { mes: string; valor: number }[]
}
