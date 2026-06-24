'use client'
import { useState, useEffect, useMemo } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Plus, PackagePlus, Boxes } from 'lucide-react'
import { buscarPosicaoEstoque, darEntrada } from '@/lib/actions/estoque'
import type { PosicaoEstoque } from '@/types'
import { PageHeader } from '@/components/ui-kit/PageHeader'
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
import { formatarNumero } from '@/lib/formatos'

type Filtro = 'todos' | 'critico' | 'ruptura'

const FILTROS: Array<{ valor: Filtro; label: string }> = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'critico', label: 'Crítico' },
  { valor: 'ruptura', label: 'Ruptura' },
]

export default function EstoquePage() {
  // Lista filtrada (tabela) e lista completa (resumo do topo).
  const [estoque, setEstoque] = useState<PosicaoEstoque[]>([])
  const [completo, setCompleto] = useState<PosicaoEstoque[]>([])
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [loading, setLoading] = useState(true)
  const [produtoSelecionado, setProdutoSelecionado] = useState<PosicaoEstoque | null>(null)
  const [quantidade, setQuantidade] = useState('')
  const [custo, setCusto] = useState('')
  const [saving, setSaving] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  async function carregar(f: Filtro = filtro) {
    setLoading(true)
    const [dados, todos] = await Promise.all([
      buscarPosicaoEstoque(f),
      f === 'todos' ? Promise.resolve(null) : buscarPosicaoEstoque('todos'),
    ])
    const lista = dados as PosicaoEstoque[]
    setEstoque(lista)
    setCompleto((todos as PosicaoEstoque[] | null) ?? lista)
    setLoading(false)
  }

  useEffect(() => {
    carregar('todos')
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
        </div>
      </PageHeader>

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
                  <button
                    type="button"
                    onClick={() => abrirEntrada(p)}
                    className="u-motion u-press inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 text-[13px] font-medium text-text hover:border-brand/50 hover:text-brand"
                  >
                    <Plus className="size-3.5" strokeWidth={1.5} />
                    Entrada
                  </button>
                </TabelaCell>
              </TabelaRow>
            ))}
          </TabelaBody>
        </Tabela>
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
    </div>
  )
}
