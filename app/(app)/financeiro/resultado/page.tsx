import { Suspense } from 'react'
import { PageHeader } from '@/components/ui-kit/PageHeader'
import { FinanceiroTabs } from '@/components/financeiro/FinanceiroTabs'
import { getDre } from '@/lib/actions/dre'
import { formatarReal } from '@/lib/formatos'
import { MesSeletor } from './MesSeletor'

function LinhaDRE({ label, valor, pct, destaque, negativo }: {
  label: string; valor: number; pct?: number; destaque?: boolean; negativo?: boolean
}) {
  return (
    <div className={`flex items-center justify-between py-3 ${destaque ? 'border-t-2 border-border' : ''}`}>
      <span className={`text-sm ${destaque ? 'font-semibold text-text' : 'text-text-muted'}`}>{label}</span>
      <div className="flex items-center gap-3">
        {pct !== undefined && (
          <span className={`text-xs ${pct < 0 ? 'text-err' : 'text-text-muted'}`}>{pct.toFixed(1)}%</span>
        )}
        <span className={`min-w-[100px] text-right text-sm tabular-nums ${destaque ? 'font-semibold text-text' : negativo ? 'text-err' : 'text-text'}`}>
          {negativo ? '- ' : ''}{formatarReal(Math.abs(valor))}
        </span>
      </div>
    </div>
  )
}

export default async function ResultadoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const { mes } = await searchParams
  const dre = await getDre(mes)
  const mesAtual = mes ?? new Date().toISOString().slice(0, 7)
  const labelMes = new Date(mesAtual + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="px-6 py-5">
      <FinanceiroTabs />

      <PageHeader titulo="Resultado" subtitulo="Demonstrativo de resultado do mes." />

      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Suspense><MesSeletor /></Suspense>
          <span className="text-sm capitalize text-text-muted">{labelMes}</span>
        </div>

        <div className="rounded-lg border border-border bg-surface px-6 divide-y divide-border">
          <LinhaDRE label="Receita Bruta" valor={dre.receita_bruta} />
          <LinhaDRE label="(-) CMV - Custo das mercadorias" valor={dre.cmv} negativo />
          <LinhaDRE label="= Margem Bruta" valor={dre.margem_bruta} pct={dre.margem_bruta_pct} destaque />
          <LinhaDRE label="(-) Custos Fixos" valor={dre.custos_fixos} negativo />
          <LinhaDRE label="(-) Perdas e Quebras" valor={dre.perdas} negativo />
          <LinhaDRE label="= Lucro Liquido" valor={dre.lucro_liquido} pct={dre.lucro_liquido_pct} destaque negativo={dre.lucro_liquido < 0} />
        </div>

        {dre.custos_fixos === 0 && (
          <p className="text-xs text-text-muted">
            Nenhum custo fixo cadastrado.{' '}
            <a href="/financeiro/custos-fixos" className="text-brand hover:underline">
              Cadastrar custos fixos
            </a>
          </p>
        )}
      </div>
    </div>
  )
}
