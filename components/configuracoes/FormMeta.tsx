'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { salvarMeta } from '@/lib/actions/metas'
import { formatarReal } from '@/lib/formatos'

// "2026-07" -> "julho de 2026"
function rotuloMes(mes: string) {
  const d = new Date(`${mes}-15T12:00:00`)
  const s = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function FormMeta({
  mesAtual,
  metaAtual,
  historico,
}: {
  mesAtual: string
  metaAtual: number | null
  historico: { mes: string; valor: number }[]
}) {
  const router = useRouter()
  const [valor, setValor] = useState(metaAtual != null ? String(metaAtual) : '')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    const v = Number(valor)
    if (!valor || !Number.isFinite(v) || v <= 0) {
      toast.error('Informe uma meta maior que zero')
      return
    }
    setSalvando(true)
    const r = await salvarMeta({ mes: mesAtual, valor: v })
    setSalvando(false)
    if (r.error) {
      toast.error(r.error)
      return
    }
    toast.success('Meta salva')
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold text-text">{rotuloMes(mesAtual)}</h2>
        <div className="mt-3 flex gap-2">
          <input
            type="number"
            step="100"
            min="0"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Ex.: 50000"
            className="h-11 flex-1 rounded-lg border border-border bg-bg px-4 font-mono text-base tabular-nums text-text outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="u-motion h-11 rounded-lg bg-brand px-5 text-sm font-semibold text-primary-foreground hover:bg-brand-strong disabled:opacity-60"
          >
            {salvando ? 'Salvando...' : metaAtual != null ? 'Atualizar' : 'Definir meta'}
          </button>
        </div>
        {metaAtual != null && (
          <p className="mt-2 text-xs text-text-muted">
            Meta atual: {formatarReal(metaAtual)}
          </p>
        )}
      </div>

      {historico.length > 0 && (
        <div className="rounded-xl border border-border bg-surface">
          <p className="border-b border-border px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Metas anteriores
          </p>
          <ul className="divide-y divide-border/60">
            {historico.map((m) => (
              <li key={m.mes} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span className="text-text-muted">{rotuloMes(m.mes)}</span>
                <span className="font-mono tabular-nums text-text">{formatarReal(m.valor)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
