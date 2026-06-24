import { formatarReal } from '@/lib/formatos'
import { cn } from '@/lib/utils'

// Valor monetário em R$ X.XXX,XX (pt-BR), sempre em mono tabular para alinhar
// colunas. `destaque` pinta de dourado (dinheiro em evidência — DESIGN_SPEC).
export function Money({
  valor,
  destaque = false,
  className,
}: {
  valor: number | null | undefined
  destaque?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'font-mono tabular-nums tracking-tight',
        destaque ? 'text-accent-gold' : 'text-text',
        className,
      )}
    >
      {formatarReal(valor)}
    </span>
  )
}
