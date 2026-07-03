import { Phone, MessageCircle, Wallet, Store, MapPin } from 'lucide-react'
import { Money } from '@/components/ui-kit/Money'
import { StatusPill } from '@/components/ui-kit/StatusPill'
import { FulfillmentAcoes } from '@/components/movimentacao/FulfillmentAcoes'
import { rotuloPagamento } from '@/lib/pedido-labels'
import { formatarDataHora } from '@/lib/formatos'
import { cn } from '@/lib/utils'

export type EntregaResumo = {
  id: string
  numero_pedido: number
  total: number
  forma_pagamento: string
  pago: boolean
  saiu_entrega_em: string | null
  cliente: {
    nome: string
    telefone: string | null
    endereco: { rua?: string; numero?: string; bairro?: string; cidade?: string } | null
  } | null
  localNome: string
}

type Endereco = { rua?: string; numero?: string; bairro?: string; cidade?: string } | null

// Monta "Rua X, 123" + "Bairro, Cidade" a partir do jsonb de endereco.
function enderecoPartes(e: Endereco): { linha1: string; linha2: string } {
  if (!e) return { linha1: '', linha2: '' }
  return {
    linha1: [e.rua, e.numero].filter(Boolean).join(', '),
    linha2: [e.bairro, e.cidade].filter(Boolean).join(', '),
  }
}

export function CardEntrega({ entrega }: { entrega: EntregaResumo }) {
  const numeroFmt = `#${String(entrega.numero_pedido).padStart(4, '0')}`
  const telefone = entrega.cliente?.telefone ?? null
  const telDigitos = telefone?.replace(/\D/g, '') ?? ''
  const { linha1, linha2 } = enderecoPartes(entrega.cliente?.endereco ?? null)
  const emRota = !!entrega.saiu_entrega_em

  return (
    <div className="overflow-clip rounded-2xl border border-border bg-surface shadow-[0_12px_28px_-18px_rgba(0,0,0,0.35)]">
      {/* Faixa de status: onde essa entrega esta no fluxo */}
      <div
        className={cn(
          'flex items-center justify-between gap-2 px-4 py-2',
          emRota ? 'bg-info/10' : 'bg-warn/10',
        )}
      >
        <StatusPill
          status="aberto"
          label={emRota ? 'Em rota' : 'Aguardando saída'}
        />
        {emRota && (
          <span className="text-[11px] font-medium text-text-muted">
            saiu às {formatarDataHora(entrega.saiu_entrega_em).slice(-5)}
          </span>
        )}
      </div>

      <div className="p-4">
        {/* Cliente + valor */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] tabular-nums text-text-muted">{numeroFmt}</p>
            <p className="mt-0.5 truncate text-lg font-bold leading-tight text-text">
              {entrega.cliente?.nome ?? 'Cliente não identificado'}
            </p>
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-text-muted">
              <Wallet className="size-3" strokeWidth={1.5} />
              {rotuloPagamento(entrega.forma_pagamento)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <Money valor={entrega.total} destaque className="text-2xl font-bold tracking-tight" />
          </div>
        </div>

        {/* Cobranca na entrega: impossivel de nao ver */}
        {!entrega.pago && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-warn/20 text-warn">
              <Wallet className="size-3.5" strokeWidth={2} />
            </span>
            <p className="text-sm font-semibold text-warn">
              Cobrar na entrega: <Money valor={entrega.total} className="text-sm font-bold" />
            </p>
          </div>
        )}

        {/* Rota: origem -> destino com regua vertical */}
        <div className="mt-4 grid grid-cols-[20px_1fr] gap-x-3">
          <div className="flex flex-col items-center">
            <span className="flex size-5 items-center justify-center rounded-full bg-brand/15 text-brand">
              <Store className="size-3" strokeWidth={2} />
            </span>
            <span className="w-px flex-1 bg-border" />
            <span className="flex size-5 items-center justify-center rounded-full bg-accent-gold/15 text-accent-gold">
              <MapPin className="size-3" strokeWidth={2} />
            </span>
          </div>
          <div className="flex flex-col gap-3 pb-0.5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Retirar em</p>
              <p className="text-sm font-medium text-text">{entrega.localNome}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Entregar em</p>
              {linha1 || linha2 ? (
                <>
                  <p className="text-sm font-semibold text-text">{linha1 || linha2}</p>
                  {linha1 && linha2 && (
                    <p className="text-xs text-text-muted">{linha2}</p>
                  )}
                </>
              ) : (
                <p className="text-sm font-semibold text-warn">Endereço não cadastrado</p>
              )}
            </div>
          </div>
        </div>

        {/* Contato */}
        {telefone && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <a
              href={`tel:${telDigitos}`}
              className="u-motion flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface-2/60 text-sm font-semibold text-text hover:border-brand/50 hover:text-brand active:scale-[0.98]"
            >
              <Phone className="size-4" strokeWidth={1.75} />
              Ligar
            </a>
            <a
              href={`https://wa.me/55${telDigitos}`}
              target="_blank"
              rel="noopener noreferrer"
              className="u-motion flex h-11 items-center justify-center gap-2 rounded-xl border border-ok/30 bg-ok/10 text-sm font-semibold text-ok hover:border-ok/60 active:scale-[0.98]"
            >
              <MessageCircle className="size-4" strokeWidth={1.75} />
              WhatsApp
            </a>
          </div>
        )}

        {/* Proximo passo do fluxo em destaque */}
        <div className="mt-3">
          <FulfillmentAcoes
            pedidoId={entrega.id}
            tipoFulfillment="entrega"
            pago={entrega.pago}
            concluidoEm={null}
            saiuEntregaEm={entrega.saiu_entrega_em}
            empilhado
          />
        </div>
      </div>
    </div>
  )
}
