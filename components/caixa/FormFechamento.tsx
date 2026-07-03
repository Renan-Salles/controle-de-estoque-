'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Landmark, TriangleAlert } from 'lucide-react'
import { fecharCaixa } from '@/lib/actions/caixa'
import { Money } from '@/components/ui-kit/Money'
import { formatarReal } from '@/lib/formatos'
import { cn } from '@/lib/utils'

type Comparativo = {
  dinheiro: number
  pix: number
  debito: number
  credito: number
  totalVendas: number
  dinheiro_contado: number
  diferenca: number
}

// Fluxo AS CEGAS: quem conta nao ve o esperado antes de confirmar -- so
// depois de gravado o sistema abre o comparativo. Evita "ajustar" a contagem.
export function FormFechamento({ jaFechouHoje }: { jaFechouHoje: boolean }) {
  const router = useRouter()
  const [contado, setContado] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [resultado, setResultado] = useState<Comparativo | null>(null)

  async function confirmar() {
    const valor = Number(contado)
    if (contado === '' || !Number.isFinite(valor) || valor < 0) {
      toast.error('Informe quanto tem na gaveta (pode ser 0)')
      return
    }
    setSalvando(true)
    const r = await fecharCaixa({ dinheiro_contado: valor, observacoes })
    setSalvando(false)
    if ('error' in r && r.error) {
      toast.error(r.error)
      return
    }
    if ('comparativo' in r && r.comparativo) {
      setResultado(r.comparativo)
      router.refresh()
    }
  }

  if (resultado) {
    const ok = Math.abs(resultado.diferenca) < 0.005
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold text-text">Caixa fechado</h2>
        <p className="mt-0.5 text-xs text-text-muted">
          {resultado.totalVendas} {resultado.totalVendas === 1 ? 'venda paga' : 'vendas pagas'} hoje
        </p>

        <div className="mt-4 divide-y divide-border/60 text-sm">
          <div className="flex items-center justify-between py-2.5">
            <span className="text-text-muted">Dinheiro esperado</span>
            <Money valor={resultado.dinheiro} />
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-text-muted">Dinheiro contado</span>
            <Money valor={resultado.dinheiro_contado} />
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="font-semibold text-text">Diferença</span>
            <span
              className={cn(
                'font-mono text-sm font-bold tabular-nums',
                ok ? 'text-ok' : resultado.diferenca > 0 ? 'text-info' : 'text-err',
              )}
            >
              {resultado.diferenca > 0 ? '+' : ''}
              {formatarReal(resultado.diferenca)}
              {ok ? ' (bateu!)' : resultado.diferenca > 0 ? ' (sobra)' : ' (falta)'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-text-muted">Pix (eletrônico)</span>
            <Money valor={resultado.pix} />
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-text-muted">Cartão débito</span>
            <Money valor={resultado.debito} />
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-text-muted">Cartão crédito</span>
            <Money valor={resultado.credito} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Landmark className="size-4" strokeWidth={1.5} />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-text">Fechar o caixa de hoje</h2>
          <p className="text-xs text-text-muted">
            Conte o dinheiro da gaveta e digite abaixo. O esperado aparece depois de confirmar.
          </p>
        </div>
      </div>

      {jaFechouHoje && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs font-medium text-warn">
          <TriangleAlert className="size-3.5 shrink-0" strokeWidth={2} />
          O caixa de hoje já foi fechado. Confirmar de novo substitui o fechamento anterior.
        </div>
      )}

      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="contado" className="text-[13px] font-medium text-text">
            Dinheiro na gaveta (R$)
          </label>
          <input
            id="contado"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={contado}
            onChange={(e) => setContado(e.target.value)}
            placeholder="0,00"
            className="h-12 rounded-lg border border-border bg-bg px-4 font-mono text-lg tabular-nums text-text outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="obs" className="text-[13px] font-medium text-text">
            Observações
          </label>
          <textarea
            id="obs"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Ex.: retirei R$ 200 pro troco de amanhã..."
            rows={2}
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none placeholder:text-text-muted/60 focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </div>
        <button
          type="button"
          onClick={confirmar}
          disabled={salvando}
          className="u-motion flex h-11 items-center justify-center rounded-xl bg-brand text-sm font-semibold text-primary-foreground hover:bg-brand-strong active:scale-[0.99] disabled:opacity-60"
        >
          {salvando ? 'Fechando...' : 'Confirmar fechamento'}
        </button>
      </div>
    </div>
  )
}
