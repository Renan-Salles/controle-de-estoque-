import { createClient } from '@/lib/supabase/server'
import { getLocalAtivoId } from '@/lib/local'
import {
  Package,
  ShoppingCart,
  Receipt,
  CalendarRange,
  TriangleAlert,
  ArrowUpRight,
  PackagePlus,
  CreditCard,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { Money } from '@/components/ui-kit/Money'
import { GraficoVendas, type PontoVenda } from '@/components/dashboard/GraficoVendas'

const NOME_DEPOSITO = 'R$ DEPÓSITO'

export default async function DashboardPage() {
  const supabase = await createClient()
  const localId = await getLocalAtivoId()

  const hoje = new Date().toISOString().split('T')[0]
  const inicioMes = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`

  type RowTotal = { total: number }
  type RowId = { id: string }
  type RowPedidoMes = { data_pedido: string; total: number }

  const [
    { data: pedidosHoje },
    { data: estoquesCriticos },
    { data: pedidosMes },
  ] = await Promise.all([
    supabase.from('pedidos').select('total').gte('data_pedido', `${hoje}T00:00:00`).eq('status', 'concluida').eq('local_id', localId) as unknown as Promise<{ data: RowTotal[] }>,
    supabase.from('v_posicao_estoque').select('id').in('status_estoque', ['critico', 'ruptura']).eq('local_id', localId) as unknown as Promise<{ data: RowId[] }>,
    supabase.from('pedidos').select('data_pedido, total').gte('data_pedido', `${inicioMes}T00:00:00`).eq('status', 'concluida').eq('local_id', localId).order('data_pedido') as unknown as Promise<{ data: RowPedidoMes[] }>,
  ])

  const receitaHoje = (pedidosHoje ?? []).reduce((acc, p) => acc + (p.total ?? 0), 0)
  const receitaMes = (pedidosMes ?? []).reduce((acc, p) => acc + (p.total ?? 0), 0)
  const qtdCriticos = estoquesCriticos?.length ?? 0
  const qtdPedidosHoje = pedidosHoje?.length ?? 0
  // Ticket médio do dia: receita do dia / nº de vendas concluídas no dia.
  const ticketMedioHoje = qtdPedidosHoje > 0 ? receitaHoje / qtdPedidosHoje : 0

  // Série dos últimos 7 dias para o gráfico (recharts no client).
  const dadosGrafico: PontoVenda[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const dStr = d.toISOString().split('T')[0]
    const total = (pedidosMes ?? [])
      .filter((p) => p.data_pedido.startsWith(dStr))
      .reduce((acc, p) => acc + (p.total ?? 0), 0)
    return {
      dia: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
      rotulo: d.toLocaleDateString('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
      }),
      total,
    }
  })

  type Kpi = {
    label: string
    valor: string
    sub: string
    money?: number
    moneyDestaque?: boolean
    icon: LucideIcon
    tom: 'brand' | 'gold' | 'critico'
  }

  const kpis: Kpi[] = [
    {
      label: 'Vendas hoje',
      valor: String(qtdPedidosHoje),
      sub: 'receita do dia',
      money: receitaHoje,
      moneyDestaque: true,
      icon: ShoppingCart,
      tom: 'brand',
    },
    {
      label: 'Receita do mês',
      valor: '',
      money: receitaMes,
      moneyDestaque: true,
      sub: 'vendas concluídas no mês',
      icon: CalendarRange,
      tom: 'gold',
    },
    {
      label: 'Estoque crítico',
      valor: String(qtdCriticos),
      sub: qtdCriticos > 0 ? 'produtos abaixo do mínimo' : 'tudo dentro do mínimo',
      icon: Package,
      tom: qtdCriticos > 0 ? 'critico' : 'brand',
    },
    {
      label: 'Ticket médio do dia',
      valor: '',
      money: ticketMedioHoje,
      moneyDestaque: true,
      sub: qtdPedidosHoje > 0 ? 'por venda concluída hoje' : 'sem vendas hoje',
      icon: Receipt,
      tom: 'brand',
    },
  ]

  const tomCor: Record<Kpi['tom'], string> = {
    brand: 'text-brand',
    gold: 'text-accent-gold',
    critico: 'text-err',
  }
  const tomAnel: Record<Kpi['tom'], string> = {
    brand: 'bg-brand/10 text-brand',
    gold: 'bg-warn/10 text-warn',
    critico: 'bg-err/10 text-err',
  }

  const atalhos: Array<{
    href: string
    titulo: string
    desc: string
    icon: LucideIcon
    dourado?: boolean
  }> = [
    {
      href: '/movimentacoes/nova',
      titulo: 'Nova venda',
      desc: 'Registrar venda à vista',
      icon: ShoppingCart,
    },
    {
      href: '/movimentacoes/nova',
      titulo: 'Nova entrada',
      desc: 'Lançar mercadoria recebida',
      icon: PackagePlus,
    },
    {
      href: '/financeiro/formas-pagamento',
      titulo: 'Formas de pagamento',
      desc: 'Quanto entrou em cada forma',
      icon: CreditCard,
      dourado: true,
    },
  ]

  return (
    <div className="px-6 py-5">
      {/* Boas-vindas discreta */}
      <div className="u-fade-in mb-5 flex flex-col gap-1 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-text-muted">
            Painel
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-text">
            {NOME_DEPOSITO}
          </h1>
        </div>
        <Link
          href="/movimentacoes/nova"
          className="u-motion u-press inline-flex h-9 shrink-0 items-center gap-2 self-start rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-strong sm:self-auto"
        >
          <ShoppingCart className="size-4" strokeWidth={1.5} />
          Nova movimentação
        </Link>
      </div>

      {/* Alerta de estoque crítico (banner, não card vermelho genérico) */}
      {qtdCriticos > 0 && (
        <Link
          href="/estoque?filtro=critico"
          className="u-motion u-fade-in group mb-5 flex items-center gap-3 rounded-lg border border-err/30 bg-err/[0.07] px-4 py-3 hover:bg-err/10"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-err/15 text-err">
            <TriangleAlert className="size-4" strokeWidth={1.5} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text">
              {qtdCriticos} produto{qtdCriticos > 1 ? 's' : ''} com estoque crítico ou zerado
            </p>
            <p className="text-[13px] text-text-muted">
              Repor antes que falte no balcão.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-[13px] font-medium text-err">
            Ver estoque
            <ArrowUpRight className="size-4 u-motion group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={1.5} />
          </span>
        </Link>
      )}

      {/* KPIs — único lugar com cards (elevação justificada). Stagger via CSS. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k, i) => (
          <div
            key={k.label}
            className="u-stagger u-motion rounded-xl border border-border bg-surface p-5 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.6)] hover:border-brand/40"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <div className="flex items-start justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                {k.label}
              </p>
              <span
                className={`flex size-8 items-center justify-center rounded-lg ${tomAnel[k.tom]}`}
              >
                <k.icon className="size-4" strokeWidth={1.5} />
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              {k.money != null && !k.valor ? (
                <Money
                  valor={k.money}
                  destaque={k.moneyDestaque}
                  className="text-3xl font-semibold"
                />
              ) : (
                <span
                  className={`font-mono text-3xl font-semibold tabular-nums tracking-tight ${k.tom === 'critico' ? tomCor.critico : 'text-text'}`}
                >
                  {k.valor}
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center justify-between text-[13px]">
              <span className="text-text-muted">{k.sub}</span>
              {k.money != null && k.valor && (
                <Money valor={k.money} destaque={k.moneyDestaque} className="text-sm" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Gráfico (2/3) + acesso rápido (1/3) */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="u-stagger rounded-xl border border-border bg-surface p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-text">
                Vendas
              </h2>
              <p className="text-[11px] uppercase tracking-wider text-text-muted">
                Últimos 7 dias
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider text-text-muted">
                Total do mês
              </p>
              <Money valor={receitaMes} destaque className="text-sm font-semibold" />
            </div>
          </div>
          <GraficoVendas dados={dadosGrafico} />
        </div>

        <div className="u-stagger rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-1 text-sm font-semibold tracking-tight text-text">
            Acesso rápido
          </h2>
          <p className="mb-4 text-[11px] uppercase tracking-wider text-text-muted">
            Atalhos do dia
          </p>
          <div className="-mx-2 divide-y divide-border/60">
            {atalhos.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="u-motion group flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-surface-2"
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${a.dourado ? 'bg-warn/10 text-warn' : 'bg-brand/10 text-brand'}`}
                >
                  <a.icon className="size-4" strokeWidth={1.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">{a.titulo}</p>
                  <p className="truncate text-[13px] text-text-muted">{a.desc}</p>
                </div>
                <ArrowUpRight
                  className="size-4 shrink-0 text-text-muted u-motion group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-text"
                  strokeWidth={1.5}
                />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
