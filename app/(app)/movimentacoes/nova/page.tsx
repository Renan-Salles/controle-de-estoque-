'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { FormSaida } from '@/components/movimentacao/FormSaida'
import { FormEntrada } from '@/components/movimentacao/FormEntrada'
import { cn } from '@/lib/utils'

type Tipo = 'saida' | 'entrada'

const OPCOES: {
  tipo: Tipo
  rotulo: string
  descricao: string
  icone: typeof ArrowUpRight
}[] = [
  {
    tipo: 'saida',
    rotulo: 'Saída (venda)',
    descricao: 'Venda à vista, baixa estoque',
    icone: ArrowUpRight,
  },
  {
    tipo: 'entrada',
    rotulo: 'Entrada (compra)',
    descricao: 'Compra, aumenta estoque',
    icone: ArrowDownLeft,
  },
]

export default function NovaMovimentacaoPage() {
  const [tipo, setTipo] = useState<Tipo>('saida')

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link
          href="/movimentacoes"
          className="u-motion flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text-muted hover:bg-surface-2 hover:text-text active:scale-95"
          aria-label="Voltar para movimentações"
        >
          <ArrowLeft className="size-4" strokeWidth={1.5} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">
            Nova movimentação
          </h1>
          <p className="text-sm text-text-muted">
            Registre uma venda (saída) ou uma compra de estoque (entrada).
          </p>
        </div>
      </div>

      {/* Toggle segmentado grande */}
      <div
        role="tablist"
        aria-label="Tipo de movimentação"
        className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-surface p-1.5 sm:grid-cols-2"
      >
        {OPCOES.map((o) => {
          const ativo = tipo === o.tipo
          const Icone = o.icone
          return (
            <button
              key={o.tipo}
              type="button"
              role="tab"
              aria-selected={ativo}
              onClick={() => setTipo(o.tipo)}
              className={cn(
                'u-motion flex items-center gap-3 rounded-lg px-4 py-3 text-left active:scale-[0.99]',
                ativo
                  ? 'bg-brand text-primary-foreground shadow-sm'
                  : 'text-text-muted hover:bg-surface-2 hover:text-text',
              )}
            >
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-lg',
                  ativo
                    ? 'bg-primary-foreground/15 text-primary-foreground'
                    : 'bg-surface-2 text-text-muted',
                )}
              >
                <Icone className="size-[18px]" strokeWidth={2} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{o.rotulo}</span>
                <span
                  className={cn(
                    'block text-xs',
                    ativo ? 'text-primary-foreground/80' : 'text-text-muted',
                  )}
                >
                  {o.descricao}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {tipo === 'saida' ? <FormSaida /> : <FormEntrada />}
    </div>
  )
}
