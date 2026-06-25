'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Ban, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { cancelarVenda } from '@/lib/actions/pedidos'

// Interacao isolada (o detalhe da venda e server component). Abre confirmacao
// e dispara o estorno: os itens voltam para o estoque.
export function BotaoCancelar({
  pedidoId,
  numero,
}: {
  pedidoId: string
  numero: string
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [pendente, startTransition] = useTransition()

  function confirmar() {
    startTransition(async () => {
      const resultado = await cancelarVenda(pedidoId)
      if (resultado.error) {
        toast.error(resultado.error)
        return
      }
      toast.success(`Venda ${numero} cancelada. Itens devolvidos ao estoque.`)
      setAberto(false)
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="u-motion inline-flex h-8 items-center gap-1.5 rounded-lg border border-err/40 bg-transparent px-3 text-sm font-medium text-err hover:bg-err/10 active:scale-[0.98]"
      >
        <Ban className="size-4" strokeWidth={1.5} />
        Cancelar venda
      </button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar a venda {numero}?</DialogTitle>
            <DialogDescription>
              Os itens voltam para o estoque. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={
                <button
                  type="button"
                  className="u-motion inline-flex h-9 items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text hover:bg-surface-2 active:scale-[0.98]"
                />
              }
            >
              Voltar
            </DialogClose>
            <button
              type="button"
              onClick={confirmar}
              disabled={pendente}
              className="u-motion inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-err px-4 text-sm font-semibold text-primary-foreground hover:bg-err/90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            >
              {pendente ? (
                <>
                  <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                  Cancelando...
                </>
              ) : (
                'Cancelar venda'
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
