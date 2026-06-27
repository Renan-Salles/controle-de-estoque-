'use server'
import { createClient } from '@/lib/supabase/server'
import { getLocalAtivoId } from '@/lib/local'
import type { Database } from '@/types/database.types'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

type FornecedorRow = Database['public']['Tables']['fornecedores']['Row']

const FornecedorSchema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  razao_social: z.string().optional(),
  cnpj: z.string().optional(),
  telefone: z.string().optional(),
  whatsapp: z.string().optional(),
  contato_nome: z.string().optional(),
  email: z.string().optional(),
  endereco_rua: z.string().optional(),
  endereco_numero: z.string().optional(),
  endereco_bairro: z.string().optional(),
  endereco_cidade: z.string().optional(),
  produtos_fornecidos: z.string().optional(),
  prazo_entrega_dias: z.number().min(0).default(0),
  observacoes: z.string().optional(),
  status: z.enum(['ativo', 'inativo']).default('ativo'),
})

function montar(data: z.infer<typeof FornecedorSchema>) {
  const {
    endereco_rua,
    endereco_numero,
    endereco_bairro,
    endereco_cidade,
    ...resto
  } = data
  return {
    ...resto,
    endereco: {
      rua: endereco_rua,
      numero: endereco_numero,
      bairro: endereco_bairro,
      cidade: endereco_cidade,
    },
  }
}

export async function criarFornecedor(data: Record<string, unknown>) {
  const parsed = FornecedorSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const { error } = await supabase
    .from('fornecedores')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({ ...montar(parsed.data), local_id: localId } as any)
  if (error) return { error: error.message }

  revalidatePath('/fornecedores')
  return { success: true }
}

export async function atualizarFornecedor(
  id: string,
  data: Record<string, unknown>,
) {
  const parsed = FornecedorSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.from('fornecedores') as any
  )
    .update(montar(parsed.data))
    .eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/fornecedores')
  revalidatePath(`/fornecedores/${id}`)
  return { success: true }
}

export async function buscarFornecedores(termo?: string) {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  let query = supabase
    .from('fornecedores')
    .select(
      'id, nome, razao_social, cnpj, telefone, whatsapp, contato_nome, email, status, prazo_entrega_dias, endereco',
    )
    .eq('local_id', localId)
    .order('nome')

  if (termo) query = query.ilike('nome', `%${termo}%`)
  const { data, error } = (await query) as {
    data: FornecedorRow[] | null
    error: { message: string } | null
  }
  if (error) throw new Error(error.message)
  return data ?? []
}

// Cadastro rápido a partir da entrada de estoque: cria com só o nome e devolve
// o fornecedor para vincular. O resto pode ser completado depois em Fornecedores.
export async function cadastrarFornecedorRapido(nome: string) {
  const limpo = nome.trim()
  if (limpo.length < 2) return { error: 'Informe um nome válido' }
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const { data, error } = await (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.from('fornecedores') as any
  )
    .insert({ nome: limpo, status: 'ativo', endereco: {}, local_id: localId })
    .select('id, nome')
    .single()
  if (error) return { error: error.message }
  revalidatePath('/fornecedores')
  return { fornecedor: data as { id: string; nome: string } }
}

export async function buscarFornecedorPorId(id: string) {
  const supabase = await createClient()
  const { data } = (await supabase
    .from('fornecedores')
    .select('*')
    .eq('id', id)
    .single()) as { data: FornecedorRow | null }
  return data
}
