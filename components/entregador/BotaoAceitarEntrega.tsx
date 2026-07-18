'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, PackageCheck } from 'lucide-react'
import { aceitarEntrega } from '@/lib/actions/pedidos'

export function BotaoAceitarEntrega({ pedidoId }: { pedidoId: string }) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()

  function aceitar() {
    startTransition(async () => {
      const resultado = await aceitarEntrega(pedidoId)
      if (resultado.error) {
        toast.error(resultado.error)
        router.refresh()
        return
      }
      toast.success('Entrega aceita! Já está em "Minhas entregas".')
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={aceitar}
      disabled={pendente}
      className="u-motion inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-brand-strong disabled:pointer-events-none disabled:opacity-50 active:scale-[0.99]"
    >
      {pendente ? (
        <>
          <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          Aceitando...
        </>
      ) : (
        <>
          <PackageCheck className="size-4" strokeWidth={1.75} />
          Aceitar entrega
        </>
      )}
    </button>
  )
}
