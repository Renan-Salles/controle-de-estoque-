import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'

export function PageHeader({
  titulo,
  subtitulo,
  back,
  children,
}: {
  titulo: string
  subtitulo?: string
  back?: string
  children?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        {back && (
          <Link
            href={back}
            className="mb-1.5 inline-flex items-center gap-1 text-xs text-text-muted hover:text-text"
          >
            <ChevronLeft className="size-3.5" strokeWidth={2} />
            Voltar
          </Link>
        )}
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
