'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

// Navegação fina do módulo financeiro (segmented control).
// A sidebar global não pode ser alterada, então a navegação entre as três
// telas vive como tabs no topo de cada página financeira. A tab ativa é
// determinada pelo pathname atual.

const TABS = [
  { href: '/financeiro/formas-pagamento', label: 'Formas de pagamento' },
  { href: '/financeiro/a-pagar', label: 'A pagar' },
  { href: '/financeiro/relatorios', label: 'Relatórios' },
] as const

export function FinanceiroTabs() {
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
