'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowRight, Check, Loader2 } from 'lucide-react'
import { atualizarStatusPedido } from '@/lib/actions/pedidos'
import { proximoStatus, rotuloStatusPedido } from '@/lib/pedido-labels'

interface Props {
  pedidoId: string
  status: string
}

export function AvancarStatus({ pedidoId, status }: Props) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()
  const [salvando, setSalvando] = useState(false)
  const proximo = proximoStatus(status)

  if (status === 'cancelado') return null

  if (!proximo) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-ok/30 bg-ok/10 px-3 py-1.5 text-sm font-medium text-ok">
        <Check className="size-4" strokeWidth={2} />
        Pedido entregue
      </span>
    )
  }

  function avancar() {
    setSalvando(true)
    startTransition(async () => {
      const r = await atualizarStatusPedido(pedidoId, proximo as string)
      setSalvando(false)
      if (r.error) {
        toast.error(r.error)
        return
      }
      toast.success(`Status atualizado para "${rotuloStatusPedido(proximo)}"`)
      router.refresh()
    })
  }

  const ocupado = salvando || pendente

  return (
    <button
      type="button"
      onClick={avancar}
      disabled={ocupado}
      className="u-motion inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-brand-strong active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
    >
      {ocupado ? (
        <Loader2 className="size-4 animate-spin" strokeWidth={2} />
      ) : (
        <ArrowRight className="size-4" strokeWidth={2} />
      )}
      Avançar para {rotuloStatusPedido(proximo).toLowerCase()}
    </button>
  )
}
