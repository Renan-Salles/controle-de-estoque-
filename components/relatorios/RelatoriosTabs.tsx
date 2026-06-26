'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

// Navegação entre os relatórios de vendas (período/produto/cliente) + o
// relatório de faturamento mensal & Curva ABC, que vive no módulo financeiro.
// A tab ativa é determinada pelo pathname.

const TABS = [
  { href: '/relatorios', label: 'Por período' },
  { href: '/relatorios/produto', label: 'Por produto' },
  { href: '/relatorios/cliente', label: 'Por cliente' },
  { href: '/financeiro/relatorios', label: 'Faturamento & ABC' },
] as const

export function RelatoriosTabs() {
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
