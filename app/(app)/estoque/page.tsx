'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  Plus,
  PackagePlus,
  Boxes,
  SlidersHorizontal,
  ClipboardCheck,
  ShoppingBasket,
  Trash2,
  ArrowRightLeft,
} from 'lucide-react'
import { TransferirDialog } from '@/components/estoque/TransferirDialog'
import { dadosTransferencia } from '@/lib/actions/transferencias'
import {
  buscarPosicaoEstoque,
  darEntrada,
  ajustarEstoque,
  buscarReposicao,
  listarVencendo,
  type ItemVencendo,
} from '@/lib/actions/estoque'
import type { PosicaoEstoque } from '@/types'
import { PageHeader } from '@/components/ui-kit/PageHeader'
import { EstoqueTabs } from '@/components/estoque/EstoqueTabs'
import {
  Tabela,
  TabelaHead,
  TabelaHeadCell,
  TabelaBody,
  TabelaRow,
  TabelaCell,
} from '@/components/ui-kit/tabela'
import { StatusPill } from '@/components/ui-kit/StatusPill'
import { EstadoVazio } from '@/components/ui-kit/EstadoVazio'
import { SkeletonLinhas } from '@/components/ui-kit/SkeletonLinhas'
import { Money } from '@/components/ui-kit/Money'
import { CardLinha } from '@/components/ui-kit/CardLinha'
import { formatarNumero } from '@/lib/formatos'

type TipoAjuste = 'perda' | 'quebra' | 'vencimento' | 'cortesia' | 'acerto'

const TIPOS_AJUSTE: Array<{ valor: TipoAjuste; label: string }> = [
  { valor: 'perda', label: 'Perda' },
  { valor: 'quebra', label: 'Quebra' },
  { valor: 'vencimento', label: 'Vencido' },
  { valor: 'cortesia', label: 'Cortesia' },
  { valor: 'acerto', label: 'Acerto de inventário' },
]

type Filtro = 'todos' | 'critico' | 'ruptura'

const FILTROS: Array<{ valor: Filtro; label: string }> = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'critico', label: 'Crítico' },
  { valor: 'ruptura', label: 'Ruptura' },
]

export default function EstoquePage() {
  // Vem do atalho do dashboard (ex.: /estoque?filtro=critico): já abre filtrado.
  const params = useSearchParams()
  const filtroUrl = params.get('filtro')
  const filtroInicial: Filtro =
    filtroUrl === 'critico' || filtroUrl === 'ruptura' ? filtroUrl : 'todos'

  // Lista filtrada (tabela) e lista completa (resumo do topo).
  const [estoque, setEstoque] = useState<PosicaoEstoque[]>([])
  const [completo, setCompleto] = useState<PosicaoEstoque[]>([])
  const [filtro, setFiltro] = useState<Filtro>(filtroInicial)
  const [loading, setLoading] = useState(true)
  const [produtoSelecionado, setProdutoSelecionado] = useState<PosicaoEstoque | null>(null)
  const [quantidade, setQuantidade] = useState('')
  const [custo, setCusto] = useState('')
  const [saving, setSaving] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  // Ajuste de estoque (perda/quebra/vencido/cortesia/acerto)
  const [produtoAjuste, setProdutoAjuste] = useState<PosicaoEstoque | null>(null)
  const [tipoAjuste, setTipoAjuste] = useState<TipoAjuste>('perda')
  const [qtdAjuste, setQtdAjuste] = useState('')
  const [obsAjuste, setObsAjuste] = useState('')
  const [ajustando, setAjustando] = useState(false)
  const [ajusteOpen, setAjusteOpen] = useState(false)
  // Contagem de itens acabando (badge no botão de reposição)
  const [reposicaoCount, setReposicaoCount] = useState<number | null>(null)
  const [vencendo, setVencendo] = useState<ItemVencendo[]>([])
  const [destinos, setDestinos] = useState<{ id: string; nome: string }[]>([])
  const [transferindo, setTransferindo] = useState<{ id: string; nome: string; saldo: number } | null>(null)

  async function carregar(f: Filtro = filtro) {
    setLoading(true)
    try {
      const [dados, todos] = await Promise.all([
        buscarPosicaoEstoque(f),
        f === 'todos' ? Promise.resolve(null) : buscarPosicaoEstoque('todos'),
      ])
      const lista = dados as PosicaoEstoque[]
      setEstoque(lista)
      setCompleto((todos as PosicaoEstoque[] | null) ?? lista)
    } catch (e) {
      console.error('Erro ao carregar estoque:', e)
      toast.error('Erro ao carregar estoque')
    } finally {
      setLoading(false)
    }
  }

  async function carregarReposicaoCount() {
    try {
      const itens = (await buscarReposicao()) as unknown[]
      setReposicaoCount(itens.length)
    } catch {
      setReposicaoCount(null)
    }
  }

  async function carregarVencendo() {
    try {
      setVencendo(await listarVencendo())
    } catch {
      setVencendo([])
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar(filtroInicial)
    carregarReposicaoCount()
    carregarVencendo()
    // Transferencia: so admin com mais de 1 local ve o botao.
    dadosTransferencia()
      .then((d) => setDestinos(d.admin ? d.destinos : []))
      .catch(() => setDestinos([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function trocarFiltro(valor: string | null) {
    const f = (valor ?? 'todos') as Filtro
    setFiltro(f)
    carregar(f)
  }

  // Resumo do topo: sempre sobre o inventário completo.
  const resumo = useMemo(() => {
    const totalSkus = completo.length
    const valorTotal = completo.reduce((acc, p) => acc + (p.valor_total ?? 0), 0)
    const criticos = completo.filter(
      (p) => p.status_estoque === 'critico' || p.status_estoque === 'ruptura',
    ).length
    return { totalSkus, valorTotal, criticos }
  }, [completo])

  function abrirEntrada(p: PosicaoEstoque) {
    setProdutoSelecionado(p)
    setQuantidade('')
    setCusto('')
    setSheetOpen(true)
  }

  const qtdNum = Number(quantidade)
  const custoNum = Number(custo)
  const entradaValida = qtdNum > 0 && custoNum >= 0 && quantidade !== ''

  async function handleEntrada() {
    if (!produtoSelecionado || !entradaValida) return
    setSaving(true)
    const resultado = await darEntrada({
      produto_id: produtoSelecionado.id,
      quantidade: qtdNum,
      custo_unitario: custoNum,
    })
    setSaving(false)
    if (resultado.error) {
      toast.error(resultado.error)
      return
    }
    toast.success('Entrada registrada')
    setSheetOpen(false)
    setProdutoSelecionado(null)
    setQuantidade('')
    setCusto('')
    carregar(filtro)
  }

  const novoSaldoPreview =
    produtoSelecionado && qtdNum > 0
      ? produtoSelecionado.saldo_atual + qtdNum
      : null

  function abrirAjuste(p: PosicaoEstoque) {
    setProdutoAjuste(p)
    setTipoAjuste('perda')
    setQtdAjuste('')
    setObsAjuste('')
    setAjusteOpen(true)
  }

  const isAcerto = tipoAjuste === 'acerto'
  const qtdAjusteNum = Number(qtdAjuste)
  const ajusteValido =
    qtdAjuste !== '' &&
    Number.isFinite(qtdAjusteNum) &&
    qtdAjusteNum >= 0 &&
    (isAcerto || qtdAjusteNum > 0)

  // Preview do novo saldo conforme o tipo selecionado.
  const novoSaldoAjuste =
    produtoAjuste && ajusteValido
      ? isAcerto
        ? qtdAjusteNum
        : produtoAjuste.saldo_atual - qtdAjusteNum
      : null

  async function handleAjuste() {
    if (!produtoAjuste || !ajusteValido) return
    setAjustando(true)
    const resultado = await ajustarEstoque({
      produto_id: produtoAjuste.id,
      tipo: tipoAjuste,
      quantidade: qtdAjusteNum,
      observacao: obsAjuste.trim() || undefined,
    })
    setAjustando(false)
    if (resultado.error) {
      toast.error(resultado.error)
      return
    }
    toast.success('Ajuste registrado')
    setAjusteOpen(false)
    setProdutoAjuste(null)
    carregar(filtro)
    carregarReposicaoCount()
  }

  return (
    <div className="px-6 py-5">
      <PageHeader titulo="Estoque" subtitulo="Posição atual por produto e custo médio.">
        <div className="flex items-stretch gap-2">
          <div className="rounded-lg border border-border bg-surface px-3 py-2 text-right">
            <p className="text-[11px] uppercase tracking-wider text-text-muted">SKUs</p>
            <p className="font-mono text-sm font-semibold tabular-nums text-text">
              {formatarNumero(resumo.totalSkus)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface px-3 py-2 text-right">
            <p className="text-[11px] uppercase tracking-wider text-text-muted">
              Valor em estoque
            </p>
            <Money valor={resumo.valorTotal} destaque className="text-sm font-semibold" />
          </div>
          <Link
            href="/estoque/perdas"
            className="u-motion u-press inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text hover:border-err/50 hover:text-err"
          >
            <Trash2 className="size-4" strokeWidth={1.5} />
            Perdas
          </Link>
          <Link
            href="/estoque/reposicao"
            className="u-motion u-press inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text hover:border-brand/50 hover:text-brand"
          >
            <ShoppingBasket className="size-4" strokeWidth={1.5} />
            Reposição
            {reposicaoCount != null && reposicaoCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warn/15 px-1.5 font-mono text-[11px] tabular-nums text-warn">
                {reposicaoCount}
              </span>
            )}
          </Link>
        </div>
      </PageHeader>

      <EstoqueTabs />

      <TransferirDialog
        aberto={!!transferindo}
        onOpenChange={(v) => !v && setTransferindo(null)}
        produto={transferindo}
        destinos={destinos}
      />

      {/* Produtos com validade proxima (entradas com data preenchida) */}
      {vencendo.length > 0 && (
        <div className="mb-4 rounded-lg border border-warn/30 bg-warn/[0.06] px-4 py-3">
          <p className="text-sm font-semibold text-warn">
            {vencendo.length} {vencendo.length === 1 ? 'lote vencendo' : 'lotes vencendo'} nos próximos 30 dias
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {vencendo.slice(0, 5).map((v, i) => (
              <li key={`${v.produto_id}-${i}`} className="text-[13px] text-text-muted">
                <strong className="text-text">{v.nome}</strong> ({v.quantidade} un da entrada) vence{' '}
                {v.dias_restantes < 0
                  ? <span className="font-semibold text-err">há {-v.dias_restantes} dias</span>
                  : v.dias_restantes === 0
                    ? <span className="font-semibold text-err">hoje</span>
                    : `em ${v.dias_restantes} dias`}
              </li>
            ))}
            {vencendo.length > 5 && (
              <li className="text-[12px] text-text-muted">e mais {vencendo.length - 5}...</li>
            )}
          </ul>
        </div>
      )}

      {/* Filtros como segmented control */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <Tabs value={filtro} onValueChange={trocarFiltro}>
          <TabsList>
            {FILTROS.map((f) => (
              <TabsTrigger key={f.valor} value={f.valor}>
                {f.label}
                {f.valor === 'critico' && resumo.criticos > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-err/15 px-1 font-mono text-[10px] tabular-nums text-err">
                    {resumo.criticos}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <SkeletonLinhas colunas={7} linhas={8} />
      ) : estoque.length === 0 ? (
        <EstadoVazio
          icone={Boxes}
          titulo={
            filtro === 'todos'
              ? 'Nenhum produto ainda'
              : 'Nenhum produto neste filtro'
          }
          descricao={
            filtro === 'todos'
              ? 'Cadastre o primeiro produto para começar a controlar o estoque.'
              : 'Tudo dentro do mínimo por aqui. Troque o filtro para ver o estoque completo.'
          }
        />
      ) : (
        <>
        <div className="hidden lg:block">
        <Tabela>
          <TabelaHead>
            <tr>
              <TabelaHeadCell>Produto</TabelaHeadCell>
              <TabelaHeadCell>Categoria</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita">Saldo</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita">Mínimo</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita">Custo médio</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita">Valor total</TabelaHeadCell>
              <TabelaHeadCell alinhar="centro">Status</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita"></TabelaHeadCell>
            </tr>
          </TabelaHead>
          <TabelaBody>
            {estoque.map((p) => (
              <TabelaRow key={p.id}>
                <TabelaCell>
                  <p className="font-medium text-text">{p.nome}</p>
                  {p.marca && (
                    <p className="text-[13px] text-text-muted">{p.marca}</p>
                  )}
                </TabelaCell>
                <TabelaCell className="text-text-muted">{p.categoria}</TabelaCell>
                <TabelaCell alinhar="direita">
                  {formatarNumero(p.saldo_atual)}
                </TabelaCell>
                <TabelaCell alinhar="direita" className="text-text-muted">
                  {formatarNumero(p.estoque_minimo)}
                </TabelaCell>
                <TabelaCell alinhar="direita">
                  <Money valor={p.custo_medio} />
                </TabelaCell>
                <TabelaCell alinhar="direita">
                  <Money valor={p.valor_total} />
                </TabelaCell>
                <TabelaCell alinhar="centro">
                  <StatusPill status={p.status_estoque} />
                </TabelaCell>
                <TabelaCell alinhar="direita">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => abrirEntrada(p)}
                      className="u-motion u-press inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 text-[13px] font-medium text-text hover:border-brand/50 hover:text-brand"
                    >
                      <Plus className="size-3.5" strokeWidth={1.5} />
                      Entrada
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirAjuste(p)}
                      title="Ajustar estoque (perda, quebra, acerto)"
                      className="u-motion u-press inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 text-[13px] font-medium text-text hover:border-warn/50 hover:text-warn"
                    >
                      <SlidersHorizontal className="size-3.5" strokeWidth={1.5} />
                      Ajustar
                    </button>
                    {destinos.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setTransferindo({ id: p.id, nome: p.nome, saldo: p.saldo_atual })}
                        title="Transferir pra outro local"
                        className="u-motion u-press inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 text-[13px] font-medium text-text hover:border-brand/50 hover:text-brand"
                      >
                        <ArrowRightLeft className="size-3.5" strokeWidth={1.5} />
                        Transferir
                      </button>
                    )}
                  </div>
                </TabelaCell>
              </TabelaRow>
            ))}
          </TabelaBody>
        </Tabela>
        </div>

        {/* Mobile: cards */}
        <div className="space-y-2 lg:hidden">
          {estoque.map((p) => (
            <CardLinha
              key={p.id}
              titulo={p.nome}
              destaque={<StatusPill status={p.status_estoque} />}
              campos={[
                { label: 'Saldo', valor: formatarNumero(p.saldo_atual) },
                { label: 'Mínimo', valor: formatarNumero(p.estoque_minimo) },
                { label: 'Custo médio', valor: <Money valor={p.custo_medio} /> },
                { label: 'Valor total', valor: <Money valor={p.valor_total} /> },
              ]}
              acoes={
                <>
                  <button
                    type="button"
                    onClick={() => abrirEntrada(p)}
                    className="u-motion u-press inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-surface-2 text-[13px] font-medium text-text"
                  >
                    <Plus className="size-3.5" strokeWidth={1.5} />
                    Entrada
                  </button>
                  <button
                    type="button"
                    onClick={() => abrirAjuste(p)}
                    className="u-motion u-press inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-surface-2 text-[13px] font-medium text-text"
                  >
                    <SlidersHorizontal className="size-3.5" strokeWidth={1.5} />
                    Ajustar
                  </button>
                </>
              }
            />
          ))}
        </div>
        </>
      )}

      {/* Sheet único de entrada (refinado) */}
      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) setProdutoSelecionado(null)
        }}
      >
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader className="border-b border-border">
            <SheetTitle>Dar entrada</SheetTitle>
            <p className="text-[13px] text-text-muted">
              Lança a mercadoria e recalcula o custo médio ponderado.
            </p>
          </SheetHeader>

          {produtoSelecionado && (
            <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
              {/* Produto + saldo atual */}
              <div className="rounded-lg border border-border bg-surface-2 p-3">
                <p className="text-sm font-medium text-text">
                  {produtoSelecionado.nome}
                </p>
                {produtoSelecionado.marca && (
                  <p className="text-[13px] text-text-muted">
                    {produtoSelecionado.marca}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-[11px] uppercase tracking-wider text-text-muted">
                    Saldo atual
                  </span>
                  <span className="font-mono text-sm tabular-nums text-text">
                    {formatarNumero(produtoSelecionado.saldo_atual)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="qtd-entrada"
                  className="text-[11px] font-medium uppercase tracking-wider text-text-muted"
                >
                  Quantidade
                </label>
                <Input
                  id="qtd-entrada"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  placeholder="24"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="custo-entrada"
                  className="text-[11px] font-medium uppercase tracking-wider text-text-muted"
                >
                  Custo unitário (R$)
                </label>
                <Input
                  id="custo-entrada"
                  type="number"
                  step="0.01"
                  min={0}
                  value={custo}
                  onChange={(e) => setCusto(e.target.value)}
                  placeholder="3,20"
                />
                <p className="text-[13px] text-text-muted">
                  Deixe em branco se for reposição sem nota.
                </p>
              </div>

              {/* Preview do novo saldo */}
              {novoSaldoPreview != null && (
                <div className="u-fade-in flex items-center justify-between rounded-lg border border-brand/30 bg-brand/[0.07] px-3 py-2.5">
                  <span className="text-[13px] text-text-muted">Novo saldo</span>
                  <span className="font-mono text-sm font-semibold tabular-nums text-brand">
                    {formatarNumero(novoSaldoPreview)}
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={handleEntrada}
                disabled={saving || !entradaValida}
                className="u-motion u-press mt-1 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-medium text-white hover:bg-brand-strong disabled:pointer-events-none disabled:opacity-50"
              >
                {saving ? (
                  'Salvando...'
                ) : (
                  <>
                    <PackagePlus className="size-4" strokeWidth={1.5} />
                    Confirmar entrada
                  </>
                )}
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Sheet de ajuste de estoque (perda/quebra/vencido/cortesia/acerto) */}
      <Sheet
        open={ajusteOpen}
        onOpenChange={(open) => {
          setAjusteOpen(open)
          if (!open) setProdutoAjuste(null)
        }}
      >
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader className="border-b border-border">
            <SheetTitle>Ajustar estoque</SheetTitle>
            <p className="text-[13px] text-text-muted">
              Registre perda, quebra, vencido, cortesia ou um acerto de
              inventário.
            </p>
          </SheetHeader>

          {produtoAjuste && (
            <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
              {/* Produto + saldo atual */}
              <div className="rounded-lg border border-border bg-surface-2 p-3">
                <p className="text-sm font-medium text-text">
                  {produtoAjuste.nome}
                </p>
                {produtoAjuste.marca && (
                  <p className="text-[13px] text-text-muted">
                    {produtoAjuste.marca}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-[11px] uppercase tracking-wider text-text-muted">
                    Saldo atual
                  </span>
                  <span className="font-mono text-sm tabular-nums text-text">
                    {formatarNumero(produtoAjuste.saldo_atual)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                  Tipo de ajuste
                </label>
                <Select
                  value={tipoAjuste}
                  onValueChange={(v) => {
                    if (v) {
                      setTipoAjuste(v as TipoAjuste)
                      setQtdAjuste('')
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_AJUSTE.map((t) => (
                      <SelectItem key={t.valor} value={t.valor}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="qtd-ajuste"
                  className="text-[11px] font-medium uppercase tracking-wider text-text-muted"
                >
                  {isAcerto ? 'Novo saldo correto' : 'Quantidade que saiu'}
                </label>
                <Input
                  id="qtd-ajuste"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={qtdAjuste}
                  onChange={(e) => setQtdAjuste(e.target.value)}
                  placeholder={isAcerto ? '120' : '6'}
                  autoFocus
                />
                <p className="text-[13px] text-text-muted">
                  {isAcerto
                    ? 'Informe a contagem física real. O saldo será corrigido para esse valor.'
                    : 'Quantas unidades estão saindo do estoque.'}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="obs-ajuste"
                  className="text-[11px] font-medium uppercase tracking-wider text-text-muted"
                >
                  Observação (opcional)
                </label>
                <Input
                  id="obs-ajuste"
                  value={obsAjuste}
                  onChange={(e) => setObsAjuste(e.target.value)}
                  placeholder="Ex.: caixa amassada na descarga"
                />
              </div>

              {/* Preview do novo saldo */}
              {novoSaldoAjuste != null && (
                <div
                  className={`u-fade-in flex items-center justify-between rounded-lg border px-3 py-2.5 ${
                    novoSaldoAjuste < 0
                      ? 'border-err/30 bg-err/[0.07]'
                      : 'border-brand/30 bg-brand/[0.07]'
                  }`}
                >
                  <span className="text-[13px] text-text-muted">
                    {novoSaldoAjuste < 0
                      ? 'Saldo insuficiente'
                      : 'Novo saldo'}
                  </span>
                  <span
                    className={`font-mono text-sm font-semibold tabular-nums ${
                      novoSaldoAjuste < 0 ? 'text-err' : 'text-brand'
                    }`}
                  >
                    {formatarNumero(novoSaldoAjuste)}
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={handleAjuste}
                disabled={
                  ajustando ||
                  !ajusteValido ||
                  (novoSaldoAjuste != null && novoSaldoAjuste < 0)
                }
                className="u-motion u-press mt-1 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-medium text-white hover:bg-brand-strong disabled:pointer-events-none disabled:opacity-50"
              >
                {ajustando ? (
                  'Salvando...'
                ) : (
                  <>
                    <ClipboardCheck className="size-4" strokeWidth={1.5} />
                    Registrar ajuste
                  </>
                )}
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
