'use server'
import { createClient } from '@/lib/supabase/server'
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
  forma_pagamento_padrao: z.enum(['dinheiro', 'pix', 'fiado', 'cartao_debito', 'cartao_credito']).default('dinheiro'),
  prazo_pagamento_dias: z.number().default(0),
  limite_credito: z.number().default(0),
  observacoes: z.string().optional(),
})

export async function criarCliente(data: Record<string, unknown>) {
  const parsed = ClienteSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, ...resto } = parsed.data
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from('clientes').insert({
    ...resto,
    endereco: { rua: endereco_rua, numero: endereco_numero, bairro: endereco_bairro, cidade: endereco_cidade },
  } as any)
  if (error) return { error: error.message }
  revalidatePath('/clientes')
  return { success: true }
}

export async function buscarClientes(termo?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('clientes')
    .select('id, nome, telefone, whatsapp, tipo, status, forma_pagamento_padrao, prazo_pagamento_dias, endereco')
    .eq('status', 'ativo')
    .order('nome')
  if (termo) query = query.ilike('nome', `%${termo}%`)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function listarClientes() {
  return buscarClientes()
}
