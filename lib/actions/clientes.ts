'use server'
import { createClient } from '@/lib/supabase/server'
import { getLocalAtivoId } from '@/lib/local'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const ClienteSchema = z.object({
  nome: z.string().min(2),
  tipo: z.enum(['bar', 'comercio', 'consumidor_final', 'revendedor']).default('bar'),
  telefone: z.string().optional(),
  whatsapp: z.string().optional(),
  cpf_cnpj: z.string().optional(),
  endereco_rua: z.string().optional(),
  endereco_numero: z.string().optional(),
  endereco_bairro: z.string().optional(),
  endereco_cidade: z.string().optional(),
  forma_pagamento_padrao: z.enum(['dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'fiado']).default('dinheiro'),
  prazo_pagamento_dias: z.number().default(0),
  limite_credito: z.number().default(0),
  observacoes: z.string().optional(),
})

export async function criarCliente(data: Record<string, unknown>) {
  const parsed = ClienteSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, ...resto } = parsed.data
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const { error } = await supabase.from('clientes').insert({
    ...resto,
    local_id: localId,
    endereco: { rua: endereco_rua, numero: endereco_numero, bairro: endereco_bairro, cidade: endereco_cidade },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
  if (error) return { error: error.message }
  revalidatePath('/clientes')
  return { success: true }
}

export async function atualizarCliente(id: string, data: Record<string, unknown>) {
  const parsed = ClienteSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, ...resto } = parsed.data
  const supabase = await createClient()
  const { error } = await (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.from('clientes') as any
  ).update({
    ...resto,
    endereco: { rua: endereco_rua, numero: endereco_numero, bairro: endereco_bairro, cidade: endereco_cidade },
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/clientes')
  revalidatePath(`/clientes/${id}`)
  return { success: true }
}

export async function buscarClientePorId(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('clientes')
    .select('id, nome, tipo, cpf_cnpj, telefone, whatsapp, endereco, forma_pagamento_padrao, prazo_pagamento_dias, limite_credito, observacoes')
    .eq('id', id)
    .single()
  return data as {
    id: string
    nome: string
    tipo: string
    cpf_cnpj: string | null
    telefone: string | null
    whatsapp: string | null
    endereco: { rua?: string; numero?: string; bairro?: string; cidade?: string } | null
    forma_pagamento_padrao: string
    prazo_pagamento_dias: number
    limite_credito: number
    observacoes: string | null
  } | null
}

export async function buscarClientes(termo?: string) {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  let query = supabase
    .from('clientes')
    .select('id, nome, telefone, whatsapp, tipo, status, forma_pagamento_padrao, prazo_pagamento_dias, endereco')
    .eq('status', 'ativo')
    .eq('local_id', localId)
    .order('nome')
  if (termo) query = query.ilike('nome', `%${termo}%`)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function listarClientes() {
  return buscarClientes()
}

// Cadastro rápido a partir da venda: cria com só o nome (resto fica em branco
// para completar depois) e já devolve o cliente para vincular na movimentação.
export async function cadastrarClienteRapido(nome: string) {
  const limpo = nome.trim()
  if (limpo.length < 2) return { error: 'Informe um nome válido' }
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const { data, error } = await (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.from('clientes') as any
  )
    .insert({
      nome: limpo,
      tipo: 'bar',
      forma_pagamento_padrao: 'dinheiro',
      status: 'ativo',
      endereco: {},
      local_id: localId,
    })
    .select('id, nome, telefone, forma_pagamento_padrao')
    .single()
  if (error) return { error: error.message }
  revalidatePath('/clientes')
  return { cliente: data as { id: string; nome: string; telefone: string | null; forma_pagamento_padrao: string } }
}
