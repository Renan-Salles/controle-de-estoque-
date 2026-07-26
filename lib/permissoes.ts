import { cache } from 'react'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Cargo } from '@/lib/nav-catalogo'

export const getNomePerfil = cache(async (): Promise<string | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const service = await createServiceClient()
  const { data } = await service.from('profiles').select('nome').eq('id', user.id).single()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any)?.nome ?? null
})

// Cargo do usuário logado (server-only). Usa service client para ler o profile
// independentemente de RLS. Retorna null se não houver usuário ou cargo — os
// consumidores tratam null como acesso total (fail-open: nunca trancar ninguém).
// cache() do React memoiza por request: /caixa (e outras paginas) chamam essa
// funcao direto E indiretamente (listarFechamentos/fecharCaixa etc.) varias
// vezes no mesmo render -- sem isso cada chamada batia no banco de novo.
export const getCargoUsuario = cache(async (): Promise<Cargo | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const service = await createServiceClient()
  const { data } = await service
    .from('profiles')
    .select('cargos(id, nome, admin, itens_visiveis, ativo)')
    .eq('id', user.id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rel = (data as any)?.cargos
  const cargo = Array.isArray(rel) ? rel[0] : rel
  return (cargo ?? null) as Cargo | null
})

// local_id do usuário logado (server-only). null = sem restrição de local
// (admin ou conta antiga) — mesmo espírito fail-open do cargo nulo.
export const getLocalIdUsuario = cache(async (): Promise<string | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const service = await createServiceClient()
  const { data } = await service
    .from('profiles')
    .select('local_id')
    .eq('id', user.id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any)?.local_id ?? null
})
