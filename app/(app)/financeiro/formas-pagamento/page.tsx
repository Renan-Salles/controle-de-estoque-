'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Banknote,
  Smartphone,
  CreditCard,
  Wallet,
  Inbox,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/ui-kit/PageHeader'
import { EstadoVazio } from '@/components/ui-kit/EstadoVazio'
import { Money } from '@/components/ui-kit/Money'
import { cn } from '@/lib/utils'

import { FinanceiroTabs } from '@/components/financeiro/FinanceiroTabs'
import {
  GraficoFormas,
  type PontoForma,
} from '@/components/financeiro/GraficoFormas'

import { buscarFormasPagamento } from '@/lib/actions/financeiro'

type Periodo = 'mes' | 'tudo'

type LinhaForma = {
  forma: string
  valor: number
  quantidade: number
  pct: number
}

// Rótulos amigáveis + ícone + cor fixa por forma (casa com o gráfico).
const META_FORMA: Record<
  string,
  { rotulo: string; icone: LucideIcon; cor: string }
> = {
  dinheiro: { rotulo: 'Dinheiro', icone: Banknote, cor: '#3fbf8f' },
  pix: { rotulo: 'Pix', icone: Smartphone, cor: '#14a9b8' },
  cartao_debito: { rotulo: 'Cartão débito', icone: CreditCard, cor: '#d4a520' },
  cartao_credito: {
    rotulo: 'Cartão crédito',
    icone: CreditCard,
    cor: '#7c9cb0',
  },
}

const ORDEM_FORMAS = [
  'dinheiro',
  'pix',
  'cartao_debito',
  'cartao_credito',
] as const

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: 'mes', label: 'Este mês' },
  { value: 'tudo', label: 'Tudo' },
]

// Card de KPI por forma. Reproduz a estética dos KPIs do dashboard/financeiro
// (borda, sombra tonal, ícone em chip). `destaque` realça a forma campeã com
// borda teal e um leve glow do accent — comunica "esta é a que mais paga".
function CardForma({
  rotulo,
  valor,
  quantidade,
  pct,
  icone: Icone,
  cor,
  destaque,
  carregando,
}: {
  rotulo: string
  valor: number
  quantidade: number
  pct: number
  icone: LucideIcon
  cor: string
  destaque: boolean
  carregando: boolean
}) {
  return (
    <div
      className={cn(
        'u-stagger group relative overflow-hidden rounded-xl border bg-surface p-5 shadow-[0_12px_28px_-18px_rgba(0,0,0,0.55)]',
        destaque ? 'border-brand/60' : 'border-border',
      )}
    >
      {destaque && (
        <span className="absolute right-3 top-3 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand">
          Mais usada
        </span>
      )}
      <div className="flex items-center gap-2.5">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${cor}1f`, color: cor }}
        >
          <Icone className="size-4" strokeWidth={1.5} />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          {rotulo}
        </p>
      </div>

      {carregando ? (
        <>
          <div className="skeleton mt-4 h-7 w-28" />
          <div className="skeleton mt-2 h-3 w-32" />
        </>
      ) : (
        <>
          <div className="mt-3">
            <Money
              valor={valor}
              destaque
              className="text-2xl font-semibold tracking-tight"
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[13px]">
            <span className="text-text-muted">
              {quantidade} {quantidade === 1 ? 'venda' : 'vendas'}
            </span>
            <span className="font-mono tabular-nums text-text-muted">
              {pct.toFixed(1).replace('.', ',')}%
            </span>
          </div>
          {/* Barra de participação — leitura visual rápida do peso da forma. */}
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: cor }}
            />
          </div>
        </>
      )}
    </div>
  )
}

export default function FormasPagamentoPage() {
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [carregando, setCarregando] = useState(true)
  const [resumo, setResumo] = useState<LinhaForma[]>([])
  const [totalGeral, setTotalGeral] = useState(0)
  const [totalVendas, setTotalVendas] = useState(0)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const dados = await buscarFormasPagamento(periodo)
      setResumo(dados.resumo as LinhaForma[])
      setTotalGeral(dados.totalGeral)
      setTotalVendas(dados.totalVendas)
    } catch {
      toast.error('Não foi possível carregar as formas de pagamento.')
    } finally {
      setCarregando(false)
    }
  }, [periodo])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Mapa por forma para acesso rápido (a action garante as 4 formas).
  const porForma = new Map(resumo.map((r) => [r.forma, r]))

  // Forma campeã (maior valor). Só destaca se houver algum recebimento.
  const campea = resumo.reduce<LinhaForma | null>((melhor, r) => {
    if (r.valor <= 0) return melhor
    return !melhor || r.valor > melhor.valor ? r : melhor
  }, null)

  // Pontos do gráfico (apenas formas com valor; converte com Number por garantia).
  const pontos: PontoForma[] = ORDEM_FORMAS.map((f) => {
    const linha = porForma.get(f)
    return {
      forma: f,
      rotulo: META_FORMA[f].rotulo,
      valor: Number(linha?.valor ?? 0),
      quantidade: Number(linha?.quantidade ?? 0),
      pct: Number(linha?.pct ?? 0),
    }
  }).filter((p) => p.valor > 0)

  const semDados = !carregando && totalGeral <= 0

  return (
    <div className="px-6 py-5">
      <FinanceiroTabs />

      <PageHeader
        titulo="Formas de pagamento"
        subtitulo="Quanto entrou em cada forma e quais os clientes mais usam."
      >
        {/* Segmented control de período */}
        <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
          {PERIODOS.map((p) => {
            const ativo = periodo === p.value
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriodo(p.value)}
                aria-pressed={ativo}
                className={cn(
                  'u-motion u-press-sm rounded-md px-3 py-1.5 text-sm font-medium',
                  ativo
                    ? 'bg-brand text-white shadow-sm shadow-black/20'
                    : 'text-text-muted hover:bg-surface-2 hover:text-text',
                )}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </PageHeader>

      {/* 4 KPIs — uma forma por card */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ORDEM_FORMAS.map((f) => {
          const linha = porForma.get(f)
          const meta = META_FORMA[f]
          return (
            <CardForma
              key={f}
              rotulo={meta.rotulo}
              valor={linha?.valor ?? 0}
              quantidade={linha?.quantidade ?? 0}
              pct={linha?.pct ?? 0}
              icone={meta.icone}
              cor={meta.cor}
              destaque={!carregando && !!campea && campea.forma === f}
              carregando={carregando}
            />
          )
        })}
      </div>

      {semDados ? (
        <div className="mt-6">
          <EstadoVazio
            icone={Inbox}
            titulo={
              periodo === 'mes'
                ? 'Nenhuma venda neste mês'
                : 'Nenhuma venda registrada'
            }
            descricao="Assim que houver vendas concluídas, o total recebido aparece aqui separado por forma de pagamento."
          />
        </div>
      ) : (
        <>
          {/* Gráfico de participação + totais */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="u-stagger rounded-xl border border-border bg-surface p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-text">
                    Participação por forma
                  </h2>
                  <p className="mt-0.5 text-[11px] uppercase tracking-wider text-text-muted">
                    {periodo === 'mes' ? 'Este mês' : 'Todo o período'}
                  </p>
                </div>
              </div>

              {carregando ? (
                <div className="h-[260px] w-full">
                  <div className="skeleton h-full w-full rounded-lg" />
                </div>
              ) : (
                <GraficoFormas dados={pontos} />
              )}
            </div>

            {/* Totais consolidados */}
            <div className="u-stagger flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  Total recebido
                </p>
                {carregando ? (
                  <div className="skeleton mt-2 h-9 w-36" />
                ) : (
                  <Money
                    valor={totalGeral}
                    destaque
                    className="mt-1.5 block text-3xl font-semibold tracking-tight"
                  />
                )}
              </div>

              <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
                <div className="flex items-center gap-2 text-text-muted">
                  <Wallet className="size-4" strokeWidth={1.5} />
                  <span className="text-[13px]">Total de vendas</span>
                </div>
                {carregando ? (
                  <div className="skeleton h-5 w-10" />
                ) : (
                  <span className="font-mono text-sm font-semibold tabular-nums text-text">
                    {totalVendas}
                  </span>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
