'use server'
import { createClient } from '@/lib/supabase/server'
import { getLocalAtivoId } from '@/lib/local'
import { getCargoUsuario } from '@/lib/permissoes'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export type TaxaEntrega = { id: string; bairro: string; valor: number }

export async function listarTaxas(): Promise<TaxaEntrega[]> {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('taxas_entrega')
    .select('id, bairro, valor')
    .eq('local_id', localId)
    .order('bairro')
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as TaxaEntrega[]).map((t) => ({
    ...t,
    valor: Number(t.valor),
  }))
}

const TaxaSchema = z.object({
  bairro: z.string().min(2, 'Informe o bairro'),
  valor: z.number().min(0, 'Valor não pode ser negativo'),
})

export async function salvarTaxa(input: unknown) {
  const parsed = TaxaSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const cargo = await getCargoUsuario()
  if (cargo && !cargo.admin) return { error: 'Só administrador configura taxas.' }

  const localId = await getLocalAtivoId()
  const supabase = await createClient()

  // Upsert manual (o unique e por lower(bairro), o PostgREST nao aceita
  // indice funcional como onConflict): atualiza se ja existir.
  const { data: existente } = await supabase
    .from('taxas_entrega')
    .select('id')
    .eq('local_id', localId)
    .ilike('bairro', parsed.data.bairro.trim())
    .maybeSingle()

  if (existente) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('taxas_entrega') as any)
      .update({ bairro: parsed.data.bairro.trim(), valor: parsed.data.valor })
      .eq('id', (existente as { id: string }).id)
    if (error) return { error: error.message }
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('taxas_entrega') as any).insert({
      local_id: localId,
      bairro: parsed.data.bairro.trim(),
      valor: parsed.data.valor,
    })
    if (error) return { error: error.message }
  }

  revalidatePath('/configuracoes/taxas')
  return { success: true as const }
}

export async function excluirTaxa(id: string) {
  const cargo = await getCargoUsuario()
  if (cargo && !cargo.admin) return { error: 'Só administrador configura taxas.' }
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const { error } = await supabase
    .from('taxas_entrega')
    .delete()
    .eq('id', id)
    .eq('local_id', localId)
  if (error) return { error: error.message }
  revalidatePath('/configuracoes/taxas')
  return { success: true as const }
}

// Frete sugerido pro bairro (case-insensitive). null = sem taxa cadastrada.
export async function taxaPorBairro(bairro: string): Promise<number | null> {
  if (!bairro?.trim()) return null
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const { data } = await supabase
    .from('taxas_entrega')
    .select('valor')
    .eq('local_id', localId)
    .ilike('bairro', bairro.trim())
    .maybeSingle()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any)?.valor != null ? Number((data as any).valor) : null
}
