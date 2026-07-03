'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowRightLeft } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  transferirProduto,
  listarTransferencias,
  type TransferenciaResumo,
} from '@/lib/actions/transferencias'
import { formatarData, formatarNumero } from '@/lib/formatos'

export function TransferirDialog({
  aberto,
  onOpenChange,
  produto,
  destinos,
}: {
  aberto: boolean
  onOpenChange: (v: boolean) => void
  produto: { id: string; nome: string; saldo: number } | null
  destinos: { id: string; nome: string }[]
}) {
  const router = useRouter()
  const [quantidade, setQuantidade] = useState('')
  const [destinoId, setDestinoId] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [historico, setHistorico] = useState<TransferenciaResumo[]>([])

  useEffect(() => {
    if (!aberto) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuantidade('')
    setDestinoId(destinos.length === 1 ? destinos[0].id : '')
    listarTransferencias(8).then(setHistorico).catch(() => setHistorico([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])

  async function transferir() {
    if (!produto) return
    const qtd = Number(quantidade)
    if (!quantidade || !Number.isFinite(qtd) || qtd <= 0) {
      toast.error('Informe a quantidade (em unidades)')
      return
    }
    if (!destinoId) {
      toast.error('Escolha o local de destino')
      return
    }
    setSalvando(true)
    const r = await transferirProduto({
      produto_id: produto.id,
      quantidade: qtd,
      destino_local_id: destinoId,
    })
    setSalvando(false)
    if ('error' in r && r.error) {
      toast.error(r.error)
      return
    }
    toast.success('Transferência concluída')
    onOpenChange(false)
    router.refresh()
    // a tela de estoque recarrega client-side; forca um reload dos dados
    window.location.reload()
  }

  return (
    <Sheet open={aberto} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Transferir estoque</SheetTitle>
          <SheetDescription>
            {produto
              ? `${produto.nome} · ${formatarNumero(produto.saldo)} un disponíveis aqui`
              : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text">
              Quantidade (unidades)
            </label>
            <input
              type="number"
              min={1}
              max={produto?.saldo}
              inputMode="numeric"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              placeholder="Ex.: 24"
              className="h-11 rounded-lg border border-border bg-bg px-3 font-mono text-base tabular-nums text-text outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text">Para onde</label>
            <Select value={destinoId} onValueChange={(v) => v && setDestinoId(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Escolha o local...">
                  {destinos.find((d) => d.id === destinoId)?.nome ?? 'Escolha o local...'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {destinos.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs leading-relaxed text-text-muted">
            Sai daqui e entra no destino com o mesmo custo médio. Se o produto
            não existir lá, o cadastro é copiado junto (com as formas de venda).
          </p>

          <button
            type="button"
            onClick={transferir}
            disabled={salvando}
            className="u-motion flex h-11 items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-primary-foreground hover:bg-brand-strong disabled:opacity-60"
          >
            <ArrowRightLeft className="size-4" strokeWidth={1.75} />
            {salvando ? 'Transferindo...' : 'Transferir'}
          </button>

          {historico.length > 0 && (
            <div className="mt-2 border-t border-border pt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Últimas transferências
              </p>
              <ul className="space-y-1.5">
                {historico.map((t) => (
                  <li key={t.id} className="text-[12px] text-text-muted">
                    {formatarData(t.created_at)} · <strong className="text-text">{formatarNumero(t.quantidade)} un</strong> de{' '}
                    {t.produto_nome} ({t.origem_nome} → {t.destino_nome})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
