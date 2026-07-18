'use client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatarReal, formatarData, addDias, hojeBrasil } from '@/lib/formatos'
import { rotuloPagamento } from '@/lib/pedido-labels'
import { cn } from '@/lib/utils'
import type { ClienteResumo } from '@/components/pedido/BuscaCliente'

export type FormaPagamentoVenda = 'dinheiro' | 'pix' | 'cartao_debito' | 'cartao_credito' | 'fiado'

export type ValorPagamento = {
  formaPagamento: FormaPagamentoVenda
  prazoDias: string
  dividir: boolean
  formaPagamentoSecundaria: FormaPagamentoVenda
  valorSecundario: string
  recebido: string
}

export const PAGAMENTO_INICIAL: ValorPagamento = {
  formaPagamento: 'dinheiro',
  prazoDias: '7',
  dividir: false,
  formaPagamentoSecundaria: 'pix',
  valorSecundario: '',
  recebido: '',
}

// Secao "Forma de pagamento" completa: forma principal, split opcional em
// 2 formas (qualquer combinacao, incl. fiado nas duas pontas), prazo/aviso
// de fiado, e recebido/troco quando dinheiro esta envolvido. Controlado:
// nao guarda estado proprio, so emite onChange -- reusado por FormSaida
// (venda nova) e EditarVendaForm (venda existente).
export function SeletorPagamento({
  cliente,
  total,
  value,
  onChange,
}: {
  cliente: ClienteResumo | null
  total: number
  value: ValorPagamento
  onChange: (v: ValorPagamento) => void
}) {
  const set = <K extends keyof ValorPagamento>(k: K, v: ValorPagamento[K]) =>
    onChange({ ...value, [k]: v })

  const envolveFiado = value.formaPagamento === 'fiado' || (value.dividir && value.formaPagamentoSecundaria === 'fiado')
  const envolveDinheiro = value.formaPagamento === 'dinheiro' || (value.dividir && value.formaPagamentoSecundaria === 'dinheiro')
  const recebidoNum = Number(value.recebido) || 0
  const troco = recebidoNum > 0 ? +(recebidoNum - total).toFixed(2) : null

  function selecionarFormaPagamento(v: FormaPagamentoVenda) {
    const next: ValorPagamento = { ...value, formaPagamento: v }
    if (v === 'fiado' && cliente?.prazo_pagamento_dias) {
      next.prazoDias = String(cliente.prazo_pagamento_dias)
    }
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        Forma de pagamento
      </label>
      <Select value={value.formaPagamento} onValueChange={(v) => v && selecionarFormaPagamento(v as FormaPagamentoVenda)}>
        <SelectTrigger className="w-full">
          <SelectValue>{(v: string) => rotuloPagamento(v)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="dinheiro">Dinheiro</SelectItem>
          <SelectItem value="pix">Pix</SelectItem>
          <SelectItem value="cartao_debito">Cartão débito</SelectItem>
          <SelectItem value="cartao_credito">Cartão crédito</SelectItem>
          <SelectItem value="fiado">Fiado</SelectItem>
        </SelectContent>
      </Select>

      {value.formaPagamento === 'fiado' && (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-warn/30 bg-warn/[0.06] p-3">
          {!cliente ? (
            <p className="text-xs font-medium text-warn">
              Selecione um cliente acima para venda fiado.
            </p>
          ) : (
            <>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Prazo para pagamento (dias)
              </label>
              <input
                type="number"
                min="1"
                value={value.prazoDias}
                onChange={(e) => set('prazoDias', e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-ring/50"
              />
              <p className="text-xs text-text-muted">
                Vence em {formatarData(addDias(hojeBrasil(), Number(value.prazoDias) || 0))}
              </p>
            </>
          )}
        </div>
      )}

      <label className="mt-2 flex items-center gap-2 text-sm text-text">
        <input
          type="checkbox"
          checked={value.dividir}
          onChange={(e) => set('dividir', e.target.checked)}
          className="size-4 rounded border-border"
        />
        Dividir em duas formas de pagamento?
      </label>

      {value.dividir && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-9 flex-1 items-center rounded-lg border border-border bg-surface pl-2">
              <span className="font-mono text-xs text-text-muted">R$</span>
              <input
                type="number"
                min={0}
                max={total}
                step="0.01"
                value={value.valorSecundario}
                onChange={(e) => set('valorSecundario', e.target.value)}
                placeholder="0,00"
                className="h-9 w-full bg-transparent px-2 text-sm text-text outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                aria-label="Valor da segunda forma"
              />
            </div>
            <Select
              value={value.formaPagamentoSecundaria}
              onValueChange={(v) => v && set('formaPagamentoSecundaria', v as FormaPagamentoVenda)}
            >
              <SelectTrigger className="w-40">
                <SelectValue>{(v: string) => rotuloPagamento(v)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="cartao_debito">Cartão débito</SelectItem>
                <SelectItem value="cartao_credito">Cartão crédito</SelectItem>
                <SelectItem value="fiado">Fiado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-text-muted">
            Resta pagar em {rotuloPagamento(value.formaPagamento)}:{' '}
            {formatarReal(Math.max(total - (Number(value.valorSecundario) || 0), 0))}
            {envolveFiado && ` · vencimento em ${formatarData(addDias(hojeBrasil(), Number(value.prazoDias) || 0))}`}
          </p>
        </div>
      )}

      {envolveDinheiro && (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-surface-2/60 px-3 py-2">
          <div className="inline-flex h-8 items-center gap-2">
            <span className="text-sm text-text-muted">Recebido</span>
            <div className="inline-flex h-8 items-center rounded-lg border border-border bg-bg pl-2">
              <span className="font-mono text-xs text-text-muted">R$</span>
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={value.recebido}
                placeholder="0,00"
                onChange={(e) => set('recebido', e.target.value)}
                className="h-8 w-20 bg-transparent px-2 text-right font-mono text-sm tabular-nums text-text outline-none placeholder:text-text-muted/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                aria-label="Valor recebido em dinheiro"
              />
            </div>
          </div>
          {troco != null && (
            <span className={cn('font-mono text-sm font-bold tabular-nums', troco >= 0 ? 'text-ok' : 'text-err')}>
              {troco >= 0 ? `Troco ${formatarReal(troco)}` : `Falta ${formatarReal(-troco)}`}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
