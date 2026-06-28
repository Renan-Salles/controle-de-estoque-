'use server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { getLocalAtivoId } from '@/lib/local'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const ConfigSchema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  cnpj: z.string().optional(),
  telefone: z.string().optional(),
  endereco_rua: z.string().optional(),
  endereco_numero: z.string().optional(),
  endereco_bairro: z.string().optional(),
  endereco_cidade: z.string().optional(),
})

export type ConfDeposito = z.infer<typeof ConfigSchema>

export async function getConfDeposito(): Promise<ConfDeposito | null> {
  const localId = await getLocalAtivoId()
  const supabase = await createServiceClient()
  const { data } = await supabase
    .from('locais')
    .select('nome, cnpj, telefone, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade')
    .eq('id', localId)
    .single()
  return (data as ConfDeposito | null)
}

async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const service = await createServiceClient()
  const { data } = await service
    .from('profiles')
    .select('cargos(admin)')
    .eq('id', user.id)
    .single()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rel = (data as any)?.cargos
  const cargo = Array.isArray(rel) ? rel[0] : rel
  return cargo?.admin === true
}

export async function salvarConfDeposito(raw: Record<string, unknown>) {
  if (!(await isAdmin())) return { error: 'Sem permissão' }

  const parsed = ConfigSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const localId = await getLocalAtivoId()
  const supabase = await createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('locais') as any)
    .update(parsed.data)
    .eq('id', localId)
  if (error) return { error: error.message }

  revalidatePath('/configuracoes/deposito')
  revalidatePath('/configuracoes')
  return { success: true }
}
