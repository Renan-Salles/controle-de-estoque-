import { Phone, MessageCircle, MapPin, Wallet } from 'lucide-react'
import { Money } from '@/components/ui-kit/Money'
import { FulfillmentAcoes } from '@/components/movimentacao/FulfillmentAcoes'
import { rotuloPagamento } from '@/lib/pedido-labels'

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

// Monta "Rua X, 123 - Bairro, Cidade" a partir do jsonb de endereco do
// cliente. Vazio quando nao ha nada preenchido.
function enderecoLinha(e: Endereco): string {
  if (!e) return ''
  const rua = [e.rua, e.numero].filter(Boolean).join(', ')
  const resto = [e.bairro, e.cidade].filter(Boolean).join(', ')
  return [rua, resto].filter(Boolean).join(' - ')
}

export function CardEntrega({ entrega }: { entrega: EntregaResumo }) {
  const numeroFmt = `#${String(entrega.numero_pedido).padStart(4, '0')}`
  const telefone = entrega.cliente?.telefone ?? null
  const telDigitos = telefone?.replace(/\D/g, '') ?? ''
  const endereco = enderecoLinha(entrega.cliente?.endereco ?? null)

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      {/* Cabecalho: numero + cliente + valor */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs tabular-nums text-text-muted">{numeroFmt}</p>
          <p className="mt-0.5 truncate text-base font-semibold text-text">
            {entrega.cliente?.nome ?? 'Venda de balcão'}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <Money valor={entrega.total} destaque className="text-lg font-semibold" />
          <p className="mt-0.5 flex items-center justify-end gap-1 text-xs text-text-muted">
            <Wallet className="size-3" strokeWidth={1.5} />
            {rotuloPagamento(entrega.forma_pagamento)}
            {!entrega.pago && (
              <span className="ml-1 rounded-full bg-warn/10 px-1.5 py-0.5 text-[10px] font-semibold text-warn">
                Cobrar na entrega
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Trajeto: de onde saiu -> endereco do cliente */}
      <div className="mt-3 flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-sm">
        <MapPin className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={1.5} />
        <div className="min-w-0">
          <p className="text-xs text-text-muted">De {entrega.localNome}</p>
          {endereco ? (
            <p className="mt-0.5 font-medium text-text">{endereco}</p>
          ) : (
            <p className="mt-0.5 font-medium text-warn">Endereço não cadastrado</p>
          )}
        </div>
      </div>

      {/* Contato do cliente */}
      {telefone && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a
            href={`tel:${telDigitos}`}
            className="u-motion flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface text-sm font-medium text-text hover:border-brand/50 hover:text-brand active:scale-[0.98]"
          >
            <Phone className="size-4" strokeWidth={1.5} />
            Ligar
          </a>
          <a
            href={`https://wa.me/55${telDigitos}`}
            target="_blank"
            rel="noopener noreferrer"
            className="u-motion flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface text-sm font-medium text-text hover:border-brand/50 hover:text-brand active:scale-[0.98]"
          >
            <MessageCircle className="size-4" strokeWidth={1.5} />
            WhatsApp
          </a>
        </div>
      )}

      {/* Acoes de fulfillment (saiu / entregue) -- mesmas do detalhe do pedido */}
      <div className="mt-3 border-t border-border/60 pt-3">
        <FulfillmentAcoes
          pedidoId={entrega.id}
          tipoFulfillment="entrega"
          pago={entrega.pago}
          concluidoEm={null}
          saiuEntregaEm={entrega.saiu_entrega_em}
        />
      </div>
    </div>
  )
}
