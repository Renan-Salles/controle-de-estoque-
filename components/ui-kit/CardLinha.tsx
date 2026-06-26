import Link from 'next/link'
import type { ReactNode } from 'react'

export type CampoCard = { label: string; valor: ReactNode }

// Card de uma linha para o mobile. A página declara titulo/campos/ações; este
// componente só desenha. Pareia com a Tabela do desktop (mesmos dados).
export function CardLinha({
  titulo,
  destaque,
  campos,
  acoes,
  href,
}: {
  titulo: ReactNode
  destaque?: ReactNode
  campos: CampoCard[]
  acoes?: ReactNode
  href?: string
}) {
  const corpo = (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 font-medium text-text">{titulo}</div>
        {destaque != null && <div className="shrink-0">{destaque}</div>}
      </div>
      {campos.length > 0 && (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
          {campos.map((c, i) => (
            <div key={i} className="flex flex-col">
              <dt className="text-[11px] uppercase tracking-wider text-text-muted">
                {c.label}
              </dt>
              <dd className="text-sm text-text">{c.valor}</dd>
            </div>
          ))}
        </dl>
      )}
      {acoes && <div className="mt-3 flex gap-2">{acoes}</div>}
    </div>
  )
  return href ? (
    <Link href={href} className="block">
      {corpo}
    </Link>
  ) : (
    corpo
  )
}
