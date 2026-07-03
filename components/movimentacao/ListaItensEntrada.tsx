'use client'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { Money } from '@/components/ui-kit/Money'
import { formatarReal } from '@/lib/formatos'

export interface ItemEntrada {
  produto_id: string
  nome: string
  marca: string | null
  embalagem: string
  // Unidades base (garrafas/latas) que cabem em 1 "embalagem". 1 quando o
  // produto é vendido/comprado por unidade solta.
  fatorConversao: number
  // Quantidade digitada pelo operador, na unidade da embalagem (ex: 2 caixas).
  qtdEmbalagens: number
  // Valor pago pela embalagem inteira (ex: R$ 50 pela caixa toda).
  custoEmbalagem: number
  // Validade do lote (YYYY-MM-DD, opcional): alimenta o aviso de vencendo.
  validade: string
}

const LABEL_EMBALAGEM: Record<string, string> = {
  unidade: 'un', fardo: 'fardos', caixa: 'caixas', grade: 'grades', pack: 'packs',
}

export function unidadesDoItem(item: ItemEntrada): number {
  return item.qtdEmbalagens * item.fatorConversao
}

export function custoUnitarioDoItem(item: ItemEntrada): number {
  return item.fatorConversao > 0 ? item.custoEmbalagem / item.fatorConversao : item.custoEmbalagem
}

interface Props {
  itens: ItemEntrada[]
  onAlterarQtde: (produtoId: string, qtdEmbalagens: number) => void
  onAlterarCusto: (produtoId: string, custoEmbalagem: number) => void
  onAlterarValidade: (produtoId: string, validade: string) => void
  onRemover: (produtoId: string) => void
}

// Lista de itens de uma ENTRADA (compra). Cada linha pede quantas embalagens
// (caixa/fardo/unidade) e quanto foi pago por ela — a conversão pra unidade
// base de estoque e custo por unidade é automática (fatorConversao).
export function ListaItensEntrada({
  itens,
  onAlterarQtde,
  onAlterarCusto,
  onAlterarValidade,
  onRemover,
}: Props) {
  return (
    <ul className="divide-y divide-border/60">
      {itens.map((item) => {
        const temEmbalagem = item.fatorConversao > 1
        const rotulo = LABEL_EMBALAGEM[item.embalagem] ?? item.embalagem
        const unidades = unidadesDoItem(item)
        const custoUnitario = custoUnitarioDoItem(item)
        const subtotal = item.qtdEmbalagens * item.custoEmbalagem
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
                {/* Quantidade (em embalagens: caixa/fardo/un) */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    Qtde {temEmbalagem ? `(${rotulo})` : ''}
                  </span>
                  <div className="inline-flex items-center rounded-lg border border-border bg-bg">
                    <button
                      type="button"
                      onClick={() =>
                        onAlterarQtde(
                          item.produto_id,
                          Math.max(1, item.qtdEmbalagens - 1),
                        )
                      }
                      className="u-motion flex size-8 items-center justify-center rounded-l-lg text-text-muted hover:bg-surface-2 hover:text-text active:scale-95 disabled:opacity-40"
                      disabled={item.qtdEmbalagens <= 1}
                      aria-label="Diminuir quantidade"
                    >
                      <Minus className="size-3.5" strokeWidth={2} />
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={item.qtdEmbalagens}
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
                        onAlterarQtde(item.produto_id, item.qtdEmbalagens + 1)
                      }
                      className="u-motion flex size-8 items-center justify-center rounded-r-lg text-text-muted hover:bg-surface-2 hover:text-text active:scale-95"
                      aria-label="Aumentar quantidade"
                    >
                      <Plus className="size-3.5" strokeWidth={2} />
                    </button>
                  </div>
                </div>

                {/* Custo pago (pela embalagem inteira, ou por unidade se solta) */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    {temEmbalagem ? `Custo por ${item.embalagem} (R$)` : 'Custo un. (R$)'}
                  </span>
                  <div className="inline-flex h-8 items-center rounded-lg border border-border bg-bg pl-2.5">
                    <span className="font-mono text-xs text-text-muted">R$</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.custoEmbalagem === 0 ? '' : item.custoEmbalagem}
                      placeholder="0,00"
                      onChange={(e) =>
                        onAlterarCusto(
                          item.produto_id,
                          Math.max(0, Number(e.target.value) || 0),
                        )
                      }
                      className="h-8 w-24 bg-transparent px-2 text-right font-mono text-sm tabular-nums text-text outline-none placeholder:text-text-muted/60 focus-visible:bg-surface-2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      aria-label="Custo pago"
                    />
                  </div>
                </div>
              </div>

              {temEmbalagem && (
                <p className="mt-2 text-[11px] text-text-muted">
                  = {unidades} un a {formatarReal(custoUnitario)}/un
                </p>
              )}

              {/* Validade do lote (opcional) */}
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Validade
                </span>
                <input
                  type="date"
                  value={item.validade}
                  onChange={(e) => onAlterarValidade(item.produto_id, e.target.value)}
                  className="h-7 rounded-md border border-border bg-bg px-2 font-mono text-xs tabular-nums text-text outline-none focus-visible:border-brand"
                  aria-label={`Validade de ${item.nome}`}
                />
                <span className="text-[10px] text-text-muted">(opcional)</span>
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
