'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChevronDown, LogOut } from 'lucide-react'
import { ThemeToggle } from '@/components/shell/ThemeToggle'
import { SeletorLocal } from '@/components/shell/SeletorLocal'
import { MobileNav } from '@/components/shell/MobileNav'
import type { Local } from '@/lib/local'

// Título legível da rota atual. Casa o início do pathname com o rótulo.
const TITULOS: { prefixo: string; titulo: string }[] = [
  { prefixo: '/dashboard', titulo: 'Dashboard' },
  { prefixo: '/movimentacoes/nova', titulo: 'Nova Movimentação' },
  { prefixo: '/movimentacoes', titulo: 'Movimentações' },
  { prefixo: '/produtos', titulo: 'Produtos' },
  { prefixo: '/clientes', titulo: 'Clientes' },
  { prefixo: '/fornecedores', titulo: 'Fornecedores' },
  { prefixo: '/estoque', titulo: 'Estoque' },
  { prefixo: '/financeiro/relatorios', titulo: 'Relatórios' },
  { prefixo: '/financeiro/formas-pagamento', titulo: 'Financeiro' },
  { prefixo: '/financeiro/a-pagar', titulo: 'Financeiro' },
  { prefixo: '/financeiro', titulo: 'Financeiro' },
  { prefixo: '/configuracoes', titulo: 'Configurações' },
]

function tituloDaRota(pathname: string): string {
  const m = TITULOS.find((t) => pathname.startsWith(t.prefixo))
  return m?.titulo ?? 'R$ Depósito'
}

export function Topbar({
  email,
  nome,
  locais,
  localSlug,
  localNome,
  itensVisiveis = null,
  isAdmin = false,
}: {
  email: string
  nome: string
  locais: Local[]
  localSlug: string
  localNome: string
  itensVisiveis?: string[] | null
  isAdmin?: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [saindo, setSaindo] = useState(false)

  const inicial = (nome?.[0] ?? 'U').toUpperCase()
  const titulo = tituloDaRota(pathname)

  async function sair() {
    setSaindo(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b border-border bg-bg/80 px-3 backdrop-blur-sm sm:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <MobileNav localNome={localNome} itensVisiveis={itensVisiveis} isAdmin={isAdmin} />
        <SeletorLocal locais={locais} ativoSlug={localSlug} />
        <span className="hidden h-4 w-px bg-border sm:block" />
        <h2 className="hidden text-sm font-medium tracking-tight text-text sm:block">
          {titulo}
        </h2>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
      <ThemeToggle />
      <div className="relative">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 text-sm text-text-muted u-motion u-press-sm hover:bg-surface-2 hover:text-text"
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
            {inicial}
          </span>
          <span className="hidden max-w-[180px] truncate sm:inline">{nome}</span>
          <ChevronDown className="size-4 shrink-0" strokeWidth={1.5} />
        </button>

        {aberto && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setAberto(false)}
              aria-hidden
            />
            <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-surface shadow-lg u-fade-in">
              <div className="border-b border-border px-3 py-2.5">
                <p className="font-medium text-sm text-text">{nome}</p>
                <p className="mt-0.5 truncate text-[11px] text-text-muted">{email}</p>
              </div>
              <button
                type="button"
                onClick={sair}
                disabled={saindo}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-text-muted u-motion hover:bg-surface-2 hover:text-err disabled:opacity-60"
              >
                <LogOut className="size-4" strokeWidth={1.5} />
                {saindo ? 'Saindo...' : 'Sair'}
              </button>
            </div>
          </>
        )}
      </div>
      </div>
    </header>
  )
}
