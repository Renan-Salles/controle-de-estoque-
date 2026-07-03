'use client'
import { useState, useCallback, useEffect, useMemo, useTransition, useRef } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  ReceiptText,
  ShoppingCart,
  CornerDownLeft,
  Loader2,
  Flame,
  Plus,
  CheckCircle2,
  Printer,
  Download,
  RefreshCw,
  PackageCheck,
  X,
} from 'lucide-react'
import { BuscaProduto, type ProdutoParaAdicionar } from '@/components/pedido/BuscaProduto'
import {
  BuscaCliente,
  type ClienteResumo,
} from '@/components/pedido/BuscaCliente'
import { ListaItensPedido } from '@/components/pedido/ListaItensPedido'
import { registrarVenda, buscarPedidoParaCupom } from '@/lib/actions/pedidos'
import { buscarClientePorId } from '@/lib/actions/clientes'
import { buscarMaisVendidos, type MaisVendido } from '@/lib/actions/produtos'
import { listarUsuariosComCargo, type UsuarioComCargo } from '@/lib/actions/cargos'
import { formatarReal, formatarData, addDias, hojeBrasil } from '@/lib/formatos'
import { rotuloPagamento } from '@/lib/pedido-labels'
import { Money } from '@/components/ui-kit/Money'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { CupomFiscal, type CupomData } from '@/components/romaneio/CupomFiscal'
import { cn } from '@/lib/utils'
import type { ItemPedido } from '@/types'

type FormaPagamentoVenda =
  | 'dinheiro'
  | 'pix'
  | 'cartao_debito'
  | 'cartao_credito'
  | 'fiado'

type TipoFulfillment = 'balcao' | 'entrega' | 'retirada'

const TIPOS_FULFILLMENT: Array<{ valor: TipoFulfillment; label: string }> = [
  { valor: 'balcao', label: 'Balcão' },
  { valor: 'entrega', label: 'Entrega' },
  { valor: 'retirada', label: 'Retirar depois' },
]

// Recalcula quantidade/preco_unitario/total (sempre em unidade base, é o que
// vai pro backend) a partir da forma de venda escolhida + qtd + preço da forma.
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

// SAIDA (venda). Reusa BuscaCliente/BuscaProduto/ListaItensPedido.
// Cliente OPCIONAL (venda de balcao), exceto quando fiado: ai e obrigatorio
// para saber de quem cobrar, e o prazo (dias) e escolhido aqui na hora.
export function FormSaida({ clienteIdInicial }: { clienteIdInicial?: string } = {}) {
  const [cliente, setCliente] = useState<ClienteResumo | null>(null)
  const [itens, setItens] = useState<ItemPedido[]>([])
  const [formaPagamento, setFormaPagamento] =
    useState<FormaPagamentoVenda>('dinheiro')
  const [prazoDias, setPrazoDias] = useState('7')
  const [observacoes, setObservacoes] = useState('')
  const [registrando, setRegistrando] = useState(false)
  const [maisVendidos, setMaisVendidos] = useState<MaisVendido[]>([])
  const [carregandoVendidos, setCarregandoVendidos] = useState(true)
  const [vendaRegistrada, setVendaRegistrada] = useState<{ pedidoId: string; numero: number } | null>(null)
  const [cupomData, setCupomData] = useState<CupomData | null>(null)
  const [mostrarCupom, setMostrarCupom] = useState(false)
  const [, startCupomTransition] = useTransition()
  const cupomRef = useRef<HTMLDivElement>(null)
  const [tipoFulfillment, setTipoFulfillment] = useState<TipoFulfillment>('balcao')
  const [entregadorId, setEntregadorId] = useState('')
  const [frete, setFrete] = useState('')
  const [jaPago, setJaPago] = useState(false)
  const [equipe, setEquipe] = useState<UsuarioComCargo[]>([])
  const [desconto, setDesconto] = useState('')
  const [recebido, setRecebido] = useState('')

  const subtotal = useMemo(
    () => itens.reduce((acc, i) => acc + i.total, 0),
    [itens],
  )
  const freteNum = tipoFulfillment === 'entrega' ? (Number(frete) || 0) : 0
  // Desconto vale sobre a mercadoria, nunca mais que o subtotal.
  const descontoNum = Math.min(Math.max(Number(desconto) || 0, 0), subtotal)
  const total = +(subtotal + freteNum - descontoNum).toFixed(2)
  const recebidoNum = Number(recebido) || 0
  const troco = recebidoNum > 0 ? +(recebidoNum - total).toFixed(2) : null
  const totalItens = useMemo(
    () => itens.reduce((acc, i) => acc + i.quantidade, 0),
    [itens],
  )

  const registrar = useCallback(async () => {
    if (!itens.length) {
      toast.error('Adicione pelo menos 1 produto')
      return
    }
    if (formaPagamento === 'fiado' && !cliente) {
      toast.error('Selecione um cliente para venda fiado')
      return
    }
    if (tipoFulfillment === 'entrega' && !entregadorId) {
      toast.error('Escolha quem vai entregar')
      return
    }
    setRegistrando(true)
    const resultado = await registrarVenda({
      cliente_id: cliente?.id ?? null,
      forma_pagamento: formaPagamento,
      prazo_dias: formaPagamento === 'fiado' ? Number(prazoDias) || 7 : undefined,
      observacoes,
      canal: 'balcao',
      itens: itens.map((i) => {
        const forma = i.formas.find((f) => f.id === i.formaId)
        return {
          produto_id: i.produto_id,
          quantidade: i.quantidade,
          preco_unitario: i.preco_unitario,
          total: i.total,
          embalagem_nome: forma?.nome,
          embalagem_unidades: forma?.unidades,
        }
      }),
      tipo_fulfillment: tipoFulfillment,
      entregador_id: tipoFulfillment === 'entrega' ? entregadorId : null,
      frete: freteNum,
      pago: tipoFulfillment === 'balcao' ? undefined : jaPago,
      desconto: descontoNum,
      valor_recebido:
        formaPagamento === 'dinheiro' && recebidoNum > 0 ? recebidoNum : undefined,
    })
    setRegistrando(false)
    if (resultado.error) {
      toast.error(resultado.error)
      return
    }
    const pedidoId = resultado.pedidoId!
    const numeroPedido = resultado.numeroPedido!
    setVendaRegistrada({ pedidoId, numero: numeroPedido })
    startCupomTransition(async () => {
      const data = await buscarPedidoParaCupom(pedidoId)
      if (data) {
        setCupomData(data as unknown as CupomData)
        setMostrarCupom(true)
      }
    })
  }, [cliente, itens, formaPagamento, prazoDias, observacoes, tipoFulfillment, entregadorId, freteNum, jaPago, descontoNum, recebidoNum])

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

  // Veio de "Nova venda" na página de um cliente (?cliente_id=...): pré-seleciona.
  useEffect(() => {
    if (!clienteIdInicial) return
    let ativo = true
    buscarClientePorId(clienteIdInicial).then((c) => {
      if (ativo && c) {
        setCliente({
          id: c.id,
          nome: c.nome,
          telefone: c.telefone,
          forma_pagamento_padrao: c.forma_pagamento_padrao,
          prazo_pagamento_dias: c.prazo_pagamento_dias,
        })
      }
    })
    return () => {
      ativo = false
    }
  }, [clienteIdInicial])

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

  // Equipe ativa, pra escolher quem vai entregar.
  useEffect(() => {
    let ativo = true
    listarUsuariosComCargo()
      .then((lista) => {
        if (ativo) setEquipe(lista.filter((u) => u.status === 'ativo'))
      })
      .catch(() => {
        if (ativo) setEquipe([])
      })
    return () => {
      ativo = false
    }
  }, [])

  const adicionarItem = useCallback(
    (produto: ProdutoParaAdicionar) => {
      setItens((prev) => {
        const existe = prev.find((i) => i.produto_id === produto.produto_id)
        if (existe) {
          // Repetir o produto soma 1 na forma que ja esta escolhida na linha.
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
    },
    [],
  )

  const alterarQtdFormas = useCallback((produtoId: string, qtd: number) => {
    setItens((prev) =>
      prev.map((i) =>
        i.produto_id === produtoId ? aplicarForma(i, i.formaId, qtd, i.precoForma) : i,
      ),
    )
  }, [])

  // Trocar a forma reseta o preco pro cadastrado dela (o operador reajusta
  // se negociou) e mantem a quantidade de embalagens.
  const alterarForma = useCallback((produtoId: string, formaId: string) => {
    setItens((prev) =>
      prev.map((i) =>
        i.produto_id === produtoId ? aplicarForma(i, formaId, i.qtdFormas) : i,
      ),
    )
  }, [])

  const alterarPrecoForma = useCallback((produtoId: string, preco: number) => {
    setItens((prev) =>
      prev.map((i) =>
        i.produto_id === produtoId ? aplicarForma(i, i.formaId, i.qtdFormas, preco) : i,
      ),
    )
  }, [])

  // Forma "Outra": pacote montado na hora (ex. meia caixa com 6). Upserta uma
  // forma custom na lista de formas do item e aplica. Preco sugerido =
  // unidades x preco unitario da forma Unidade; o operador ajusta ao lado.
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
          // Se ja esta no modo custom, muda so as unidades e mantem o preco
          // que o operador digitou; senao, entra com o preco sugerido.
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

  const podeRegistrar =
    itens.length > 0 &&
    !registrando &&
    !(formaPagamento === 'fiado' && !cliente) &&
    !(tipoFulfillment === 'entrega' && !entregadorId)

  function novaVenda() {
    setVendaRegistrada(null)
    setCupomData(null)
    setMostrarCupom(false)
    setCliente(null)
    setItens([])
    setFormaPagamento('dinheiro')
    setPrazoDias('7')
    setObservacoes('')
    setTipoFulfillment('balcao')
    setEntregadorId('')
    setFrete('')
    setJaPago(false)
    setDesconto('')
    setRecebido('')
  }

  // Ao trocar cliente ou marcar fiado, sugere o prazo cadastrado no cliente.
  function selecionarCliente(c: ClienteResumo) {
    setCliente(c)
    if (formaPagamento === 'fiado' && c.prazo_pagamento_dias) {
      setPrazoDias(String(c.prazo_pagamento_dias))
    }
  }

  function selecionarFormaPagamento(v: FormaPagamentoVenda) {
    setFormaPagamento(v)
    if (v === 'fiado' && cliente?.prazo_pagamento_dias) {
      setPrazoDias(String(cliente.prazo_pagamento_dias))
    }
  }

  function imprimirCupom() {
    window.print()
  }

  function baixarPdf() {
    if (!vendaRegistrada) return
    const original = document.title
    document.title = `Cupom-${String(vendaRegistrada.numero).padStart(4, '0')}`
    window.print()
    setTimeout(() => { document.title = original }, 1000)
  }

  if (vendaRegistrada) {
    return (
      <>
        {/* CSS injetado apenas quando o cupom existe */}
        {mostrarCupom && (
          <style>{`
            @page { size: 80mm auto; margin: 0 !important; }
            @media print {
              body * { visibility: hidden !important; }
              .cupom-print-area,
              .cupom-print-area * { visibility: visible !important; }
              .cupom-print-area {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 80mm !important;
                background: white !important;
              }
            }
          `}</style>
        )}

        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 py-8">
          {/* Header de sucesso */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-ok/10">
              <CheckCircle2 className="size-7 text-ok" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-xl font-bold text-text">
                Venda #{String(vendaRegistrada.numero).padStart(4, '0')} registrada!
              </p>
              <p className="mt-1 text-sm text-text-muted">
                {cliente ? `Cliente: ${cliente.nome}` : 'Venda de balcão'}
              </p>
            </div>
          </div>

          {/* Cupom fiscal inline */}
          {mostrarCupom && cupomData ? (
            <div className="w-full max-w-xs">
              {/* Barra de ações do cupom */}
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  Cupom fiscal
                </span>
                <button
                  type="button"
                  onClick={() => setMostrarCupom(false)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted hover:bg-surface-2 hover:text-text"
                >
                  <X className="size-3" strokeWidth={1.5} />
                  Fechar
                </button>
              </div>

              {/* Área do cupom com fundo papel */}
              <div
                ref={cupomRef}
                className="cupom-print-area rounded-lg border border-border shadow-sm"
                style={{ background: '#fafaf9' }}
              >
                <CupomFiscal data={cupomData} />
              </div>

              {/* Botões de impressão */}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={imprimirCupom}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-brand-strong"
                >
                  <Printer className="size-4" strokeWidth={1.5} />
                  Imprimir
                </button>
                <button
                  type="button"
                  onClick={baixarPdf}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-text hover:bg-surface-2"
                >
                  <Download className="size-4" strokeWidth={1.5} />
                  Baixar PDF
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setMostrarCupom(true)}
              disabled={!cupomData}
              className="flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-brand-strong disabled:opacity-50"
            >
              <Printer className="size-4" strokeWidth={1.5} />
              {cupomData ? 'Ver cupom' : 'Carregando cupom...'}
            </button>
          )}

          <div className="flex items-center gap-2">
            <Link
              href={`/pedidos/${vendaRegistrada.pedidoId}`}
              className="flex items-center gap-2 rounded-xl border border-border bg-surface px-6 py-3 text-sm font-semibold text-text hover:bg-surface-2"
            >
              <PackageCheck className="size-4" strokeWidth={1.5} />
              Ver pedido
            </Link>
            <button
              type="button"
              onClick={novaVenda}
              className="flex items-center gap-2 rounded-xl border border-border bg-surface px-6 py-3 text-sm font-semibold text-text hover:bg-surface-2"
            >
              <RefreshCw className="size-4" strokeWidth={1.5} />
              Nova venda
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
      {/* ESQUERDA — area de trabalho */}
      <section className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Cliente {formaPagamento === 'fiado' ? '(obrigatório p/ fiado)' : '(opcional)'}
          </label>
          <BuscaCliente selecionado={cliente} onSelecionar={selecionarCliente} />
          <p className="text-xs text-text-muted">
            Venda de balcão pode ficar sem cliente identificado.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Tipo
          </label>
          <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-border bg-surface p-1">
            {TIPOS_FULFILLMENT.map((t) => (
              <button
                key={t.valor}
                type="button"
                onClick={() => setTipoFulfillment(t.valor)}
                className={cn(
                  'u-motion rounded-md px-3 py-1.5 text-sm font-medium',
                  tipoFulfillment === t.valor
                    ? 'bg-brand text-primary-foreground'
                    : 'text-text-muted hover:bg-surface-2 hover:text-text',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tipoFulfillment === 'entrega' && (
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Quem vai entregar
            </label>
            <Select value={entregadorId} onValueChange={(v) => v && setEntregadorId(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione...">
                  {(v: string) => equipe.find((u) => u.id === v)?.nome ?? v}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {equipe.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {tipoFulfillment === 'entrega' && (
          <div className="flex flex-col gap-2">
            <label
              htmlFor="frete"
              className="text-[11px] font-semibold uppercase tracking-wider text-text-muted"
            >
              Frete (R$)
            </label>
            <input
              id="frete"
              type="number"
              step="0.01"
              min="0"
              value={frete}
              onChange={(e) => setFrete(e.target.value)}
              placeholder="0,00"
              className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </div>
        )}

        {(tipoFulfillment === 'entrega' || tipoFulfillment === 'retirada') && (
          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={jaPago}
              onChange={(e) => setJaPago(e.target.checked)}
              className="size-4 rounded border-border"
            />
            Já foi pago
          </label>
        )}

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
                        formas:
                          p.formas.length > 0
                            ? p.formas
                            : [{ id: `fallback-${p.id}`, nome: 'Unidade', unidades: 1, preco: p.preco_venda_padrao, padrao: true }],
                        embalagem: p.embalagem,
                        fator_conversao: p.fator_conversao,
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
              onAlterarQtdFormas={alterarQtdFormas}
              onAlterarForma={alterarForma}
              onAlterarPrecoForma={alterarPrecoForma}
              onAlterarFormaCustom={alterarFormaCustom}
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
                v && selecionarFormaPagamento(v as FormaPagamentoVenda)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue>{(v: string) => rotuloPagamento(v)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="cartao_debito">Cartão débito</SelectItem>
                <SelectItem value="cartao_credito">Cartão crédito</SelectItem>
                <SelectItem value="fiado">Fiado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formaPagamento === 'fiado' && (
            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-warn/30 bg-warn/[0.06] p-3">
              {!cliente ? (
                <p className="text-xs font-medium text-warn">
                  Selecione um cliente acima para venda fiado.
                </p>
              ) : (
                <>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Prazo para pagamento (dias)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={prazoDias}
                    onChange={(e) => setPrazoDias(e.target.value)}
                    className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-ring/50"
                  />
                  <p className="text-xs text-text-muted">
                    Vence em{' '}
                    {formatarData(addDias(hojeBrasil(), Number(prazoDias) || 0))}
                  </p>
                </>
              )}
            </div>
          )}

          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-sm text-text-muted">Subtotal</span>
            <Money valor={subtotal} className="text-sm text-text-muted" />
          </div>
          {freteNum > 0 && (
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-sm text-text-muted">Frete</span>
              <Money valor={freteNum} className="text-sm text-text-muted" />
            </div>
          )}

          {/* Desconto em R$ (mercadoria) */}
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-sm text-text-muted">Desconto</span>
            <div className="inline-flex h-8 items-center rounded-lg border border-border bg-bg pl-2">
              <span className="font-mono text-xs text-text-muted">R$</span>
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={desconto}
                placeholder="0,00"
                onChange={(e) => setDesconto(e.target.value)}
                className="h-8 w-20 bg-transparent px-2 text-right font-mono text-sm tabular-nums text-text outline-none placeholder:text-text-muted/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                aria-label="Desconto em reais"
              />
            </div>
          </div>

          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-base font-semibold text-text">Total</span>
            <Money valor={total} destaque className="text-2xl font-semibold" />
          </div>

          {/* Troco: so venda em dinheiro */}
          {formaPagamento === 'dinheiro' && itens.length > 0 && (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-surface-2/60 px-3 py-2">
              <div className="inline-flex h-8 items-center gap-2">
                <span className="text-sm text-text-muted">Recebido</span>
                <div className="inline-flex h-8 items-center rounded-lg border border-border bg-bg pl-2">
                  <span className="font-mono text-xs text-text-muted">R$</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={recebido}
                    placeholder="0,00"
                    onChange={(e) => setRecebido(e.target.value)}
                    className="h-8 w-20 bg-transparent px-2 text-right font-mono text-sm tabular-nums text-text outline-none placeholder:text-text-muted/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    aria-label="Valor recebido em dinheiro"
                  />
                </div>
              </div>
              {troco != null && (
                <span
                  className={cn(
                    'font-mono text-sm font-bold tabular-nums',
                    troco >= 0 ? 'text-ok' : 'text-err',
                  )}
                >
                  {troco >= 0 ? `Troco ${formatarReal(troco)}` : `Falta ${formatarReal(-troco)}`}
                </span>
              )}
            </div>
          )}

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
