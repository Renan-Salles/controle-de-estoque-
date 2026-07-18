'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, UserPlus } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { atribuirEntregadorManual, type UsuarioComCargo } from '@/lib/actions/pedidos'

export function AtribuirEntregadorForm({
  pedidoId,
  entregadores,
}: {
  pedidoId: string
  entregadores: UsuarioComCargo[]
}) {
  const router = useRouter()
  const [entregadorId, setEntregadorId] = useState('')
  const [pendente, startTransition] = useTransition()

  function atribuir() {
    if (!entregadorId) {
      toast.error('Escolha quem vai entregar')
      return
    }
    startTransition(async () => {
      const resultado = await atribuirEntregadorManual(pedidoId, entregadorId)
      if (resultado.error) {
        toast.error(resultado.error)
        return
      }
      toast.success('Entregador atribuído.')
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={entregadorId} onValueChange={(v) => v && setEntregadorId(v)}>
        <SelectTrigger className="h-8 w-44 text-sm">
          <SelectValue placeholder="Atribuir entregador...">
            {(v: string) => entregadores.find((u) => u.id === v)?.nome ?? v}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {entregadores.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <button
        type="button"
        onClick={atribuir}
        disabled={pendente || !entregadorId}
        className="u-motion inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-primary-foreground hover:bg-brand-strong disabled:pointer-events-none disabled:opacity-50"
      >
        {pendente ? (
          <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
        ) : (
          <UserPlus className="size-3.5" strokeWidth={1.75} />
        )}
        Atribuir
      </button>
    </div>
  )
}
