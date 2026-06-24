import type { ReactNode } from 'react'

// Cabeçalho de página padrão do sistema.
// Título compacto (não gigante), subtítulo opcional e slot de ações à direita.
export function PageHeader({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string
  subtitulo?: string
  children?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-text">{titulo}</h1>
        {subtitulo && (
          <p className="mt-1 text-sm text-text-muted">{subtitulo}</p>
        )}
      </div>
      {children && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {children}
        </div>
      )}
    </div>
  )
}
