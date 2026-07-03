'use client'
import { useState } from 'react'
import { Download } from 'lucide-react'
import { Input } from '@/components/ui/input'

// Filtro de período + botão que baixa o PDF da rota correspondente.
// `tipo` casa com app/relatorios/[tipo]/pdf; `sem-pdf` esconde o botao
// (relatorios que ainda nao tem rota de PDF, ex. entregadores).
export function FiltroPeriodo({
  tipo,
  ini,
  fim,
  onAplicar,
}: {
  tipo: 'periodo' | 'produto' | 'cliente' | 'sem-pdf'
  ini: string
  fim: string
  onAplicar: (p: { ini: string; fim: string }) => void
}) {
  const [di, setDi] = useState(ini)
  const [df, setDf] = useState(fim)
  const pdfHref = `/relatorios/${tipo}/pdf?ini=${di}&fim=${df}`
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wider text-text-muted">
        Início
        <Input
          type="date"
          value={di}
          onChange={(e) => setDi(e.target.value)}
          className="w-auto"
        />
      </label>
      <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wider text-text-muted">
        Fim
        <Input
          type="date"
          value={df}
          onChange={(e) => setDf(e.target.value)}
          className="w-auto"
        />
      </label>
      <button
        type="button"
        onClick={() => onAplicar({ ini: di, fim: df })}
        className="u-motion u-press inline-flex h-10 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text hover:border-brand/50 hover:text-brand"
      >
        Aplicar
      </button>
      {tipo !== 'sem-pdf' && (
        <a
          href={pdfHref}
          className="u-motion u-press inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-strong"
        >
          <Download className="size-4" strokeWidth={1.5} />
          Baixar PDF
        </a>
      )}
    </div>
  )
}
