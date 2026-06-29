import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Sidebar } from '@/components/shell/Sidebar'
import { Topbar } from '@/components/shell/Topbar'
import { PageTransition } from '@/components/shell/PageTransition'
import { Toaster } from 'sonner'
import { listarLocais, getLocalAtivo } from '@/lib/local'
import { getCargoUsuario, getNomePerfil } from '@/lib/permissoes'
import { rotaPermitida } from '@/lib/nav-catalogo'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [locais, localAtivo, cargo, nomePerfil] = await Promise.all([
    listarLocais(),
    getLocalAtivo(),
    getCargoUsuario(),
    getNomePerfil(),
  ])

  // Trava de rota por cargo (permissão real, não só esconder botão). O pathname
  // vem do header setado no middleware. Fail-open: cargo nulo libera tudo.
  const pathname = (await headers()).get('x-pathname') ?? ''
  if (pathname && !rotaPermitida(pathname, cargo)) {
    redirect('/dashboard')
  }

  // null = sem restrição (admin ou fail-open) → sidebar mostra tudo.
  const itensVisiveis = !cargo || cargo.admin ? null : cargo.itens_visiveis
  const isAdmin = cargo?.admin ?? false

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar localNome={localAtivo.nome} itensVisiveis={itensVisiveis} isAdmin={isAdmin} />
      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
        <Topbar
          email={user.email ?? 'usuário'}
          nome={nomePerfil ?? user.email?.split('@')[0] ?? 'Usuário'}
          locais={locais}
          localSlug={localAtivo.slug}
          localNome={localAtivo.nome}
          itensVisiveis={itensVisiveis}
          isAdmin={isAdmin}
        />
        <main className="min-w-0 flex-1 px-6 py-5">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <Toaster position="top-right" theme="dark" richColors />
    </div>
  )
}
