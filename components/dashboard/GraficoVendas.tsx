'use client'

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import { formatarReal } from '@/lib/formatos'

// Gráfico de vendas dos últimos 7 dias. Client Component isolado: o server
// monta os dados (dia + total) e passa via props. Tema dark teal, sem grade
// pesada, eixos discretos, tooltip pt-BR com Money em dourado.

export type PontoVenda = {
  dia: string
  total: number
  // rótulo completo para o tooltip (ex: "seg, 16/06")
  rotulo: string
}

function TooltipVendas({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: PontoVenda }>
}) {
  if (!active || !payload?.length) return null
  const ponto = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 shadow-lg shadow-black/30">
      <p className="text-[11px] uppercase tracking-wider text-text-muted">
        {ponto.rotulo}
      </p>
      <p className="mt-0.5 font-mono text-sm tabular-nums text-accent-gold">
        {formatarReal(ponto.total)}
      </p>
    </div>
  )
}

export function GraficoVendas({ dados }: { dados: PontoVenda[] }) {
  const temVenda = dados.some((d) => d.total > 0)

  if (!temVenda) {
    return (
      <div className="flex h-[220px] flex-col items-center justify-center gap-3 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-text-muted">
          <TrendingUp className="size-5" strokeWidth={1.5} />
        </span>
        <p className="text-sm text-text-muted">
          Sem vendas nos últimos 7 dias.
        </p>
      </div>
    )
  }

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={dados}
          margin={{ top: 8, right: 4, left: -16, bottom: 0 }}
        >
          <defs>
            <linearGradient id="grad-vendas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#14a9b8" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#14a9b8" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="rgba(148,163,184,0.28)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="dia"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            dy={6}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={56}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
            }
          />
          <Tooltip
            content={<TooltipVendas />}
            cursor={{ stroke: '#14a9b8', strokeWidth: 1, strokeOpacity: 0.4 }}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke="#14a9b8"
            strokeWidth={2}
            fill="url(#grad-vendas)"
            dot={{ r: 0 }}
            activeDot={{ r: 4, fill: '#14a9b8', strokeWidth: 0 }}
            animationDuration={500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
