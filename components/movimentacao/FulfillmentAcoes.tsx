'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, Wallet } from 'lucide-react'
import { marcarPagoPedido, marcarConcluidoPedido } from '@/lib/actions/pedidos'

export function FulfillmentAcoes({
  pedidoId,
  tipoFulfillment,
  pago,
  concluidoEm,
}: {
  pedidoId: string
  tipoFulfillment: string
  pago: boolean
  concluidoEm: string | null
}) {
  const router = useRouter()
  const [pendentePago, startPago] = useTransition()
  const [pendenteConcluido, startConcluido] = useTransition()

  function confirmarPago() {
    startPago(async () => {
      const r = await marcarPagoPedido(pedidoId)
      if (r.error) {
        toast.error(r.error)
        return
      }
      toast.success('Pagamento confirmado')
      router.refresh()
    })
  }

  function confirmarConcluido() {
    startConcluido(async () => {
      const r = await marcarConcluidoPedido(pedidoId)
      if (r.error) {
        toast.error(r.error)
        return
      }
      toast.success(tipoFulfillment === 'entrega' ? 'Entrega confirmada' : 'Retirada confirmada')
      router.refresh()
    })
  }

  if (pago && concluidoEm) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!pago && (
        <button
          type="button"
          onClick={confirmarPago}
          disabled={pendentePago}
          className="u-motion inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text hover:border-brand/50 hover:text-brand disabled:pointer-events-none disabled:opacity-50"
        >
          <Wallet className="size-4" strokeWidth={1.5} />
          {pendentePago ? 'Confirmando...' : 'Marcar como pago'}
        </button>
      )}
      {!concluidoEm && (
        <button
          type="button"
          onClick={confirmarConcluido}
          disabled={pendenteConcluido}
          className="u-motion inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text hover:border-brand/50 hover:text-brand disabled:pointer-events-none disabled:opacity-50"
        >
          <CheckCircle2 className="size-4" strokeWidth={1.5} />
          {pendenteConcluido
            ? 'Confirmando...'
            : tipoFulfillment === 'entrega'
              ? 'Marcar como entregue'
              : 'Marcar como retirado'}
        </button>
      )}
    </div>
  )
}
