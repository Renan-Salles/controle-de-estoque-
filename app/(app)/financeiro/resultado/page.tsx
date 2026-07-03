import { Suspense } from 'react'
import { PageHeader } from '@/components/ui-kit/PageHeader'
import {
  Tabela,
  TabelaHead,
  TabelaHeadCell,
  TabelaBody,
  TabelaRow,
  TabelaCell,
} from '@/components/ui-kit/tabela'
import { getDre, getDreSerie } from '@/lib/actions/dre'
import { formatarReal, mesAtualBrasil } from '@/lib/formatos'
import { MesSeletor } from './MesSeletor'

// "2026-07" -> "Jul/26"
function mesCurto(mes: string) {
  const s = new Date(`${mes}-15T12:00:00`).toLocaleDateString('pt-BR', {
    month: 'short',
    year: '2-digit',
  })
  return s.charAt(0).toUpperCase() + s.slice(1).replace('.', '')
}

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
  const [dre, serie] = await Promise.all([getDre(mes), getDreSerie(6)])
  const mesAtual = mes ?? mesAtualBrasil()
  const labelMes = new Date(mesAtual + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="px-6 py-5">
      <PageHeader titulo="Resultado" subtitulo="Demonstrativo de resultado do mês." />

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
          <LinhaDRE label="= Lucro Líquido" valor={dre.lucro_liquido} pct={dre.lucro_liquido_pct} destaque negativo={dre.lucro_liquido < 0} />
        </div>

        {dre.custos_fixos === 0 && (
          <p className="text-xs text-text-muted">
            Nenhum custo fixo cadastrado.{' '}
            <a href="/financeiro/custos-fixos" className="text-brand hover:underline">
              Cadastrar custos fixos
            </a>
          </p>
        )}

        {/* Serie: esta crescendo ou caindo? Custos fixos usam o total atual
            em todos os meses (o cadastro nao guarda historico). */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-text">Últimos 6 meses</h2>
          <Tabela minWidth={640}>
            <TabelaHead>
              <tr>
                <TabelaHeadCell>Mês</TabelaHeadCell>
                <TabelaHeadCell alinhar="direita">Receita</TabelaHeadCell>
                <TabelaHeadCell alinhar="direita">CMV</TabelaHeadCell>
                <TabelaHeadCell alinhar="direita">Margem</TabelaHeadCell>
                <TabelaHeadCell alinhar="direita">Custos Fixos</TabelaHeadCell>
                <TabelaHeadCell alinhar="direita">Lucro</TabelaHeadCell>
              </tr>
            </TabelaHead>
            <TabelaBody>
              {serie.map((m) => (
                <TabelaRow key={m.mes}>
                  <TabelaCell className="font-medium">{mesCurto(m.mes)}</TabelaCell>
                  <TabelaCell alinhar="direita">{formatarReal(m.receita_bruta)}</TabelaCell>
                  <TabelaCell alinhar="direita" className="text-text-muted">
                    {formatarReal(m.cmv)}
                  </TabelaCell>
                  <TabelaCell alinhar="direita">{formatarReal(m.margem_bruta)}</TabelaCell>
                  <TabelaCell alinhar="direita" className="text-text-muted">
                    {formatarReal(m.custos_fixos)}
                  </TabelaCell>
                  <TabelaCell alinhar="direita">
                    <span
                      className={`font-mono font-semibold tabular-nums ${
                        m.lucro_liquido > 0 ? 'text-ok' : m.lucro_liquido < 0 ? 'text-err' : 'text-text-muted'
                      }`}
                    >
                      {formatarReal(m.lucro_liquido)}
                    </span>
                  </TabelaCell>
                </TabelaRow>
              ))}
            </TabelaBody>
          </Tabela>
        </div>
      </div>
    </div>
  )
}
