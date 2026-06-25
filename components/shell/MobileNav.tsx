'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { NavConteudo, logoPartes } from '@/components/shell/nav-items'

// Navegação mobile: botão hamburguer (só em < lg) que abre um drawer pela
// esquerda com os mesmos grupos/itens da Sidebar. Fecha ao tocar num item
// (via onNavegar) ou no overlay (onOpenChange do Sheet).
export function MobileNav({ localNome }: { localNome: string }) {
  const pathname = usePathname()
  const [aberto, setAberto] = useState(false)
  const logo = logoPartes(localNome)

  // Fecha o drawer sempre que a rota muda (cinto e suspensório: além do
  // onNavegar nos links, garante fechamento se a navegação vier de outro lugar).
  useEffect(() => {
    setAberto(false)
  }, [pathname])

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <button
        type="button"
        aria-label="Abrir menu"
        onClick={() => setAberto(true)}
        className="-ml-1 flex size-9 shrink-0 items-center justify-center rounded-md text-text-muted u-motion u-press-sm hover:bg-surface-2 hover:text-text lg:hidden"
      >
        <Menu className="size-5" strokeWidth={1.5} />
      </button>

      <SheetContent
        side="left"
        showCloseButton={false}
        className="flex w-[17rem] max-w-[85vw] flex-col border-r border-border bg-sidebar p-0 text-text sm:max-w-[17rem]"
      >
        <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
        <SheetDescription className="sr-only">
          Acesso a todas as telas do sistema
        </SheetDescription>

        {/* Logo (mesmo padrão da sidebar) */}
        <div className="flex h-14 shrink-0 items-center border-b border-border px-5">
          <Link
            href="/dashboard"
            onClick={() => setAberto(false)}
            className="font-display flex min-w-0 items-center gap-2 text-[16px] font-bold tracking-tight text-text"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-gold/15 text-[13px] font-bold text-accent-gold">
              {logo.selo}
            </span>
            <span className="truncate">{logo.texto}</span>
          </Link>
        </div>

        <NavConteudo pathname={pathname} onNavegar={() => setAberto(false)} />
      </SheetContent>
    </Sheet>
  )
}
