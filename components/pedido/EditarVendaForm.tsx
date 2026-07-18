'use client'
import { useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { BuscaProduto, type ProdutoParaAdicionar } from '@/components/pedido/BuscaProduto'
import { ListaItensPedido } from '@/components/pedido/ListaItensPedido'
import { editarVenda } from '@/lib/actions/pedidos'
import { formatarReal } from '@/lib/formatos'
import type { ItemPedido } from '@/types'

// Copia da mesma funcao pura de FormSaida.tsx: recalcula quantidade/preco/total
// a partir da forma de venda escolhida. Duplicada de proposito (arquivo isolado,
// nao mexe em FormSaida.tsx) -- e uma funcao pequena e estavel, sem estado.
function aplicarForma(
  item: ItemPedido,
  formaId: string,
  qtdFormas: number,
  precoForma?: number,
): ItemPedido {
  const forma = item.formas.find((f) => f.id === formaId) ?? item.formas[0]
  const preco = precoForma ?? forma.preco
  return {
    ...item,
    formaId: forma.id,
    qtdFormas,
    precoForma: preco,
    quantidade: qtdFormas * forma.unidades,
    total: +(qtdFormas * preco).toFixed(2),
    preco_unitario: forma.unidades > 0 ? +(preco / forma.unidades).toFixed(2) : preco,
  }
}

export function EditarVendaForm({
  pedidoId,
  numeroPedido,
  itensIniciais,
}: {
  pedidoId: string
  numeroPedido: number
  itensIniciais: ItemPedido[]
}) {
  const router = useRouter()
  const [itens, setItens] = useState<ItemPedido[]>(itensIniciais)
  const [salvando, startTransition] = useTransition()
  const numeroFmt = `#${String(numeroPedido).padStart(4, '0')}`

  const adicionarItem = useCallback((produto: ProdutoParaAdicionar) => {
    setItens((prev) => {
      const existe = prev.find((i) => i.produto_id === produto.produto_id)
      if (existe) {
        return prev.map((i) =>
          i.produto_id === produto.produto_id
            ? aplicarForma(i, i.formaId, i.qtdFormas + 1, i.precoForma)
            : i,
        )
      }
      const forma = produto.formas.find((f) => f.padrao) ?? produto.formas[0]
      const base: ItemPedido = {
        produto_id: produto.produto_id,
        nome: produto.nome,
        categoria: produto.categoria,
        saldo_atual: produto.saldo_atual,
        formas: produto.formas,
        formaId: forma.id,
        qtdFormas: 1,
        precoForma: forma.preco,
        preco_unitario: 0,
        quantidade: 0,
        total: 0,
      }
      return [...prev, aplicarForma(base, forma.id, 1)]
    })
  }, [])

  const alterarQtdFormas = useCallback((produtoId: string, qtd: number) => {
    setItens((prev) =>
      prev.map((i) => (i.produto_id === produtoId ? aplicarForma(i, i.formaId, qtd, i.precoForma) : i)),
    )
  }, [])

  const alterarForma = useCallback((produtoId: string, formaId: string) => {
    setItens((prev) =>
      prev.map((i) => (i.produto_id === produtoId ? aplicarForma(i, formaId, i.qtdFormas) : i)),
    )
  }, [])

  const alterarPrecoForma = useCallback((produtoId: string, preco: number) => {
    setItens((prev) =>
      prev.map((i) => (i.produto_id === produtoId ? aplicarForma(i, i.formaId, i.qtdFormas, preco) : i)),
    )
  }, [])

  const alterarFormaCustom = useCallback((produtoId: string, unidades: number) => {
    setItens((prev) =>
      prev.map((i) => {
        if (i.produto_id !== produtoId) return i
        const customId = `custom-${i.produto_id}`
        const unidadeBase = i.formas.find((f) => f.unidades === 1)
        const precoSugerido = +(unidades * (unidadeBase?.preco ?? i.preco_unitario)).toFixed(2)
        const jaCustom = i.formaId === customId
        const formaCustom = {
          id: customId,
          nome: `Pacote ${unidades}`,
          unidades,
          preco: jaCustom ? i.precoForma : precoSugerido,
          padrao: false,
        }
        const formas = [...i.formas.filter((f) => f.id !== customId), formaCustom]
        return aplicarForma({ ...i, formas }, customId, i.qtdFormas, formaCustom.preco)
      }),
    )
  }, [])

  const remover = useCallback((produtoId: string) => {
    setItens((prev) => prev.filter((i) => i.produto_id !== produtoId))
  }, [])

  const total = itens.reduce((acc, i) => acc + i.total, 0)

  function salvar() {
    if (itens.length === 0) {
      toast.error('A venda precisa ter pelo menos 1 item')
      return
    }
    startTransition(async () => {
      const resultado = await editarVenda(
        pedidoId,
        itens.map((i) => ({
          produto_id: i.produto_id,
          quantidade: i.quantidade,
          preco_unitario: i.preco_unitario,
          total: i.total,
          embalagem_nome: i.formas.find((f) => f.id === i.formaId)?.nome,
          embalagem_unidades: i.formas.find((f) => f.id === i.formaId)?.unidades,
        })),
      )
      if (resultado.error) {
        toast.error(resultado.error)
        return
      }
      toast.success(`Venda ${numeroFmt} atualizada.`)
      router.push(`/pedidos/${pedidoId}`)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-5 py-5">
      <div className="flex items-center gap-3">
        <Link
          href={`/pedidos/${pedidoId}`}
          className="u-motion flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text-muted hover:bg-surface-2 hover:text-text"
          aria-label="Voltar"
        >
          <ArrowLeft className="size-4" strokeWidth={1.5} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">
            Editar venda {numeroFmt}
          </h1>
          <p className="text-sm text-text-muted">
            Adicione, remova ou mude a quantidade dos itens.
          </p>
        </div>
      </div>

      <BuscaProduto onAdicionar={adicionarItem} />

      {itens.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text-muted">
          Nenhum item. Busque um produto acima pra adicionar.
        </p>
      ) : (
        <ListaItensPedido
          itens={itens}
          onAlterarQtdFormas={alterarQtdFormas}
          onAlterarForma={alterarForma}
          onAlterarPrecoForma={alterarPrecoForma}
          onAlterarFormaCustom={alterarFormaCustom}
          onRemover={remover}
        />
      )}

      <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
        <span className="text-sm font-semibold text-text">Total</span>
        <span className="text-lg font-bold text-text">{formatarReal(total)}</span>
      </div>

      <button
        type="button"
        onClick={salvar}
        disabled={salvando}
        className="u-motion inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-primary-foreground hover:bg-brand-strong disabled:pointer-events-none disabled:opacity-50"
      >
        {salvando ? (
          <Loader2 className="size-4 animate-spin" strokeWidth={2} />
        ) : (
          <Save className="size-4" strokeWidth={1.75} />
        )}
        Salvar alterações
      </button>
    </div>
  )
}
