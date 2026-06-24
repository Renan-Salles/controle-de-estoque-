'use client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2 } from 'lucide-react'
import type { ItemPedido } from '@/types'

interface Props {
  itens: ItemPedido[]
  onAlterarQtde: (produtoId: string, qtde: number) => void
  onRemover: (produtoId: string) => void
}

export function ListaItensPedido({ itens, onAlterarQtde, onRemover }: Props) {
  if (!itens.length) {
    return <p className="text-center text-muted-foreground py-8 text-sm">Adicione produtos ao pedido</p>
  }

  const total = itens.reduce((acc, i) => acc + i.total, 0)

  return (
    <div className="space-y-2">
      {itens.map(item => (
        <div key={item.produto_id} className="flex items-center gap-2 p-2 rounded bg-muted">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{item.nome}</p>
            <p className="text-xs text-muted-foreground">R$ {item.preco_unitario.toFixed(2)}/un</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7"
              onClick={() => onAlterarQtde(item.produto_id, Math.max(1, item.quantidade - 1))}>-</Button>
            <Input type="number" className="h-7 w-14 text-center text-sm" value={item.quantidade}
              onChange={e => onAlterarQtde(item.produto_id, Math.max(1, Number(e.target.value)))} />
            <Button variant="outline" size="icon" className="h-7 w-7"
              onClick={() => onAlterarQtde(item.produto_id, item.quantidade + 1)}>+</Button>
          </div>
          <span className="w-20 text-right text-sm font-medium">R$ {item.total.toFixed(2)}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
            onClick={() => onRemover(item.produto_id)}><Trash2 size={14} /></Button>
        </div>
      ))}
      <div className="border-t border-border pt-2 flex justify-between font-bold">
        <span>Total</span>
        <span className="text-[#D4A520]">R$ {total.toFixed(2)}</span>
      </div>
    </div>
  )
}
