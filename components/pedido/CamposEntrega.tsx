'use client'
import { useEffect } from 'react'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatarReal } from '@/lib/formatos'
import { taxaPorBairro } from '@/lib/actions/taxas'
import { cn } from '@/lib/utils'
import type { ClienteResumo } from '@/components/pedido/BuscaCliente'
import type { UsuarioComCargo } from '@/lib/actions/cargos'

export type TipoFulfillment = 'balcao' | 'entrega' | 'retirada'

export type ValorEntrega = {
  tipoFulfillment: TipoFulfillment
  entregadorId: string
  frete: string
  jaPago: boolean
  enderecoRua: string
  enderecoNumero: string
  enderecoBairro: string
  enderecoCidade: string
}

export const ENTREGA_INICIAL: ValorEntrega = {
  tipoFulfillment: 'balcao',
  entregadorId: '',
  frete: '',
  jaPago: false,
  enderecoRua: '',
  enderecoNumero: '',
  enderecoBairro: '',
  enderecoCidade: '',
}

const TIPOS: Array<{ valor: TipoFulfillment; label: string }> = [
  { valor: 'balcao', label: 'Balcão' },
  { valor: 'entrega', label: 'Entrega' },
  { valor: 'retirada', label: 'Retirar depois' },
]

// Secao "Tipo" completa: balcao/entrega/retirada, quem vai entregar, frete
// (com sugestao pela taxa do bairro cadastrado do cliente ou digitado),
// endereco de entrega quando nao ha cliente. Controlado, sem estado
// proprio -- reusado por FormSaida e EditarVendaForm.
export function CamposEntrega({
  cliente,
  equipe,
  value,
  onChange,
}: {
  cliente: ClienteResumo | null
  equipe: UsuarioComCargo[]
  value: ValorEntrega
  onChange: (v: ValorEntrega) => void
}) {
  const set = <K extends keyof ValorEntrega>(k: K, v: ValorEntrega[K]) =>
    onChange({ ...value, [k]: v })

  function sugerirFrete(bairro: string | undefined) {
    if (!bairro) return
    taxaPorBairro(bairro)
      .then((taxa) => {
        if (taxa != null && value.frete === '') {
          onChange({ ...value, frete: String(taxa) })
          toast.info(`Frete de ${bairro}: ${formatarReal(taxa)} (ajuste se precisar)`)
        }
      })
      .catch(() => {})
  }

  // Ao trocar cliente com bairro cadastrado, sugere o frete (uma vez).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (value.tipoFulfillment === 'entrega') sugerirFrete(cliente?.endereco?.bairro)
  }, [cliente?.id])

  return (
    <>
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          Tipo
        </label>
        <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-border bg-surface p-1">
          {TIPOS.map((t) => (
            <button
              key={t.valor}
              type="button"
              onClick={() => {
                set('tipoFulfillment', t.valor)
                if (t.valor === 'entrega') sugerirFrete(cliente?.endereco?.bairro)
              }}
              className={cn(
                'u-motion rounded-md px-3 py-1.5 text-sm font-medium',
                value.tipoFulfillment === t.valor
                  ? 'bg-brand text-primary-foreground'
                  : 'text-text-muted hover:bg-surface-2 hover:text-text',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {value.tipoFulfillment === 'entrega' && (
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Quem vai entregar
          </label>
          <Select value={value.entregadorId} onValueChange={(v) => v && set('entregadorId', v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione...">
                {(v: string) => equipe.find((u) => u.id === v)?.nome ?? v}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {equipe.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {value.tipoFulfillment === 'entrega' && (
        <div className="flex flex-col gap-2">
          <label htmlFor="frete" className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Frete (R$)
          </label>
          <input
            id="frete"
            type="number"
            step="0.01"
            min="0"
            value={value.frete}
            onChange={(e) => set('frete', e.target.value)}
            placeholder="0,00"
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </div>
      )}

      {value.tipoFulfillment === 'entrega' && !cliente && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Endereço de entrega
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={value.enderecoRua}
              onChange={(e) => set('enderecoRua', e.target.value)}
              placeholder="Rua"
              className="col-span-2 h-9 rounded-md border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand"
            />
            <input
              value={value.enderecoNumero}
              onChange={(e) => set('enderecoNumero', e.target.value)}
              placeholder="Número"
              className="h-9 rounded-md border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand"
            />
            <input
              value={value.enderecoBairro}
              onChange={(e) => set('enderecoBairro', e.target.value)}
              onBlur={() => sugerirFrete(value.enderecoBairro)}
              placeholder="Bairro"
              className="h-9 rounded-md border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand"
            />
            <input
              value={value.enderecoCidade}
              onChange={(e) => set('enderecoCidade', e.target.value)}
              placeholder="Cidade"
              className="col-span-2 h-9 rounded-md border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand"
            />
          </div>
        </div>
      )}

      {(value.tipoFulfillment === 'entrega' || value.tipoFulfillment === 'retirada') && (
        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={value.jaPago}
            onChange={(e) => set('jaPago', e.target.checked)}
            className="size-4 rounded border-border"
          />
          Já foi pago
        </label>
      )}
    </>
  )
}
