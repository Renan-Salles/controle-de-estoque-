import type { LucideIcon } from 'lucide-react'
import { Money } from '@/components/ui-kit/Money'
import { cn } from '@/lib/utils'

// Card de KPI do módulo financeiro. Elevação leve (sombra tonal ao fundo),
// rótulo uppercase muted, valor em Money. `tom` ajusta a cor do valor:
//  - 'neutro'  → off-white
//  - 'ouro'    → dourado (dinheiro em destaque)
//  - 'critico' → vermelho (inadimplência / atraso)
// Ícone discreto no canto, em chip tonal. Sem glow, sem gradiente.

type Tom = 'neutro' | 'ouro' | 'critico'

export function KpiFinanceiro({
  rotulo,
  valor,
  icone: Icone,
  tom = 'neutro',
  hint,
}: {
  rotulo: string
  valor: number
  icone: LucideIcon
  tom?: Tom
  hint?: string
}) {
  return (
    <div className="u-stagger group relative overflow-hidden rounded-xl border border-border bg-surface p-5 shadow-[0_12px_28px_-18px_rgba(0,0,0,0.55)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          {rotulo}
        </p>
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg',
            tom === 'critico'
              ? 'bg-err/10 text-err'
              : tom === 'ouro'
                ? 'bg-accent-gold/10 text-accent-gold'
                : 'bg-surface-2 text-text-muted',
          )}
        >
          <Icone className="size-4" strokeWidth={1.5} />
        </span>
      </div>
      <div className="mt-3">
        <Money
          valor={valor}
          destaque={tom === 'ouro'}
          className={cn(
            'text-2xl font-semibold tracking-tight',
            tom === 'critico' && 'text-err',
          )}
        />
      </div>
      {hint && <p className="mt-1.5 text-xs text-text-muted">{hint}</p>}
    </div>
  )
}
