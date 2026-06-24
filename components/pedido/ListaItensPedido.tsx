'use client'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { Money } from '@/components/ui-kit/Money'
import { cn } from '@/lib/utils'
import type { ItemPedido } from '@/types'

interface Props {
  itens: ItemPedido[]
  onAlterarQtde: (produtoId: string, qtde: number) => void
  onRemover: (produtoId: string) => void
}

export function ListaItensPedido({ itens, onAlterarQtde, onRemover }: Props) {
  return (
    <ul className="divide-y divide-border/60">
      {itens.map((item) => {
        const semEstoque = item.saldo_atual <= 0
        const acimaDoSaldo = item.quantidade > item.saldo_atual
        return (
          <li
            key={item.produto_id}
            className="u-fade-in flex items-start gap-3 px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text">
                {item.nome}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted">
                <Money valor={item.preco_unitario} className="text-xs" />
                <span>/un</span>
                {(semEstoque || acimaDoSaldo) && (
                  <span className="ml-1 rounded bg-err/10 px-1.5 py-0.5 font-medium text-err">
                    {semEstoque ? 'sem estoque' : `só ${item.saldo_atual} em estoque`}
                  </span>
                )}
              </p>

              <div className="mt-2.5 inline-flex items-center rounded-lg border border-border bg-bg">
                <button
                  type="button"
                  onClick={() =>
                    onAlterarQtde(item.produto_id, Math.max(1, item.quantidade - 1))
                  }
                  className="u-motion flex size-8 items-center justify-center rounded-l-lg text-text-muted hover:bg-surface-2 hover:text-text active:scale-95 disabled:opacity-40"
                  disabled={item.quantidade <= 1}
                  aria-label="Diminuir quantidade"
                >
                  <Minus className="size-3.5" strokeWidth={2} />
                </button>
                <input
                  type="number"
                  min={1}
                  value={item.quantidade}
                  onChange={(e) =>
                    onAlterarQtde(
                      item.produto_id,
                      Math.max(1, Number(e.target.value) || 1),
                    )
                  }
                  className="h-8 w-12 border-x border-border bg-transparent text-center font-mono text-sm tabular-nums text-text outline-none focus-visible:bg-surface-2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  aria-label="Quantidade"
                />
                <button
                  type="button"
                  onClick={() => onAlterarQtde(item.produto_id, item.quantidade + 1)}
                  className="u-motion flex size-8 items-center justify-center rounded-r-lg text-text-muted hover:bg-surface-2 hover:text-text active:scale-95"
                  aria-label="Aumentar quantidade"
                >
                  <Plus className="size-3.5" strokeWidth={2} />
                </button>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <Money valor={item.total} className="text-sm font-medium" />
              <button
                type="button"
                onClick={() => onRemover(item.produto_id)}
                className={cn(
                  'u-motion flex size-7 items-center justify-center rounded-md text-text-muted hover:bg-err/10 hover:text-err active:scale-95',
                )}
                aria-label="Remover item"
              >
                <Trash2 className="size-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
