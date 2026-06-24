'use server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

// Troca o local ativo (Deposito / Imperio Salles). Persiste em cookie por 1 ano.
export async function trocarLocal(slug: string) {
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
