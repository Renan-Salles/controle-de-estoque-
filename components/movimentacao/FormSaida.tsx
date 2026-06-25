'use client'
import { useState, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ReceiptText,
  ShoppingCart,
  CornerDownLeft,
  Loader2,
  Flame,
  Plus,
} from 'lucide-react'
import { BuscaProduto } from '@/components/pedido/BuscaProduto'
import {
  BuscaCliente,
  type ClienteResumo,
} from '@/components/pedido/BuscaCliente'
import { ListaItensPedido } from '@/components/pedido/ListaItensPedido'
import { registrarVenda } from '@/lib/actions/pedidos'
import { buscarMaisVendidos, type MaisVendido } from '@/lib/actions/produtos'
import { formatarReal } from '@/lib/formatos'
import { Money } from '@/components/ui-kit/Money'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { ItemPedido } from '@/types'

type FormaPagamentoVenda =
  | 'dinheiro'
  | 'pix'
  | 'cartao_debito'
  | 'cartao_credito'

// SAIDA (venda a vista). Reusa BuscaCliente/BuscaProduto/ListaItensPedido.
// Cliente OPCIONAL (venda de balcao). Sem fiado, sem prazo, sem ciclo de entrega.
export function FormSaida() {
  const router = useRouter()
  const [cliente, setCliente] = useState<ClienteResumo | null>(null)
  const [itens, setItens] = useState<ItemPedido[]>([])
  const [formaPagamento, setFormaPagamento] =
    useState<FormaPagamentoVenda>('dinheiro')
  const [observacoes, setObservacoes] = useState('')
  const [registrando, setRegistrando] = useState(false)
  const [maisVendidos, setMaisVendidos] = useState<MaisVendido[]>([])
  const [carregandoVendidos, setCarregandoVendidos] = useState(true)

  const total = useMemo(
    () => itens.reduce((acc, i) => acc + i.total, 0),
    [itens],
  )
  const totalItens = useMemo(
    () => itens.reduce((acc, i) => acc + i.quantidade, 0),
    [itens],
  )

  const registrar = useCallback(async () => {
    if (!itens.length) {
      toast.error('Adicione pelo menos 1 produto')
      return
    }
    setRegistrando(true)
    const resultado = await registrarVenda({
      cliente_id: cliente?.id ?? null,
      forma_pagamento: formaPagamento,
      observacoes,
      canal: 'balcao',
      itens: itens.map((i) => ({
        produto_id: i.produto_id,
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
        total: i.total,
      })),
    })
    setRegistrando(false)
    if (resultado.error) {
      toast.error(resultado.error)
      return
    }
    toast.success(`Venda #${resultado.numeroPedido} registrada`)
    router.push(`/pedidos/${resultado.pedidoId}/romaneio`)
  }, [cliente, itens, formaPagamento, observacoes, router])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault()
        registrar()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [registrar])

  // Atalho de balcao: carrega os mais vendidos do local na montagem.
  useEffect(() => {
    let ativo = true
    buscarMaisVendidos()
      .then((lista) => {
        if (ativo) setMaisVendidos(lista)
      })
      .catch(() => {
        if (ativo) setMaisVendidos([])
      })
      .finally(() => {
        if (ativo) setCarregandoVendidos(false)
      })
    return () => {
      ativo = false
    }
  }, [])

  const adicionarItem = useCallback(
    (produto: Omit<ItemPedido, 'quantidade' | 'total'>) => {
      setItens((prev) => {
        const existe = prev.find((i) => i.produto_id === produto.produto_id)
        if (existe) {
          return prev.map((i) =>
            i.produto_id === produto.produto_id
              ? {
                  ...i,
                  quantidade: i.quantidade + 1,
                  total: (i.quantidade + 1) * i.preco_unitario,
                }
              : i,
          )
        }
        return [
          ...prev,
          { ...produto, quantidade: 1, total: produto.preco_unitario },
        ]
      })
    },
    [],
  )

  const alterarQtde = useCallback((produtoId: string, qtde: number) => {
    setItens((prev) =>
      prev.map((i) =>
        i.produto_id === produtoId
          ? { ...i, quantidade: qtde, total: qtde * i.preco_unitario }
          : i,
      ),
    )
  }, [])

  const remover = useCallback((produtoId: string) => {
    setItens((prev) => prev.filter((i) => i.produto_id !== produtoId))
  }, [])

  const podeRegistrar = itens.length > 0 && !registrando

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
      {/* ESQUERDA — area de trabalho */}
      <section className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Cliente (opcional)
          </label>
          <BuscaCliente selecionado={cliente} onSelecionar={setCliente} />
          <p className="text-xs text-text-muted">
            Venda de balcão pode ficar sem cliente identificado.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Produtos
          </label>
          <BuscaProduto onAdicionar={adicionarItem} />
          <p className="text-xs text-text-muted">
            Cada produto buscado entra na comanda à direita. Repetir um item soma
            a quantidade.
          </p>

          {/* Atalho dos mais vendidos: toque rápido no balcão */}
          {!carregandoVendidos && maisVendidos.length > 0 && (
            <div className="mt-1.5 flex flex-col gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                <Flame className="size-3.5 text-brand" strokeWidth={1.5} />
                Mais vendidos
              </span>
              <div className="flex flex-wrap gap-2">
                {maisVendidos.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      adicionarItem({
                        produto_id: p.id,
                        nome: p.nome,
                        categoria: p.categoria,
                        preco_unitario: p.preco_venda_padrao,
                        saldo_atual: p.saldo_atual,
                      })
                    }
                    className="u-motion group inline-flex items-center gap-2 rounded-lg border border-border bg-surface py-1.5 pl-2.5 pr-3 text-left hover:border-brand/50 hover:bg-surface-2 active:scale-[0.98]"
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-surface-2 text-text-muted group-hover:bg-brand group-hover:text-primary-foreground">
                      <Plus className="size-3" strokeWidth={2} />
                    </span>
                    <span className="max-w-[14rem] truncate text-sm font-medium text-text">
                      {p.nome}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-text-muted">
                      {formatarReal(p.preco_venda_padrao)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Observações
          </label>
          <Textarea
            placeholder="Ex.: troco para R$ 50, retirar amanhã..."
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={3}
          />
        </div>
      </section>

      {/* DIREITA — comanda */}
      <aside className="flex min-h-0 flex-col rounded-xl border border-border bg-surface lg:sticky lg:top-2 lg:max-h-[calc(100dvh-8rem)]">
        <header className="flex items-center justify-between border-b border-border px-4 py-3.5">
          <div className="flex items-center gap-2">
            <ReceiptText className="size-4 text-brand" strokeWidth={1.5} />
            <h2 className="text-sm font-semibold tracking-tight text-text">
              Comanda
            </h2>
          </div>
          {itens.length > 0 && (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[11px] tabular-nums text-text-muted">
              {totalItens} {totalItens === 1 ? 'item' : 'itens'}
            </span>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {itens.length === 0 ? (
            <div className="flex h-full min-h-48 flex-col items-center justify-center px-6 py-12 text-center">
              <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-surface-2 text-text-muted">
                <ShoppingCart className="size-5" strokeWidth={1.5} />
              </span>
              <p className="text-sm font-medium text-text">Comanda vazia</p>
              <p className="mt-1 max-w-[16rem] text-[13px] leading-relaxed text-text-muted">
                Busque um produto para começar.
              </p>
            </div>
          ) : (
            <ListaItensPedido
              itens={itens}
              onAlterarQtde={alterarQtde}
              onRemover={remover}
            />
          )}
        </div>

        <div className="border-t border-border bg-surface px-4 pb-4 pt-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Forma de pagamento
            </label>
            <Select
              value={formaPagamento}
              onValueChange={(v) =>
                v && setFormaPagamento(v as FormaPagamentoVenda)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="cartao_debito">Cartão débito</SelectItem>
                <SelectItem value="cartao_credito">Cartão crédito</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-sm text-text-muted">Subtotal</span>
            <Money valor={total} className="text-sm text-text-muted" />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-base font-semibold text-text">Total</span>
            <Money valor={total} destaque className="text-2xl font-semibold" />
          </div>

          <button
            type="button"
            onClick={registrar}
            disabled={!podeRegistrar}
            className="u-motion mt-4 flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-base font-semibold text-primary-foreground hover:bg-brand-strong focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
          >
            {registrando ? (
              <>
                <Loader2 className="size-5 animate-spin" strokeWidth={2} />
                Registrando...
              </>
            ) : (
              <>
                Registrar venda e imprimir
                <kbd className="inline-flex items-center gap-1 rounded border border-primary-foreground/30 px-1.5 py-0.5 font-mono text-[11px] font-normal text-primary-foreground/80">
                  Ctrl
                  <CornerDownLeft className="size-3" strokeWidth={2} />
                </kbd>
              </>
            )}
          </button>
        </div>
      </aside>
    </div>
  )
}
