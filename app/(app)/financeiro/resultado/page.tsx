'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Banknote,
  Smartphone,
  CreditCard,
  Wallet,
  Inbox,
  TrendingUp,
  TrendingDown,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/ui-kit/PageHeader'
import { EstadoVazio } from '@/components/ui-kit/EstadoVazio'
import { Money } from '@/components/ui-kit/Money'
import { cn } from '@/lib/utils'

import { FinanceiroTabs } from '@/components/financeiro/FinanceiroTabs'
import { buscarResultadoMes, buscarCaixaDia } from '@/lib/actions/financeiro'

// Resultado do mês (DRE simplificada) + fechamento de caixa do dia, do local
// ativo. Client component: chama as duas actions e mostra skeleton enquanto
// carrega (DESIGN_SPEC: nunca spinner genérico em tela com dados).

type Resultado = {
  receita: number
  custoVendas: number
  despesas: number
  despesasPagas: number
  lucroBruto: number
  lucroLiquido: number
  margemBruta: number
  margemLiquida: number
  quantidadeVendas: number
  ticketMedio: number
}

type LinhaCaixa = { forma: string; valor: number; quantidade: number }
type Caixa = {
  resumo: LinhaCaixa[]
  totalGeral: number
  totalVendas: number
  data: string
}

const MES_LONGO = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
})

function capitalizar(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Rótulo + ícone + cor fixa por forma (casa com Formas de pagamento).
const META_FORMA: Record<string, { rotulo: string; icone: LucideIcon; cor: string }> = {
  dinheiro: { rotulo: 'Dinheiro', icone: Banknote, cor: '#3fbf8f' },
  pix: { rotulo: 'Pix', icone: Smartphone, cor: '#14a9b8' },
  cartao_debito: { rotulo: 'Cartão débito', icone: CreditCard, cor: '#d4a520' },
  cartao_credito: { rotulo: 'Cartão crédito', icone: CreditCard, cor: '#7c9cb0' },
}

const ORDEM_FORMAS = ['dinheiro', 'pix', 'cartao_debito', 'cartao_credito'] as const

function pctTexto(n: number) {
  return `${(n * 100).toFixed(1).replace('.', ',')}%`
}

// Uma linha do demonstrativo (DRE). Sinal +/− à esquerda, rótulo, margem
// opcional e o valor à direita em mono. Sem cards: divide-y separa as linhas.
function LinhaDRE({
  sinal,
  rotulo,
  ajuda,
  valor,
  margem,
  tom = 'neutro',
}: {
  sinal?: '+' | '−'
  rotulo: string
  ajuda?: string
  valor: number
  margem?: string
  tom?: 'neutro' | 'negativo' | 'positivo'
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3.5">
      <div className="flex min-w-0 items-baseline gap-2.5">
        {sinal && (
          <span
            className={cn(
              'w-3 shrink-0 text-center font-mono text-sm',
              sinal === '−' ? 'text-err' : 'text-text-muted',
            )}
            aria-hidden
          >
            {sinal}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text">{rotulo}</p>
          {ajuda && (
            <p className="mt-0.5 text-[12px] text-text-muted">{ajuda}</p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-baseline gap-3 text-right">
        {margem && (
          <span className="hidden font-mono text-[12px] tabular-nums text-text-muted sm:inline">
            {margem}
          </span>
        )}
        <span
          className={cn(
            'font-mono text-[15px] tabular-nums',
            tom === 'negativo' && 'text-err',
            tom === 'positivo' && 'text-ok',
            tom === 'neutro' && 'text-text',
          )}
        >
          {tom === 'negativo' ? '− ' : ''}
          <Money valor={valor} className="text-[15px]" />
        </span>
      </div>
    </div>
  )
}

function SkeletonDRE() {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-[0_12px_28px_-18px_rgba(0,0,0,0.55)] lg:p-6">
      <div className="skeleton h-4 w-40" />
      <div className="mt-5 divide-y divide-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3.5">
            <div className="skeleton h-3.5" style={{ width: `${28 + (i % 3) * 8}%` }} />
            <div className="skeleton h-3.5 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}

function SkeletonCaixa() {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-[0_12px_28px_-18px_rgba(0,0,0,0.55)]">
      <div className="skeleton h-4 w-32" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="skeleton h-3.5 w-28" />
            <div className="skeleton h-3.5 w-20" />
          </div>
        ))}
      </div>
      <div className="mt-5 border-t border-border pt-4">
        <div className="skeleton h-8 w-36" />
      </div>
    </div>
  )
}

export default function ResultadoPage() {
  const [carregando, setCarregando] = useState(true)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [caixa, setCaixa] = useState<Caixa | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const [res, cx] = await Promise.all([
        buscarResultadoMes('mes'),
        buscarCaixaDia(),
      ])
      setResultado(res as Resultado)
      setCaixa(cx as Caixa)
    } catch {
      toast.error('Não foi possível carregar o resultado do mês.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar()
  }, [carregar])

  const mesLabel = capitalizar(MES_LONGO.format(new Date()))
  const lucroPositivo = (resultado?.lucroLiquido ?? 0) >= 0
  const semReceita = !carregando && (resultado?.receita ?? 0) <= 0
  const caixaPorForma = new Map((caixa?.resumo ?? []).map((r) => [r.forma, r]))
  const semCaixaHoje = !carregando && (caixa?.totalGeral ?? 0) <= 0

  return (
    <div className="px-6 py-5">
      <FinanceiroTabs />

      <PageHeader
        titulo="Resultado"
        subtitulo="Quanto sobrou depois dos custos e despesas do mês."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* DRE em cascata */}
        <div className="lg:col-span-2">
          {carregando ? (
            <SkeletonDRE />
          ) : (
            <div className="u-stagger rounded-xl border border-border bg-surface p-5 shadow-[0_12px_28px_-18px_rgba(0,0,0,0.55)] lg:p-6">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-text">
                    Demonstrativo do mês
                  </h2>
                  <p className="mt-0.5 text-[11px] uppercase tracking-wider text-text-muted">
                    {mesLabel}
                  </p>
                </div>
                <span
                  className={cn(
                    'flex size-8 items-center justify-center rounded-lg',
                    lucroPositivo
                      ? 'bg-ok/10 text-ok'
                      : 'bg-err/10 text-err',
                  )}
                >
                  {lucroPositivo ? (
                    <TrendingUp className="size-4" strokeWidth={1.5} />
                  ) : (
                    <TrendingDown className="size-4" strokeWidth={1.5} />
                  )}
                </span>
              </div>

              {semReceita ? (
                <div className="py-2">
                  <EstadoVazio
                    icone={Inbox}
                    titulo="Nenhuma venda neste mês"
                    descricao="Assim que houver vendas concluídas, o demonstrativo mostra receita, custos, despesas e o lucro do mês."
                  />
                </div>
              ) : (
                resultado && (
                  <div className="divide-y divide-border">
                    <LinhaDRE
                      rotulo="Receita do mês"
                      ajuda={`${resultado.quantidadeVendas} ${resultado.quantidadeVendas === 1 ? 'venda' : 'vendas'} · ticket médio ${formatTicket(resultado.ticketMedio)}`}
                      valor={resultado.receita}
                      margem="100%"
                      tom="neutro"
                    />
                    <LinhaDRE
                      sinal="−"
                      rotulo="Custo das vendas"
                      ajuda="Quanto custou a mercadoria que saiu"
                      valor={resultado.custoVendas}
                      margem={pctTexto(
                        resultado.receita > 0
                          ? resultado.custoVendas / resultado.receita
                          : 0,
                      )}
                      tom="negativo"
                    />

                    {/* Subtotal: lucro bruto */}
                    <div className="flex items-baseline justify-between gap-4 bg-surface-2/40 py-3.5">
                      <div className="flex items-baseline gap-2.5">
                        <span className="w-3 shrink-0 text-center font-mono text-sm text-text-muted" aria-hidden>
                          =
                        </span>
                        <p className="text-sm font-semibold text-text">
                          Lucro bruto
                        </p>
                      </div>
                      <div className="flex shrink-0 items-baseline gap-3">
                        <span className="hidden font-mono text-[12px] tabular-nums text-text-muted sm:inline">
                          {pctTexto(resultado.margemBruta)}
                        </span>
                        <Money
                          valor={resultado.lucroBruto}
                          className="text-[15px] font-semibold"
                        />
                      </div>
                    </div>

                    <LinhaDRE
                      sinal="−"
                      rotulo="Despesas do mês"
                      ajuda={`${formatPago(resultado.despesasPagas)} já ${resultado.despesasPagas === resultado.despesas ? 'pagas' : 'pagos até agora'}`}
                      valor={resultado.despesas}
                      margem={pctTexto(
                        resultado.receita > 0
                          ? resultado.despesas / resultado.receita
                          : 0,
                      )}
                      tom="negativo"
                    />

                    {/* Total destacado: lucro líquido */}
                    <div className="flex flex-col gap-1 pt-5 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                          Lucro líquido do mês
                        </p>
                        <p className="mt-0.5 text-[12px] text-text-muted">
                          Margem líquida {pctTexto(resultado.margemLiquida)}
                        </p>
                      </div>
                      <Money
                        valor={resultado.lucroLiquido}
                        destaque={lucroPositivo}
                        className={cn(
                          'text-3xl font-semibold tracking-tight lg:text-4xl',
                          !lucroPositivo && 'text-err',
                        )}
                      />
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Fechamento de caixa do dia */}
        <div className="lg:col-span-1">
          {carregando ? (
            <SkeletonCaixa />
          ) : (
            <div className="u-stagger flex flex-col rounded-xl border border-border bg-surface p-5 shadow-[0_12px_28px_-18px_rgba(0,0,0,0.55)]">
              <div className="mb-1 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-text">
                    Caixa de hoje
                  </h2>
                  <p className="mt-0.5 text-[11px] uppercase tracking-wider text-text-muted">
                    {caixa?.totalVendas ?? 0}{' '}
                    {(caixa?.totalVendas ?? 0) === 1 ? 'venda' : 'vendas'}
                  </p>
                </div>
                <span className="flex size-8 items-center justify-center rounded-lg bg-surface-2 text-text-muted">
                  <Wallet className="size-4" strokeWidth={1.5} />
                </span>
              </div>

              {semCaixaHoje ? (
                <div className="py-2">
                  <EstadoVazio
                    icone={Inbox}
                    titulo="Nenhuma venda hoje"
                    descricao="O fechamento por forma de pagamento aparece aqui assim que a primeira venda do dia for concluída."
                  />
                </div>
              ) : (
                <>
                  <div className="mt-4 divide-y divide-border">
                    {ORDEM_FORMAS.map((f) => {
                      const meta = META_FORMA[f]
                      const linha = caixaPorForma.get(f)
                      const Icone = meta.icone
                      return (
                        <div
                          key={f}
                          className="flex items-center justify-between gap-3 py-3"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className="flex size-7 shrink-0 items-center justify-center rounded-lg"
                              style={{
                                backgroundColor: `${meta.cor}1f`,
                                color: meta.cor,
                              }}
                            >
                              <Icone className="size-3.5" strokeWidth={1.5} />
                            </span>
                            <span className="text-sm text-text">
                              {meta.rotulo}
                            </span>
                          </div>
                          <Money
                            valor={linha?.valor ?? 0}
                            className="text-sm"
                          />
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-4 border-t border-border pt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Total do dia
                    </p>
                    <Money
                      valor={caixa?.totalGeral ?? 0}
                      destaque
                      className="mt-1.5 block text-3xl font-semibold tracking-tight"
                    />
                    <p className="mt-3 text-[12px] leading-relaxed text-text-muted">
                      Confira com o caixa físico no fim do dia.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Helpers de texto curtos (evitam importar Money num lugar onde só queremos a
// string formatada dentro da linha de ajuda).
function formatTicket(n: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(n)
}
function formatPago(n: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(n)
}
