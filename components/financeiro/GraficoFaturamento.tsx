'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import { formatarReal } from '@/lib/formatos'

// Gráfico de faturamento mensal. Client Component isolado: o server monta os
// pontos (mês curto + receita + meta de tooltip) e passa via props. Tema dark
// teal, grade horizontal discreta, barras com cantos arredondados e a barra
// mais recente destacada em dourado. Tooltip pt-BR com valor em Money.

export type PontoFaturamento = {
  // rótulo curto do eixo (ex: "jun/26")
  mes: string
  // rótulo completo para o tooltip (ex: "Junho de 2026")
  rotulo: string
  receita: number
  pedidos: number
}

function TooltipFaturamento({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: PontoFaturamento }>
}) {
  if (!active || !payload?.length) return null
  const ponto = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 shadow-lg shadow-black/30">
      <p className="text-[11px] uppercase tracking-wider text-text-muted">
        {ponto.rotulo}
      </p>
      <p className="mt-0.5 font-mono text-sm tabular-nums text-accent-gold">
        {formatarReal(ponto.receita)}
      </p>
      <p className="mt-0.5 font-mono text-[11px] tabular-nums text-text-muted">
        {ponto.pedidos} {ponto.pedidos === 1 ? 'pedido' : 'pedidos'}
      </p>
    </div>
  )
}

export function GraficoFaturamento({ dados }: { dados: PontoFaturamento[] }) {
  const temReceita = dados.some((d) => d.receita > 0)

  if (!temReceita) {
    return (
      <div className="flex h-[260px] flex-col items-center justify-center gap-3 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-text-muted">
          <BarChart3 className="size-5" strokeWidth={1.5} />
        </span>
        <p className="text-sm text-text-muted">
          Sem faturamento registrado ainda.
        </p>
      </div>
    )
  }

  const ultimo = dados.length - 1

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid
            vertical={false}
            stroke="#1e3040"
            strokeDasharray="3 3"
            opacity={0.6}
          />
          <XAxis
            dataKey="mes"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#8aa0a8', fontSize: 11 }}
            dy={6}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={56}
            tick={{ fill: '#8aa0a8', fontSize: 11 }}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
            }
          />
          <Tooltip
            content={<TooltipFaturamento />}
            cursor={{ fill: '#2b7a78', fillOpacity: 0.08 }}
          />
          <Bar
            dataKey="receita"
            radius={[6, 6, 0, 0]}
            maxBarSize={48}
            animationDuration={500}
          >
            {dados.map((_, i) => (
              <Cell key={i} fill={i === ultimo ? '#d4a520' : '#2b7a78'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
