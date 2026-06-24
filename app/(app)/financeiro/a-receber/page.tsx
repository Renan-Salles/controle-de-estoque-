'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowDownToLine, Wallet, CircleAlert, Inbox } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

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
import { formatarData, formatarReal } from '@/lib/formatos'

import { FinanceiroTabs } from '@/components/financeiro/FinanceiroTabs'
import { KpiFinanceiro } from '@/components/financeiro/KpiFinanceiro'
import { FiltroStatus, type OpcaoFiltro } from '@/components/financeiro/FiltroStatus'

import {
  buscarContasReceber,
  registrarPagamento,
  buscarResumoFinanceiro,
} from '@/lib/actions/financeiro'

type ContaReceber = {
  id: string
  valor: number
  valor_pago: number
  status: string
  data_vencimento: string
  descricao: string | null
  clientes: { nome: string; telefone: string | null } | null
}

const FILTROS: OpcaoFiltro[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'aberto', label: 'Aberto' },
  { value: 'vencido', label: 'Vencido' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'pago', label: 'Pago' },
]

const FORMAS_PAGAMENTO: OpcaoFiltro[] = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'Pix' },
  { value: 'cartao_debito', label: 'Cartão de débito' },
  { value: 'cartao_credito', label: 'Cartão de crédito' },
  { value: 'transferencia', label: 'Transferência' },
]

export default function ContasReceberPage() {
  const [contas, setContas] = useState<ContaReceber[]>([])
  const [filtroStatus, setFiltroStatus] = useState('todas')
  const [carregando, setCarregando] = useState(true)
  const [resumo, setResumo] = useState({
    totalReceber: 0,
    totalRecebido: 0,
    inadimplente: 0,
  })

  const [contaPagar, setContaPagar] = useState<ContaReceber | null>(null)
  const [valorPagamento, setValorPagamento] = useState('')
  const [formaPag, setFormaPag] = useState('dinheiro')
  const [salvando, setSalvando] = useState(false)
  const [dialogAberto, setDialogAberto] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const [dados, res] = await Promise.all([
        buscarContasReceber(filtroStatus),
        buscarResumoFinanceiro(),
      ])
      setContas(dados as ContaReceber[])
      setResumo(res)
    } catch {
      toast.error('Não foi possível carregar as contas a receber.')
    } finally {
      setCarregando(false)
    }
  }, [filtroStatus])

  useEffect(() => {
    carregar()
  }, [carregar])

  const hoje = new Date().toISOString().split('T')[0]

  function abrirPagamento(conta: ContaReceber) {
    const saldo = conta.valor - (conta.valor_pago ?? 0)
    setContaPagar(conta)
    setValorPagamento(saldo.toFixed(2))
    setFormaPag('dinheiro')
    setDialogAberto(true)
  }

  async function confirmarPagamento() {
    if (!contaPagar || !valorPagamento) return
    const valor = Number(valorPagamento)
    if (!Number.isFinite(valor) || valor <= 0) {
      toast.error('Informe um valor válido.')
      return
    }
    setSalvando(true)
    const resultado = await registrarPagamento(contaPagar.id, valor, formaPag)
    setSalvando(false)
    if (resultado.error) {
      toast.error(resultado.error)
      return
    }
    toast.success('Pagamento registrado.')
    setDialogAberto(false)
    setContaPagar(null)
    setValorPagamento('')
    carregar()
  }

  const saldoConta = contaPagar
    ? contaPagar.valor - (contaPagar.valor_pago ?? 0)
    : 0

  return (
    <div className="px-6 py-5">
      <FinanceiroTabs />

      <PageHeader
        titulo="Contas a receber"
        subtitulo="Acompanhe o que entra: títulos em aberto, parciais e inadimplência do mês."
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiFinanceiro
          rotulo="A receber no mês"
          valor={resumo.totalReceber}
          icone={ArrowDownToLine}
          tom="neutro"
        />
        <KpiFinanceiro
          rotulo="Recebido no mês"
          valor={resumo.totalRecebido}
          icone={Wallet}
          tom="ouro"
        />
        <KpiFinanceiro
          rotulo="Inadimplente"
          valor={resumo.inadimplente}
          icone={CircleAlert}
          tom={resumo.inadimplente > 0 ? 'critico' : 'neutro'}
          hint={resumo.inadimplente > 0 ? 'Títulos vencidos em aberto' : undefined}
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
        <SkeletonLinhas colunas={7} linhas={7} />
      ) : contas.length === 0 ? (
        <EstadoVazio
          icone={Inbox}
          titulo="Nenhuma conta neste filtro"
          descricao="Os títulos a receber aparecem aqui assim que houver vendas a prazo. Ajuste o filtro acima ou registre um novo pedido."
        />
      ) : (
        <Tabela>
          <TabelaHead>
            <tr>
              <TabelaHeadCell>Cliente</TabelaHeadCell>
              <TabelaHeadCell>Descrição</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita">Valor</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita">Pago</TabelaHeadCell>
              <TabelaHeadCell>Vencimento</TabelaHeadCell>
              <TabelaHeadCell>Status</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita">Ação</TabelaHeadCell>
            </tr>
          </TabelaHead>
          <TabelaBody>
            {contas.map((c) => {
              const vencida =
                c.data_vencimento < hoje &&
                c.status !== 'pago' &&
                c.status !== 'cancelado'
              const quitada = c.status === 'pago' || c.status === 'cancelado'
              return (
                <TabelaRow
                  key={c.id}
                  className={vencida ? 'bg-err/5 hover:bg-err/10' : undefined}
                >
                  <TabelaCell className="font-medium">
                    {c.clientes?.nome ?? '—'}
                  </TabelaCell>
                  <TabelaCell className="text-text-muted">
                    {c.descricao ?? '—'}
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
                  <TabelaCell alinhar="direita">
                    {!quitada && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="u-press"
                        onClick={() => abrirPagamento(c)}
                      >
                        Receber
                      </Button>
                    )}
                  </TabelaCell>
                </TabelaRow>
              )
            })}
          </TabelaBody>
        </Tabela>
      )}

      <Dialog
        open={dialogAberto}
        onOpenChange={(aberto) => {
          setDialogAberto(aberto)
          if (!aberto) setContaPagar(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
            <DialogDescription>
              {contaPagar?.clientes?.nome ?? 'Cliente'}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-text-muted">
                Saldo em aberto
              </span>
              <Money
                valor={saldoConta}
                destaque
                className="text-base font-semibold"
              />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="valor-recebido">Valor recebido</Label>
              <Input
                id="valor-recebido"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={valorPagamento}
                onChange={(e) => setValorPagamento(e.target.value)}
                className="font-mono tabular-nums"
              />
              <p className="text-xs text-text-muted">
                Pré-preenchido com o saldo total ({formatarReal(saldoConta)}).
                Edite para registrar um pagamento parcial.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Forma de pagamento</Label>
              <Select
                value={formaPag}
                onValueChange={(v: string | null) => setFormaPag(v ?? 'dinheiro')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAS_PAGAMENTO.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              className="u-press w-full bg-brand text-white hover:bg-brand-strong"
              onClick={confirmarPagamento}
              disabled={salvando}
            >
              {salvando ? 'Registrando...' : 'Confirmar pagamento'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
