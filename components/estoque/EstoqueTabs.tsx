'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

// Navegação entre Posição e Reposição de estoque (segmented control).
// Mesmo padrão de FinanceiroTabs/RelatoriosTabs: barra de links, aba ativa
// pelo pathname.

const TABS = [
  { href: '/estoque', label: 'Posição' },
  { href: '/estoque/reposicao', label: 'Reposição' },
] as const

export function EstoqueTabs() {
  const pathname = usePathname()

  return (
    <div className="mb-5 inline-flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
      {TABS.map((tab) => {
        const ativo = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={ativo ? 'page' : undefined}
            className={cn(
              'u-motion u-press-sm rounded-md px-3.5 py-1.5 text-sm font-medium',
              ativo
                ? 'bg-brand text-white shadow-sm shadow-black/20'
                : 'text-text-muted hover:bg-surface-2 hover:text-text',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
