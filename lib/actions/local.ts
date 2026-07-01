'use server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { listarLocais } from '@/lib/local'
import { getCargoUsuario, getLocalIdUsuario } from '@/lib/permissoes'

// Troca o local ativo (Deposito / Imperio Salles). Persiste em cookie por 1 ano.
export async function trocarLocal(slug: string) {
  const [cargo, localIdRestrito] = await Promise.all([
    getCargoUsuario(),
    getLocalIdUsuario(),
  ])
  if (!cargo?.admin && localIdRestrito) {
    const locais = await listarLocais()
    const alvo = locais.find((l) => l.slug === slug)
    if (!alvo || alvo.id !== localIdRestrito) {
      return { error: 'Sua conta só tem acesso a um local.' }
    }
  }

  const store = await cookies()
  store.set('local_ativo', slug, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  // Revalida tudo: cada tela passa a mostrar os dados do novo local.
  revalidatePath('/', 'layout')
  return { success: true }
}
