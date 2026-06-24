'use client'

import { useState, useTransition } from 'react'
import { ChevronsUpDown, Check, Store, Waves, type LucideIcon } from 'lucide-react'
import { trocarLocal } from '@/lib/actions/local'
import { cn } from '@/lib/utils'
import type { Local } from '@/lib/local'

const ICONE: Record<string, LucideIcon> = {
  deposito: Store,
  piscina: Waves,
}

export function SeletorLocal({
  locais,
  ativoSlug,
}: {
  locais: Local[]
  ativoSlug: string
}) {
  const [aberto, setAberto] = useState(false)
  const [pendente, startTransition] = useTransition()

  const ativo = locais.find((l) => l.slug === ativoSlug) ?? locais[0]
  if (!ativo) return null
  const IconeAtivo = ICONE[ativo.slug] ?? Store

  function selecionar(slug: string) {
    setAberto(false)
    if (slug === ativoSlug) return
    startTransition(async () => {
      await trocarLocal(slug)
      // Reload completo: telas client (busca via useEffect) tambem reagem ao novo local.
      window.location.reload()
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        disabled={pendente}
        className="u-motion u-press-sm flex items-center gap-2 rounded-lg border border-border bg-surface py-1.5 pl-2.5 pr-2 text-sm hover:bg-surface-2 disabled:opacity-60"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
          <IconeAtivo className="size-3.5" strokeWidth={1.5} />
        </span>
        <span className="max-w-[140px] truncate font-medium text-text">
          {ativo.nome}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-text-muted" strokeWidth={1.5} />
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAberto(false)} aria-hidden />
          <div className="absolute left-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-surface shadow-lg u-fade-in">
            <p className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-wider text-text-muted">
              Trocar de local
            </p>
            {locais.map((l) => {
              const Icone = ICONE[l.slug] ?? Store
              const ativoItem = l.slug === ativoSlug
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => selecionar(l.slug)}
                  className={cn(
                    'u-motion flex w-full items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-surface-2',
                    ativoItem ? 'text-text' : 'text-text-muted',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-md',
                      ativoItem ? 'bg-brand-soft text-brand' : 'bg-surface-2 text-text-muted',
                    )}
                  >
                    <Icone className="size-3.5" strokeWidth={1.5} />
                  </span>
                  <span className="flex-1 truncate text-left font-medium">{l.nome}</span>
                  {ativoItem && <Check className="size-4 text-brand" strokeWidth={2} />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
