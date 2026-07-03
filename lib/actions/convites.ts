'use server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { listarLocais, type Local } from '@/lib/local'

export type ConvitePendente = {
  id: string
  cargo_id: string
  local_id: string
  expira_em: string
  cargos: { nome: string } | null
  locais: { nome: string } | null
}

export async function listarLocaisParaConvite(): Promise<Local[]> {
  return listarLocais()
}

export async function criarConvite(cargoId: string, localId: string) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('criar_convite', {
    p_cargo_id: cargoId,
    p_local_id: localId,
  })
  if (error) return { error: error.message }
  return { token: data as string }
}

export async function listarConvitesPendentes(): Promise<ConvitePendente[]> {
  const s = await createServiceClient()
  const { data } = await s
    .from('convites')
    .select('id, cargo_id, local_id, expira_em, cargos(nome), locais(nome)')
    .is('usado_em', null)
    .gt('expira_em', new Date().toISOString())
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as ConvitePendente[]
}

export async function revogarConvite(id: string) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('revogar_convite', { p_id: id })
  if (error) return { error: error.message }
  return { success: true as const }
}

export async function consultarConvite(
  token: string,
): Promise<{ valido: false } | { valido: true; cargoNome: string; localNome: string }> {
  const supabase = await createClient()
  const { data, error } = await (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase as any
  )
    .rpc('consultar_convite', { p_token: token })
    .single()
  if (error || !data) return { valido: false }
  const d = data as { valido: boolean; cargo_nome: string | null; local_nome: string | null }
  if (!d.valido || !d.cargo_nome || !d.local_nome) return { valido: false }
  return { valido: true, cargoNome: d.cargo_nome, localNome: d.local_nome }
}

export async function resgatarConvite(token: string, nome: string) {
  const supabase = await createClient()
  // A sessao criada pelo signUp no browser pode ainda nao ter chegado nos
  // cookies deste request (corrida real que ja deixou um convite queimado
  // sem aplicar o cargo). Sem usuario aqui, nem chama o RPC: devolve um
  // erro retryavel que o form trata tentando de novo.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'SESSAO_PENDENTE' as const }

  const { data, error } = await (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase as any
  )
    .rpc('resgatar_convite', { p_token: token, p_nome: nome })
    .single()
  if (error) return { error: error.message }
  const d = data as { cargo_nome: string; local_nome: string }
  return { success: true as const, cargoNome: d.cargo_nome, localNome: d.local_nome }
}
