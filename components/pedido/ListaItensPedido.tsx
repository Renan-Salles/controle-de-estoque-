'use client'
import { Minus, Plus, Trash2, Pencil } from 'lucide-react'
import { Money } from '@/components/ui-kit/Money'
import { formatarReal } from '@/lib/formatos'
import { cn } from '@/lib/utils'
import type { ItemPedido } from '@/types'

interface Props {
  itens: ItemPedido[]
  onAlterarQtdFormas: (produtoId: string, qtd: number) => void
  onAlterarForma: (produtoId: string, formaId: string) => void
  onAlterarPrecoForma: (produtoId: string, preco: number) => void
  // Forma "Outra": o operador define na hora quantas unidades o pacote tem
  // (ex. meia caixa com 6). Preco vem do input de preco normal da linha.
  onAlterarFormaCustom: (produtoId: string, unidades: number) => void
  onRemover: (produtoId: string) => void
}

export function ListaItensPedido({
  itens,
  onAlterarQtdFormas,
  onAlterarForma,
  onAlterarPrecoForma,
  onAlterarFormaCustom,
  onRemover,
}: Props) {
  return (
    <ul className="divide-y divide-border/60">
      {itens.map((item) => {
        const forma = item.formas.find((f) => f.id === item.formaId) ?? item.formas[0]
        const customId = `custom-${item.produto_id}`
        const formaCustomAtiva = forma.id === customId
        const semEstoque = item.saldo_atual <= 0
        const acimaDoSaldo = item.quantidade > item.saldo_atual
        // Formas cadastradas (sem a "Outra", que tem card proprio no final).
        const formasCadastradas = item.formas.filter((f) => f.id !== customId)
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

              {/* Como vender: mini-cards com unidades e preco de cada forma,
                  + "Outra" pra montar um pacote na hora (qtde livre). */}
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {formasCadastradas.map((f) => {
                  const ativa = f.id === forma.id
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => onAlterarForma(item.produto_id, f.id)}
                      className={cn(
                        'u-motion flex flex-col items-start rounded-lg border px-2.5 py-1.5 text-left',
                        ativa
                          ? 'border-brand bg-brand/10'
                          : 'border-border bg-surface hover:border-brand/40',
                      )}
                    >
                      <span
                        className={cn(
                          'text-[12px] font-semibold leading-tight',
                          ativa ? 'text-brand' : 'text-text',
                        )}
                      >
                        {f.nome}
                      </span>
                      <span className="mt-0.5 text-[10px] leading-tight text-text-muted">
                        {f.unidades === 1 ? '1 unidade' : `${f.unidades} unidades`} · {formatarReal(f.preco)}
                      </span>
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => onAlterarFormaCustom(item.produto_id, formaCustomAtiva ? forma.unidades : 1)}
                  className={cn(
                    'u-motion flex flex-col items-start rounded-lg border border-dashed px-2.5 py-1.5 text-left',
                    formaCustomAtiva
                      ? 'border-brand bg-brand/10'
                      : 'border-border bg-surface hover:border-brand/40',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-[12px] font-semibold leading-tight',
                      formaCustomAtiva ? 'text-brand' : 'text-text',
                    )}
                  >
                    <Pencil className="size-3" strokeWidth={2} />
                    Outra
                  </span>
                  <span className="mt-0.5 text-[10px] leading-tight text-text-muted">
                    monte um pacote
                  </span>
                </button>
              </div>

              {/* Modo "Outra": define quantas unidades tem o pacote */}
              {formaCustomAtiva && (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-surface-2/60 px-2.5 py-2">
                  <span className="text-[11px] font-medium text-text-muted">
                    Pacote com
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={forma.unidades}
                    onChange={(e) =>
                      onAlterarFormaCustom(item.produto_id, Math.max(1, Number(e.target.value) || 1))
                    }
                    className="h-7 w-14 rounded-md border border-border bg-bg text-center font-mono text-sm tabular-nums text-text outline-none focus-visible:border-brand [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    aria-label="Unidades do pacote"
                  />
                  <span className="text-[11px] font-medium text-text-muted">
                    unidades · defina o preço ao lado
                  </span>
                </div>
              )}

              <div className="mt-2.5 flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    Qtde{forma.unidades > 1 ? ` (${forma.nome})` : ''}
                  </span>
                  <div className="inline-flex items-center rounded-lg border border-border bg-bg">
                    <button
                      type="button"
                      onClick={() =>
                        onAlterarQtdFormas(item.produto_id, Math.max(1, item.qtdFormas - 1))
                      }
                      className="u-motion flex size-8 touch-manipulation items-center justify-center rounded-l-lg text-text-muted hover:bg-surface-2 hover:text-text active:scale-95 disabled:opacity-40"
                      disabled={item.qtdFormas <= 1}
                      aria-label="Diminuir quantidade"
                    >
                      <Minus className="size-3.5" strokeWidth={2} />
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={item.qtdFormas}
                      onChange={(e) =>
                        onAlterarQtdFormas(item.produto_id, Math.max(1, Number(e.target.value) || 1))
                      }
                      className="h-8 w-12 border-x border-border bg-transparent text-center font-mono text-sm tabular-nums text-text outline-none focus-visible:bg-surface-2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      aria-label="Quantidade"
                    />
                    <button
                      type="button"
                      onClick={() => onAlterarQtdFormas(item.produto_id, item.qtdFormas + 1)}
                      className="u-motion flex size-8 touch-manipulation items-center justify-center rounded-r-lg text-text-muted hover:bg-surface-2 hover:text-text active:scale-95"
                      aria-label="Aumentar quantidade"
                    >
                      <Plus className="size-3.5" strokeWidth={2} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    {forma.unidades > 1 ? `Preço · ${forma.nome} (R$)` : 'Preço unitário (R$)'}
                  </span>
                  <div className="inline-flex h-8 items-center rounded-lg border border-border bg-bg pl-2.5">
                    <span className="font-mono text-xs text-text-muted">R$</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.precoForma === 0 ? '' : item.precoForma}
                      placeholder="0,00"
                      onChange={(e) =>
                        onAlterarPrecoForma(item.produto_id, Math.max(0, Number(e.target.value) || 0))
                      }
                      className="h-8 w-24 bg-transparent px-2 text-right font-mono text-sm tabular-nums text-text outline-none placeholder:text-text-muted/60 focus-visible:bg-surface-2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      aria-label="Preço"
                    />
                  </div>
                </div>
              </div>

              {/* Consumo de estoque explicito quando a forma agrupa unidades */}
              {forma.unidades > 1 && (
                <p className="mt-2 text-[11px] text-text-muted">
                  = {item.quantidade} un do estoque a {formatarReal(item.preco_unitario)}/un
                </p>
              )}
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
