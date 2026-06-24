'use client'

import { cn } from '@/lib/utils'

// Segmented control de filtro por status. Recebe a lista de opções
// (value + label), o valor ativo e o handler. Visual coeso com FinanceiroTabs,
// porém em escala menor (filtro inline). Press tátil e transição rápida.

export type OpcaoFiltro = { value: string; label: string }

export function FiltroStatus({
  opcoes,
  valor,
  onChange,
}: {
  opcoes: OpcaoFiltro[]
  valor: string
  onChange: (value: string) => void
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface p-1">
      {opcoes.map((op) => {
        const ativo = valor === op.value
        return (
          <button
            key={op.value}
            type="button"
            onClick={() => onChange(op.value)}
            aria-pressed={ativo}
            className={cn(
              'u-motion u-press-sm rounded-md px-3 py-1 text-[13px] font-medium',
              ativo
                ? 'bg-surface-2 text-text shadow-sm shadow-black/20'
                : 'text-text-muted hover:text-text',
            )}
          >
            {op.label}
          </button>
        )
      })}
    </div>
  )
}
