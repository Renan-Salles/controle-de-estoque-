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
import { PieChart as PieChartIcon } from 'lucide-react'
import { formatarReal } from '@/lib/formatos'

// Participação de cada forma de pagamento no total recebido. Client Component
// isolado: o server/página monta os pontos (rótulo + valor + pct + quantidade)
// e passa via props. Tema dark teal, grade horizontal discreta, uma cor fixa
// por forma (funcionam nos dois temas). Tooltip pt-BR com valor em dourado.

export type PontoForma = {
  // chave bruta da forma (dinheiro | pix | cartao_debito | cartao_credito)
  forma: string
  // rótulo amigável no eixo (ex: "Pix")
  rotulo: string
  valor: number
  quantidade: number
  pct: number
}

// Cor fixa por forma — legíveis no claro e no escuro (não dependem de token).
const COR_FORMA: Record<string, string> = {
  dinheiro: '#3fbf8f',
  pix: '#14a9b8',
  cartao_debito: '#d4a520',
  cartao_credito: '#7c9cb0',
}

function TooltipFormas({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: PontoForma }>
}) {
  if (!active || !payload?.length) return null
  const ponto = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 shadow-lg shadow-black/30">
      <p className="text-[11px] uppercase tracking-wider text-text-muted">
        {ponto.rotulo}
      </p>
      <p className="mt-0.5 font-mono text-sm tabular-nums text-accent-gold">
        {formatarReal(ponto.valor)}
      </p>
      <p className="mt-0.5 font-mono text-[11px] tabular-nums text-text-muted">
        {ponto.quantidade} {ponto.quantidade === 1 ? 'venda' : 'vendas'} ·{' '}
        {ponto.pct.toFixed(1).replace('.', ',')}%
      </p>
    </div>
  )
}

export function GraficoFormas({ dados }: { dados: PontoForma[] }) {
  const temValor = dados.some((d) => d.valor > 0)

  if (!temValor) {
    return (
      <div className="flex h-[260px] flex-col items-center justify-center gap-3 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-text-muted">
          <PieChartIcon className="size-5" strokeWidth={1.5} />
        </span>
        <p className="text-sm text-text-muted">
          Nenhum recebimento no período.
        </p>
      </div>
    )
  }

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid
            vertical={false}
            stroke="rgba(148,163,184,0.28)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="rotulo"
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
              v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
            }
          />
          <Tooltip
            content={<TooltipFormas />}
            cursor={{ fill: '#14a9b8', fillOpacity: 0.08 }}
          />
          <Bar
            dataKey="valor"
            radius={[6, 6, 0, 0]}
            maxBarSize={64}
            animationDuration={500}
          >
            {dados.map((d) => (
              <Cell key={d.forma} fill={COR_FORMA[d.forma] ?? '#14a9b8'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
