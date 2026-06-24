'use client'
import { useState, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ReceiptText,
  ShoppingCart,
  CornerDownLeft,
  Loader2,
} from 'lucide-react'
import { BuscaProduto } from '@/components/pedido/BuscaProduto'
import { BuscaCliente, type ClienteResumo } from '@/components/pedido/BuscaCliente'
import { ListaItensPedido } from '@/components/pedido/ListaItensPedido'
import { confirmarPedido } from '@/lib/actions/pedidos'
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

export default function NovoPedidoPage() {
  const router = useRouter()
  const [cliente, setCliente] = useState<ClienteResumo | null>(null)
  const [itens, setItens] = useState<ItemPedido[]>([])
  const [formaPagamento, setFormaPagamento] = useState('dinheiro')
  const [prazoDias, setPrazoDias] = useState('0')
  const [observacoes, setObservacoes] = useState('')
  const [confirmando, setConfirmando] = useState(false)

  const total = useMemo(
    () => itens.reduce((acc, i) => acc + i.total, 0),
    [itens],
  )
  const totalItens = useMemo(
    () => itens.reduce((acc, i) => acc + i.quantidade, 0),
    [itens],
  )

  const confirmar = useCallback(async () => {
    if (!cliente) {
      toast.error('Selecione um cliente')
      return
    }
    if (!itens.length) {
      toast.error('Adicione pelo menos 1 produto')
      return
    }
    setConfirmando(true)
    const resultado = await confirmarPedido({
      cliente_id: cliente.id,
      forma_pagamento: formaPagamento,
      prazo_pagamento_dias: Number(prazoDias),
      observacoes,
      canal: 'telefone',
      itens: itens.map((i) => ({
        produto_id: i.produto_id,
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
        total: i.total,
      })),
    })
    setConfirmando(false)
    if (resultado.error) {
      toast.error(resultado.error)
      return
    }
    toast.success(`Pedido #${resultado.numeroPedido} confirmado`)
    router.push(`/pedidos/${resultado.pedidoId}/romaneio`)
  }, [cliente, itens, formaPagamento, prazoDias, observacoes, router])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault()
        confirmar()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmar])

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
        return [...prev, { ...produto, quantidade: 1, total: produto.preco_unitario }]
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

  const podeConfirmar = !!cliente && itens.length > 0 && !confirmando

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:h-[calc(100dvh-7rem)] lg:grid-cols-[1fr_400px]">
      {/* ESQUERDA — área de trabalho do operador */}
      <section className="flex min-w-0 flex-col gap-5 lg:overflow-y-auto lg:pr-1">
        <div className="flex items-center gap-3">
          <Link
            href="/pedidos"
            className="u-motion flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text-muted hover:bg-surface-2 hover:text-text active:scale-95"
            aria-label="Voltar para pedidos"
          >
            <ArrowLeft className="size-4" strokeWidth={1.5} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-text">
              Novo pedido
            </h1>
            <p className="text-sm text-text-muted">
              Venda no balcão ou telefone
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Cliente
          </label>
          <BuscaCliente selecionado={cliente} onSelecionar={setCliente} />
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
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Observações
          </label>
          <Textarea
            placeholder="Ex.: entregar após as 18h, deixar na portaria..."
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={3}
          />
        </div>
      </section>

      {/* DIREITA — comanda / resumo */}
      <aside className="flex min-h-0 flex-col rounded-xl border border-border bg-surface lg:overflow-hidden">
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
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Pagamento
              </label>
              <Select
                value={formaPagamento}
                onValueChange={(v) => v && setFormaPagamento(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="pix">Pix</SelectItem>
                  <SelectItem value="fiado">Fiado</SelectItem>
                  <SelectItem value="cartao_debito">Cartão débito</SelectItem>
                  <SelectItem value="cartao_credito">Cartão crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Prazo
              </label>
              <Select value={prazoDias} onValueChange={(v) => v && setPrazoDias(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">À vista</SelectItem>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="15">15 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
            onClick={confirmar}
            disabled={!podeConfirmar}
            className="u-motion mt-4 flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-base font-semibold text-primary-foreground hover:bg-brand-strong focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
          >
            {confirmando ? (
              <>
                <Loader2 className="size-5 animate-spin" strokeWidth={2} />
                Confirmando...
              </>
            ) : (
              <>
                Confirmar e imprimir
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
