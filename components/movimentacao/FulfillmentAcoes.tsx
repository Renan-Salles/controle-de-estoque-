'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, Truck, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  marcarPagoPedido,
  marcarConcluidoPedido,
  marcarSaiuEntregaPedido,
} from '@/lib/actions/pedidos'

export function FulfillmentAcoes({
  pedidoId,
  tipoFulfillment,
  pago,
  concluidoEm,
  saiuEntregaEm,
  empilhado = false,
}: {
  pedidoId: string
  tipoFulfillment: string
  pago: boolean
  concluidoEm: string | null
  saiuEntregaEm: string | null
  /**
   * Layout de card mobile (tela do Entregador): botoes empilhados em largura
   * total, com o PROXIMO passo do fluxo em destaque (saiu -> entregue).
   */
  empilhado?: boolean
}) {
  const router = useRouter()
  const [pendentePago, startPago] = useTransition()
  const [pendenteConcluido, startConcluido] = useTransition()
  const [pendenteSaiu, startSaiu] = useTransition()

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

  function confirmarSaiu() {
    startSaiu(async () => {
      const r = await marcarSaiuEntregaPedido(pedidoId)
      if (r.error) {
        toast.error(r.error)
        return
      }
      toast.success('Saída para entrega registrada')
      router.refresh()
    })
  }

  if (pago && concluidoEm) return null

  const mostraSaiu = tipoFulfillment === 'entrega' && !saiuEntregaEm && !concluidoEm
  // Proximo passo do fluxo de entrega: primeiro sair, depois confirmar.
  // No layout empilhado ele ganha o botao cheio (brand) pra ser obvio no dedo.
  const passoAtual: 'saiu' | 'concluido' | null = mostraSaiu
    ? 'saiu'
    : !concluidoEm
      ? 'concluido'
      : null

  const base = empilhado
    ? 'u-motion inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold disabled:pointer-events-none disabled:opacity-50 active:scale-[0.99]'
    : 'u-motion inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium disabled:pointer-events-none disabled:opacity-50'
  const secundario = cn(base, 'border border-border bg-surface text-text hover:border-brand/50 hover:text-brand')
  const primario = empilhado
    ? cn(base, 'bg-brand text-primary-foreground shadow-sm hover:bg-brand-strong')
    : secundario

  return (
    <div className={cn('gap-2', empilhado ? 'flex w-full flex-col' : 'flex flex-wrap items-center')}>
      {mostraSaiu && (
        <button
          type="button"
          onClick={confirmarSaiu}
          disabled={pendenteSaiu}
          className={passoAtual === 'saiu' ? primario : secundario}
        >
          <Truck className="size-4" strokeWidth={1.5} />
          {pendenteSaiu ? 'Marcando...' : 'Marcar que saiu para entrega'}
        </button>
      )}
      {!concluidoEm && (
        <button
          type="button"
          onClick={confirmarConcluido}
          disabled={pendenteConcluido}
          className={passoAtual === 'concluido' ? primario : secundario}
        >
          <CheckCircle2 className="size-4" strokeWidth={1.5} />
          {pendenteConcluido
            ? 'Confirmando...'
            : tipoFulfillment === 'entrega'
              ? 'Marcar como entregue'
              : 'Marcar como retirado'}
        </button>
      )}
      {!pago && (
        <button
          type="button"
          onClick={confirmarPago}
          disabled={pendentePago}
          className={secundario}
        >
          <Wallet className="size-4" strokeWidth={1.5} />
          {pendentePago ? 'Confirmando...' : 'Marcar como pago'}
        </button>
      )}
    </div>
  )
}
