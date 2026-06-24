'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowUpFromLine, BadgeCheck, Plus, ReceiptText } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'

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
import { formatarData } from '@/lib/formatos'

import { FinanceiroTabs } from '@/components/financeiro/FinanceiroTabs'
import { KpiFinanceiro } from '@/components/financeiro/KpiFinanceiro'
import { FiltroStatus, type OpcaoFiltro } from '@/components/financeiro/FiltroStatus'

import {
  buscarContasPagar,
  criarContaPagar,
  buscarResumoFinanceiro,
} from '@/lib/actions/financeiro'

type ContaPagar = {
  id: string
  categoria: string
  descricao: string
  valor: number
  valor_pago: number
  status: string
  data_vencimento: string
  observacoes: string | null
}

const FILTROS: OpcaoFiltro[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'aberto', label: 'Aberto' },
  { value: 'vencido', label: 'Vencido' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'pago', label: 'Pago' },
]

const CATEGORIAS: OpcaoFiltro[] = [
  { value: 'mercadoria', label: 'Mercadoria' },
  { value: 'aluguel', label: 'Aluguel' },
  { value: 'salario', label: 'Salário' },
  { value: 'combustivel', label: 'Combustível' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'servicos', label: 'Serviços' },
  { value: 'impostos', label: 'Impostos' },
  { value: 'outros', label: 'Outros' },
]

const ROTULO_CATEGORIA: Record<string, string> = Object.fromEntries(
  CATEGORIAS.map((c) => [c.value, c.label]),
)

const FORM_VAZIO = {
  categoria: 'mercadoria',
  descricao: '',
  valor: '',
  data_vencimento: '',
  observacoes: '',
}

export default function ContasPagarPage() {
  const [contas, setContas] = useState<ContaPagar[]>([])
  const [filtroStatus, setFiltroStatus] = useState('todas')
  const [carregando, setCarregando] = useState(true)
  const [resumo, setResumo] = useState({ totalPagar: 0, totalPago: 0 })

  const [sheetAberto, setSheetAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState(FORM_VAZIO)
  const [erros, setErros] = useState<Record<string, string>>({})

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const [dados, res] = await Promise.all([
        buscarContasPagar(filtroStatus),
        buscarResumoFinanceiro(),
      ])
      setContas(dados as ContaPagar[])
      setResumo({ totalPagar: res.totalPagar, totalPago: res.totalPago })
    } catch {
      toast.error('Não foi possível carregar as contas a pagar.')
    } finally {
      setCarregando(false)
    }
  }, [filtroStatus])

  useEffect(() => {
    carregar()
  }, [carregar])

  const hoje = new Date().toISOString().split('T')[0]

  function set<K extends keyof typeof FORM_VAZIO>(
    campo: K,
    valor: (typeof FORM_VAZIO)[K],
  ) {
    setForm((f) => ({ ...f, [campo]: valor }))
    setErros((e) => ({ ...e, [campo]: '' }))
  }

  function abrirNova() {
    setForm(FORM_VAZIO)
    setErros({})
    setSheetAberto(true)
  }

  function validar() {
    const novos: Record<string, string> = {}
    if (!form.descricao.trim()) novos.descricao = 'Informe uma descrição.'
    const valor = Number(form.valor)
    if (!form.valor || !Number.isFinite(valor) || valor <= 0)
      novos.valor = 'Informe um valor maior que zero.'
    if (!form.data_vencimento) novos.data_vencimento = 'Informe o vencimento.'
    setErros(novos)
    return Object.keys(novos).length === 0
  }

  async function salvar() {
    if (!validar()) return
    setSalvando(true)
    const resultado = await criarContaPagar({
      categoria: form.categoria,
      descricao: form.descricao.trim(),
      valor: Number(form.valor),
      data_vencimento: form.data_vencimento,
      observacoes: form.observacoes.trim() || undefined,
    })
    setSalvando(false)
    if (resultado.error) {
      toast.error(resultado.error)
      return
    }
    toast.success('Conta cadastrada.')
    setSheetAberto(false)
    setForm(FORM_VAZIO)
    carregar()
  }

  return (
    <div className="px-6 py-5">
      <FinanceiroTabs />

      <PageHeader
        titulo="Contas a pagar"
        subtitulo="Despesas do depósito: mercadoria, aluguel, salários e custos do mês."
      >
        <Button className="u-press bg-brand text-white hover:bg-brand-strong" onClick={abrirNova}>
          <Plus className="size-4" strokeWidth={1.5} />
          Nova conta
        </Button>
      </PageHeader>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiFinanceiro
          rotulo="A pagar no mês"
          valor={resumo.totalPagar}
          icone={ArrowUpFromLine}
          tom="neutro"
        />
        <KpiFinanceiro
          rotulo="Pago no mês"
          valor={resumo.totalPago}
          icone={BadgeCheck}
          tom="ouro"
        />
      </div>

      <div className="mb-4">
        <FiltroStatus
          opcoes={FILTROS}
          valor={filtroStatus}
          onChange={setFiltroStatus}
        />
      </div>

      {carregando ? (
        <SkeletonLinhas colunas={6} linhas={7} />
      ) : contas.length === 0 ? (
        <EstadoVazio
          icone={ReceiptText}
          titulo="Nenhuma conta a pagar"
          descricao="Cadastre a primeira despesa para controlar o que sai do caixa: mercadoria, aluguel, salários e mais."
          acao={
            <Button
              className="u-press bg-brand text-white hover:bg-brand-strong"
              onClick={abrirNova}
            >
              <Plus className="size-4" strokeWidth={1.5} />
              Nova conta
            </Button>
          }
        />
      ) : (
        <Tabela>
          <TabelaHead>
            <tr>
              <TabelaHeadCell>Categoria</TabelaHeadCell>
              <TabelaHeadCell>Descrição</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita">Valor</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita">Pago</TabelaHeadCell>
              <TabelaHeadCell>Vencimento</TabelaHeadCell>
              <TabelaHeadCell>Status</TabelaHeadCell>
            </tr>
          </TabelaHead>
          <TabelaBody>
            {contas.map((c) => {
              const vencida =
                c.data_vencimento < hoje &&
                c.status !== 'pago' &&
                c.status !== 'cancelado'
              return (
                <TabelaRow
                  key={c.id}
                  className={vencida ? 'bg-err/5 hover:bg-err/10' : undefined}
                >
                  <TabelaCell className="font-medium">
                    {ROTULO_CATEGORIA[c.categoria] ?? c.categoria}
                  </TabelaCell>
                  <TabelaCell className="text-text-muted">
                    {c.descricao || '—'}
                  </TabelaCell>
                  <TabelaCell alinhar="direita">
                    <Money valor={c.valor} />
                  </TabelaCell>
                  <TabelaCell alinhar="direita">
                    <Money
                      valor={c.valor_pago ?? 0}
                      className="text-text-muted"
                    />
                  </TabelaCell>
                  <TabelaCell
                    mono
                    className={vencida ? 'text-err' : 'text-text-muted'}
                  >
                    {formatarData(`${c.data_vencimento}T00:00:00`)}
                  </TabelaCell>
                  <TabelaCell>
                    <StatusPill status={c.status} />
                  </TabelaCell>
                </TabelaRow>
              )
            })}
          </TabelaBody>
        </Tabela>
      )}

      <Sheet
        open={sheetAberto}
        onOpenChange={(aberto) => {
          setSheetAberto(aberto)
          if (!aberto) setErros({})
        }}
      >
        <SheetContent className="w-full gap-0 sm:max-w-md">
          <SheetHeader className="border-b border-border">
            <SheetTitle>Nova conta a pagar</SheetTitle>
            <SheetDescription>
              Registre uma despesa do depósito. O título entra como em aberto.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-5 overflow-y-auto p-4">
            <section className="flex flex-col gap-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Dados da despesa
              </p>

              <div className="flex flex-col gap-2">
                <Label>Categoria</Label>
                <Select
                  value={form.categoria}
                  onValueChange={(v: string | null) =>
                    set('categoria', v ?? 'outros')
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Input
                  id="descricao"
                  value={form.descricao}
                  onChange={(e) => set('descricao', e.target.value)}
                  placeholder="Ex: Compra Ambev nota 4821"
                  aria-invalid={!!erros.descricao}
                />
                {erros.descricao && (
                  <p className="text-xs text-err">{erros.descricao}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="valor">Valor</Label>
                  <Input
                    id="valor"
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={form.valor}
                    onChange={(e) => set('valor', e.target.value)}
                    placeholder="0,00"
                    className="font-mono tabular-nums"
                    aria-invalid={!!erros.valor}
                  />
                  {erros.valor && (
                    <p className="text-xs text-err">{erros.valor}</p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="vencimento">Vencimento</Label>
                  <Input
                    id="vencimento"
                    type="date"
                    value={form.data_vencimento}
                    onChange={(e) => set('data_vencimento', e.target.value)}
                    className="font-mono tabular-nums"
                    aria-invalid={!!erros.data_vencimento}
                  />
                  {erros.data_vencimento && (
                    <p className="text-xs text-err">{erros.data_vencimento}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={form.observacoes}
                  onChange={(e) => set('observacoes', e.target.value)}
                  placeholder="Opcional"
                  rows={3}
                />
              </div>
            </section>
          </div>

          <div className="mt-auto flex gap-2 border-t border-border p-4">
            <Button
              variant="outline"
              className="u-press flex-1"
              onClick={() => setSheetAberto(false)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button
              className="u-press flex-1 bg-brand text-white hover:bg-brand-strong"
              onClick={salvar}
              disabled={salvando}
            >
              {salvando ? 'Salvando...' : 'Salvar conta'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
