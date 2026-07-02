'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NavConteudo, logoPartes } from '@/components/shell/nav-items'

export function Sidebar({
  localNome,
  itensVisiveis = null,
  isAdmin = false,
  pedidosPendentes = 0,
}: {
  localNome: string
  itensVisiveis?: string[] | null
  isAdmin?: boolean
  pedidosPendentes?: number
}) {
  const pathname = usePathname()
  const logo = logoPartes(localNome)

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-border px-5">
        <Link
          href="/dashboard"
          className="font-display flex min-w-0 items-center gap-2 text-[16px] font-bold tracking-tight text-text"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-gold/15 text-[13px] font-bold text-accent-gold">
            {logo.selo}
          </span>
          <span className="truncate">{logo.texto}</span>
        </Link>
      </div>

      {/* Navegação compartilhada com o drawer mobile */}
      <NavConteudo
        pathname={pathname}
        itensVisiveis={itensVisiveis}
        isAdmin={isAdmin}
        pedidosPendentes={pedidosPendentes}
      />
    </aside>
  )
}
