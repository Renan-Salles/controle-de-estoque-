'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { salvarTaxa, excluirTaxa, type TaxaEntrega } from '@/lib/actions/taxas'
import { formatarReal } from '@/lib/formatos'

export function TaxasEntrega({ iniciais }: { iniciais: TaxaEntrega[] }) {
  const router = useRouter()
  const [bairro, setBairro] = useState('')
  const [valor, setValor] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [excluindo, setExcluindo] = useState<string | null>(null)

  async function adicionar() {
    const v = Number(valor)
    if (!bairro.trim() || valor === '' || !Number.isFinite(v) || v < 0) {
      toast.error('Informe o bairro e o valor do frete')
      return
    }
    setSalvando(true)
    const r = await salvarTaxa({ bairro: bairro.trim(), valor: v })
    setSalvando(false)
    if (r.error) {
      toast.error(r.error)
      return
    }
    toast.success('Taxa salva')
    setBairro('')
    setValor('')
    router.refresh()
  }

  async function excluir(id: string) {
    setExcluindo(id)
    const r = await excluirTaxa(id)
    setExcluindo(null)
    if (r.error) {
      toast.error(r.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="grid grid-cols-[1fr_120px_auto] items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text">Bairro</label>
            <input
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && adicionar()}
              placeholder="Centro"
              className="h-10 rounded-lg border border-border bg-bg px-3 text-sm text-text outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text">Frete (R$)</label>
            <input
              type="number"
              min={0}
              step="0.50"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && adicionar()}
              placeholder="8,00"
              className="h-10 rounded-lg border border-border bg-bg px-3 text-right font-mono text-sm tabular-nums text-text outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <button
            type="button"
            onClick={adicionar}
            disabled={salvando}
            className="u-motion flex h-10 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-primary-foreground hover:bg-brand-strong disabled:opacity-60"
          >
            <Plus className="size-4" strokeWidth={2} />
            {salvando ? '...' : 'Adicionar'}
          </button>
        </div>
        <p className="mt-2 text-xs text-text-muted">
          Bairro repetido atualiza o valor existente.
        </p>
      </div>

      {iniciais.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <ul className="divide-y divide-border/60">
            {iniciais.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-5 py-2.5">
                <span className="text-sm font-medium text-text">{t.bairro}</span>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-sm tabular-nums text-text">
                    {formatarReal(t.valor)}
                  </span>
                  <button
                    type="button"
                    onClick={() => excluir(t.id)}
                    disabled={excluindo === t.id}
                    title="Remover taxa"
                    className="u-motion flex size-7 items-center justify-center rounded-md text-text-muted hover:bg-err/10 hover:text-err disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.5} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
