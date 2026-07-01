import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/server'
import { getCargoUsuario, getLocalIdUsuario } from '@/lib/permissoes'

export type Local = { id: string; nome: string; slug: string }

const COOKIE_LOCAL = 'local_ativo'
const SLUG_PADRAO = 'deposito'

export async function listarLocais(): Promise<Local[]> {
  const supabase = await createServiceClient()
  const { data } = await supabase
    .from('locais')
    .select('id, nome, slug')
    .eq('ativo', true)
    .order('slug')
  return ((data ?? []) as Local[])
}

// Local ativo da sessao. Se o usuario tem local_id fixo (convite/nao-admin),
// esse local sempre vence, ignorando o cookie — fecha a brecha de trocar de
// local direto pela action, sem precisar rejeitar a escrita do cookie em si.
export async function getLocalAtivo(): Promise<Local> {
  const locais = await listarLocais()

  const [cargo, localIdRestrito] = await Promise.all([
    getCargoUsuario(),
    getLocalIdUsuario(),
  ])
  const restrito = !cargo?.admin && localIdRestrito ? localIdRestrito : null
  if (restrito) {
    const forcado = locais.find((l) => l.id === restrito)
    if (forcado) return forcado
  }

  const store = await cookies()
  const slug = store.get(COOKIE_LOCAL)?.value ?? SLUG_PADRAO
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
