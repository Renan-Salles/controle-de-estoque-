import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

// Estado vazio composto: ícone discreto + título + descrição do que fazer +
// ação opcional (botão/link). Centralizado e calmo (DESIGN_SPEC).
export function EstadoVazio({
  icone: Icone,
  titulo,
  descricao,
  acao,
}: {
  icone: LucideIcon
  titulo: string
  descricao?: string
  acao?: ReactNode
}) {
  return (
    <div className="u-fade-in flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface px-6 py-16 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-surface-2 text-text-muted">
        <Icone className="size-5" strokeWidth={1.5} />
      </span>
      <p className="text-sm font-medium text-text">{titulo}</p>
      {descricao && (
        <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-text-muted">
          {descricao}
        </p>
      )}
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  )
}
