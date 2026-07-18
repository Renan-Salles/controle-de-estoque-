'use client'
import { useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { BuscaProduto, type ProdutoParaAdicionar } from '@/components/pedido/BuscaProduto'
import { BuscaCliente, type ClienteResumo } from '@/components/pedido/BuscaCliente'
import { ListaItensPedido } from '@/components/pedido/ListaItensPedido'
import { SeletorPagamento, type ValorPagamento } from '@/components/pedido/SeletorPagamento'
import { CamposEntrega, type ValorEntrega } from '@/components/pedido/CamposEntrega'
import { Money } from '@/components/ui-kit/Money'
import { editarVenda, type PedidoParaEditar } from '@/lib/actions/pedidos'
import type { UsuarioComCargo } from '@/lib/actions/cargos'
import type { ItemPedido } from '@/types'

function aplicarForma(item: ItemPedido, formaId: string, qtdFormas: number, precoForma?: number): ItemPedido {
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
  dados,
  equipe,
}: {
  pedidoId: string
  numeroPedido: number
  dados: PedidoParaEditar
  equipe: UsuarioComCargo[]
}) {
  const router = useRouter()
  const [itens, setItens] = useState<ItemPedido[]>(dados.itens)
  const [cliente, setCliente] = useState<ClienteResumo | null>(
    dados.cliente
      ? {
          id: dados.cliente.id,
          nome: dados.cliente.nome,
          telefone: dados.cliente.telefone,
          forma_pagamento_padrao: dados.cliente.forma_pagamento_padrao,
          prazo_pagamento_dias: dados.cliente.prazo_pagamento_dias ?? undefined,
          endereco: dados.cliente.endereco,
        }
      : null,
  )
  const [desconto, setDesconto] = useState(dados.desconto_total ? String(dados.desconto_total) : '')
  const [pagamento, setPagamento] = useState<ValorPagamento>({
    formaPagamento: dados.forma_pagamento as ValorPagamento['formaPagamento'],
    prazoDias: String(dados.prazo_pagamento_dias || 7),
    dividir: !!dados.forma_pagamento_secundaria,
    formaPagamentoSecundaria: (dados.forma_pagamento_secundaria ?? 'pix') as ValorPagamento['formaPagamentoSecundaria'],
    valorSecundario: dados.valor_secundario ? String(dados.valor_secundario) : '',
    recebido: '',
  })
  const [entrega, setEntrega] = useState<ValorEntrega>({
    tipoFulfillment: dados.tipo_fulfillment as ValorEntrega['tipoFulfillment'],
    entregadorId: dados.entregador_id ?? '',
    frete: dados.frete ? String(dados.frete) : '',
    jaPago: false,
    enderecoRua: dados.endereco_entrega?.rua ?? '',
    enderecoNumero: dados.endereco_entrega?.numero ?? '',
    enderecoBairro: dados.endereco_entrega?.bairro ?? '',
    enderecoCidade: dados.endereco_entrega?.cidade ?? '',
  })
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
    setItens((prev) => prev.map((i) => (i.produto_id === produtoId ? aplicarForma(i, i.formaId, qtd, i.precoForma) : i)))
  }, [])

  const alterarForma = useCallback((produtoId: string, formaId: string) => {
    setItens((prev) => prev.map((i) => (i.produto_id === produtoId ? aplicarForma(i, formaId, i.qtdFormas) : i)))
  }, [])

  const alterarPrecoForma = useCallback((produtoId: string, preco: number) => {
    setItens((prev) => prev.map((i) => (i.produto_id === produtoId ? aplicarForma(i, i.formaId, i.qtdFormas, preco) : i)))
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

  const subtotal = itens.reduce((acc, i) => acc + i.total, 0)
  const freteNum = entrega.tipoFulfillment === 'entrega' ? Number(entrega.frete) || 0 : 0
  const descontoNum = Math.min(Math.max(Number(desconto) || 0, 0), subtotal)
  const total = +(subtotal + freteNum - descontoNum).toFixed(2)

  function salvar() {
    if (itens.length === 0) {
      toast.error('A venda precisa ter pelo menos 1 item')
      return
    }
    if (pagamento.formaPagamento === 'fiado' && !cliente) {
      toast.error('Selecione um cliente para venda fiado')
      return
    }
    if (pagamento.dividir && pagamento.formaPagamentoSecundaria === 'fiado' && !cliente) {
      toast.error('Selecione um cliente para venda fiado')
      return
    }
    if (pagamento.dividir && pagamento.formaPagamentoSecundaria === pagamento.formaPagamento) {
      toast.error('As duas formas de pagamento precisam ser diferentes')
      return
    }
    startTransition(async () => {
      const resultado = await editarVenda(pedidoId, {
        itens: itens.map((i) => ({
          produto_id: i.produto_id,
          quantidade: i.quantidade,
          preco_unitario: i.preco_unitario,
          total: i.total,
          embalagem_nome: i.formas.find((f) => f.id === i.formaId)?.nome,
          embalagem_unidades: i.formas.find((f) => f.id === i.formaId)?.unidades,
        })),
        cliente_id: cliente?.id ?? null,
        forma_pagamento: pagamento.formaPagamento,
        forma_pagamento_secundaria: pagamento.dividir ? pagamento.formaPagamentoSecundaria : undefined,
        valor_secundario: pagamento.dividir ? Number(pagamento.valorSecundario) || 0 : undefined,
        prazo_dias: pagamento.formaPagamento === 'fiado' ? Number(pagamento.prazoDias) || 7 : undefined,
        frete: freteNum,
        desconto: descontoNum,
        tipo_fulfillment: entrega.tipoFulfillment,
        entregador_id: entrega.tipoFulfillment === 'entrega' && entrega.entregadorId ? entrega.entregadorId : null,
        endereco_entrega:
          entrega.tipoFulfillment === 'entrega' && !cliente
            ? {
                rua: entrega.enderecoRua || undefined,
                numero: entrega.enderecoNumero || undefined,
                bairro: entrega.enderecoBairro || undefined,
                cidade: entrega.enderecoCidade || undefined,
              }
            : undefined,
      })
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
          <h1 className="text-xl font-semibold tracking-tight text-text">Editar venda {numeroFmt}</h1>
          <p className="text-sm text-text-muted">Mude qualquer dado da venda: itens, pagamento, cliente, entrega.</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          Cliente {pagamento.formaPagamento === 'fiado' ? '(obrigatório p/ fiado)' : '(opcional)'}
        </label>
        <BuscaCliente selecionado={cliente} onSelecionar={setCliente} />
      </div>

      <CamposEntrega cliente={cliente} equipe={equipe} value={entrega} onChange={setEntrega} />

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

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-text-muted">Subtotal</span>
          <Money valor={subtotal} className="text-sm text-text-muted" />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-text-muted">Desconto</span>
          <div className="inline-flex h-8 items-center rounded-lg border border-border bg-bg pl-2">
            <span className="font-mono text-xs text-text-muted">R$</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={desconto}
              placeholder="0,00"
              onChange={(e) => setDesconto(e.target.value)}
              className="h-8 w-20 bg-transparent px-2 text-right font-mono text-sm tabular-nums text-text outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              aria-label="Desconto em reais"
            />
          </div>
        </div>
        {freteNum > 0 && (
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-text-muted">Frete</span>
            <Money valor={freteNum} className="text-sm text-text-muted" />
          </div>
        )}
        <div className="flex items-baseline justify-between border-t border-border pt-2">
          <span className="text-sm font-semibold text-text">Total</span>
          <Money valor={total} destaque className="text-lg font-semibold" />
        </div>
      </div>

      <SeletorPagamento cliente={cliente} total={total} value={pagamento} onChange={setPagamento} />

      <button
        type="button"
        onClick={salvar}
        disabled={salvando}
        className="u-motion inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-primary-foreground hover:bg-brand-strong disabled:pointer-events-none disabled:opacity-50"
      >
        {salvando ? <Loader2 className="size-4 animate-spin" strokeWidth={2} /> : <Save className="size-4" strokeWidth={1.75} />}
        Salvar alterações
      </button>
    </div>
  )
}
