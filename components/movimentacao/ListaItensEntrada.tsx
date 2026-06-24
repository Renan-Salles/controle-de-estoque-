'use client'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { Money } from '@/components/ui-kit/Money'

export interface ItemEntrada {
  produto_id: string
  nome: string
  marca: string | null
  quantidade: number
  custo_unitario: number
}

interface Props {
  itens: ItemEntrada[]
  onAlterarQtde: (produtoId: string, qtde: number) => void
  onAlterarCusto: (produtoId: string, custo: number) => void
  onRemover: (produtoId: string) => void
}

// Lista de itens de uma ENTRADA (compra). Diferente da comanda de venda:
// cada linha pede CUSTO unitario (preco de compra), nao preco de venda.
export function ListaItensEntrada({
  itens,
  onAlterarQtde,
  onAlterarCusto,
  onRemover,
}: Props) {
  return (
    <ul className="divide-y divide-border/60">
      {itens.map((item) => {
        const subtotal = item.quantidade * item.custo_unitario
        return (
          <li
            key={item.produto_id}
            className="u-fade-in flex items-start gap-3 px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text">
                {item.nome}
              </p>
              {item.marca && (
                <p className="mt-0.5 truncate text-xs text-text-muted">
                  {item.marca}
                </p>
              )}

              <div className="mt-2.5 flex flex-wrap items-end gap-3">
                {/* Quantidade */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    Qtde
                  </span>
                  <div className="inline-flex items-center rounded-lg border border-border bg-bg">
                    <button
                      type="button"
                      onClick={() =>
                        onAlterarQtde(
                          item.produto_id,
                          Math.max(1, item.quantidade - 1),
                        )
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
                      onClick={() =>
                        onAlterarQtde(item.produto_id, item.quantidade + 1)
                      }
                      className="u-motion flex size-8 items-center justify-center rounded-r-lg text-text-muted hover:bg-surface-2 hover:text-text active:scale-95"
                      aria-label="Aumentar quantidade"
                    >
                      <Plus className="size-3.5" strokeWidth={2} />
                    </button>
                  </div>
                </div>

                {/* Custo unitario */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    Custo un. (R$)
                  </span>
                  <div className="inline-flex h-8 items-center rounded-lg border border-border bg-bg pl-2.5">
                    <span className="font-mono text-xs text-text-muted">R$</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.custo_unitario === 0 ? '' : item.custo_unitario}
                      placeholder="0,00"
                      onChange={(e) =>
                        onAlterarCusto(
                          item.produto_id,
                          Math.max(0, Number(e.target.value) || 0),
                        )
                      }
                      className="h-8 w-24 bg-transparent px-2 text-right font-mono text-sm tabular-nums text-text outline-none placeholder:text-text-muted/60 focus-visible:bg-surface-2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      aria-label="Custo unitário"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <Money valor={subtotal} className="text-sm font-medium" />
              <button
                type="button"
                onClick={() => onRemover(item.produto_id)}
                className="u-motion flex size-7 items-center justify-center rounded-md text-text-muted hover:bg-err/10 hover:text-err active:scale-95"
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
