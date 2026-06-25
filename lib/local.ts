import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export type Local = { id: string; nome: string; slug: string }

const COOKIE_LOCAL = 'local_ativo'
const SLUG_PADRAO = 'deposito'

export async function listarLocais(): Promise<Local[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('locais')
    .select('id, nome, slug')
    .eq('ativo', true)
    .order('slug')
  return ((data ?? []) as Local[])
}

// Local ativo da sessao (cookie). Default: Deposito. Server-only.
export async function getLocalAtivo(): Promise<Local> {
  const store = await cookies()
  const slug = store.get(COOKIE_LOCAL)?.value ?? SLUG_PADRAO
  const locais = await listarLocais()
  const local =
    locais.find((l) => l.slug === slug) ??
    locais.find((l) => l.slug === SLUG_PADRAO) ??
    locais[0]
  // Se a tabela locais não retornou nada (ex: RLS ou erro de rede), falha limpo.
  if (!local) throw new Error('Nenhum local encontrado. Verifique a tabela locais e as políticas RLS.')
  return local
}

// Atalho quando so o id importa (filtros de query).
export async function getLocalAtivoId(): Promise<string> {
  return (await getLocalAtivo()).id
}
