'use server'
import { createClient } from '@/lib/supabase/server'
import { getLocalAtivoId } from '@/lib/local'
import { revalidatePath } from 'next/cache'

export type TurnoAtivo = {
  id: string
  iniciado_em: string
}

// Turno em aberto do usuario logado. null = fora de expediente agora.
export async function meuTurnoAtivo(): Promise<TurnoAtivo | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('entregador_turnos')
    .select('id, iniciado_em')
    .eq('entregador_id', user.id)
    .is('encerrado_em', null)
    .maybeSingle()
  return (data as TurnoAtivo | null) ?? null
}

// Abre um turno novo. Recusa se ja houver um aberto (o indice unico parcial
// tambem trava isso no banco -- essa checagem so da uma mensagem melhor).
export async function iniciarTurno() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const localId = await getLocalAtivoId()

  const { data: aberto } = await supabase
    .from('entregador_turnos')
    .select('id')
    .eq('entregador_id', user.id)
    .is('encerrado_em', null)
    .maybeSingle()
  if (aberto) return { error: 'Você já está em expediente.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('entregador_turnos') as any).insert({
    entregador_id: user.id,
    local_id: localId,
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { success: true as const }
}

// Fecha o turno aberto do usuario logado.
export async function encerrarTurno() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error, count } = await (supabase.from('entregador_turnos') as any)
    .update({ encerrado_em: new Date().toISOString() }, { count: 'exact' })
    .eq('entregador_id', user.id)
    .is('encerrado_em', null)
  if (error) return { error: error.message }
  if (!count) return { error: 'Nenhum expediente em aberto.' }
  revalidatePath('/dashboard')
  return { success: true as const }
}

// Mapa entregador_id -> iniciado_em, so de quem esta com turno aberto agora
// no local ativo. Usado no relatorio de entregadores.
export async function turnosAbertosPorEntregador(): Promise<Record<string, string>> {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const { data } = await supabase
    .from('entregador_turnos')
    .select('entregador_id, iniciado_em')
    .eq('local_id', localId)
    .is('encerrado_em', null)
  const mapa: Record<string, string> = {}
  for (const t of (data ?? []) as { entregador_id: string; iniciado_em: string }[]) {
    mapa[t.entregador_id] = t.iniciado_em
  }
  return mapa
}
