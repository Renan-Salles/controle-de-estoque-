'use client'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { btnClass } from '@/components/ui-kit/Button'
import { formatarNumero, formatarReal } from '@/lib/formatos'
import type { ProdutoEmbalagem } from '@/lib/actions/produtos'

export interface ProdutoDetalhe {
  id: string
  nome: string
  marca: string | null
  saldo_atual: number
  preco_venda_padrao: number
}

// Ao clicar num produto na lista, mostra so os precos de cada forma de venda
// (Unidade, Fardo, Caixa...) sem forcar ir pra edicao -- editar continua
// disponivel como acao separada no rodape, pra quem realmente quiser mexer.
export function DetalhePrecoDialog({
  produto,
  formas,
  onOpenChange,
}: {
  produto: ProdutoDetalhe | null
  formas: ProdutoEmbalagem[] | undefined
  onOpenChange: (aberto: boolean) => void
}) {
  const lista: { nome: string; unidades: number; preco: number }[] =
    formas && formas.length > 0
      ? [...formas].sort((a, b) => Number(b.padrao) - Number(a.padrao) || a.unidades - b.unidades)
      : produto
        ? [{ nome: 'Unidade', unidades: 1, preco: produto.preco_venda_padrao }]
        : []

  return (
    <Dialog open={produto != null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {produto && (
          <>
            <DialogHeader>
              <DialogTitle>{produto.nome}</DialogTitle>
              {produto.marca && (
                <p className="text-sm text-text-muted">{produto.marca}</p>
              )}
            </DialogHeader>

            <div className="divide-y divide-border rounded-lg border border-border">
              {lista.map((f, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-sm text-text">
                    {f.nome}
                    {f.unidades > 1 && (
                      <span className="ml-1 text-xs text-text-muted">({f.unidades} un)</span>
                    )}
                  </span>
                  <span className="font-mono text-base font-semibold tabular-nums text-brand">
                    {formatarReal(f.preco)}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-sm text-text-muted">
              Estoque atual:{' '}
              <span className="font-mono tabular-nums text-text">
                {formatarNumero(produto.saldo_atual)} un
              </span>
            </p>

            <DialogFooter>
              <Link href={`/produtos/${produto.id}/editar`} className={btnClass('outline')}>
                Editar produto
              </Link>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
