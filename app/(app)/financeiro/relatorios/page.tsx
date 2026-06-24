import { TrendingUp } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database.types'

import { PageHeader } from '@/components/ui-kit/PageHeader'
import {
  Tabela,
  TabelaHead,
  TabelaHeadCell,
  TabelaBody,
  TabelaRow,
  TabelaCell,
} from '@/components/ui-kit/tabela'
import { EstadoVazio } from '@/components/ui-kit/EstadoVazio'
import { Money } from '@/components/ui-kit/Money'
import { formatarNumero } from '@/lib/formatos'

import { FinanceiroTabs } from '@/components/financeiro/FinanceiroTabs'
import {
  GraficoFaturamento,
  type PontoFaturamento,
} from '@/components/financeiro/GraficoFaturamento'

type FaturamentoRow = Database['public']['Views']['v_faturamento_mensal']['Row']
type CurvaABCRow = Database['public']['Views']['v_curva_abc']['Row']

const MES_CURTO = new Intl.DateTimeFormat('pt-BR', {
  month: 'short',
  year: '2-digit',
})
const MES_LONGO = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
})

function capitalizar(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const CLASSE_PILL: Record<string, string> = {
  A: 'text-ok bg-ok/10',
  B: 'text-warn bg-warn/10',
  C: 'text-text-muted bg-surface-2',
}

export default async function RelatoriosPage() {
  const supabase = await createClient()

  const [{ data: faturamentoRaw }, { data: curvaRaw }] = await Promise.all([
    supabase.from('v_faturamento_mensal').select('*').limit(12),
    supabase.from('v_curva_abc').select('*').limit(40),
  ])

  // Casts explícitos: as Views vêm como `never` sem o cast (padrão do projeto).
  const faturamento = (faturamentoRaw ?? []) as FaturamentoRow[]
  const curvaABC = (curvaRaw ?? []) as CurvaABCRow[]

  // Ordena cronologicamente e monta os pontos do gráfico (mais antigo → recente).
  const faturamentoOrdenado = [...faturamento].sort(
    (a, b) => new Date(a.mes).getTime() - new Date(b.mes).getTime(),
  )

  const pontos: PontoFaturamento[] = faturamentoOrdenado.map((f) => {
    const data = new Date(f.mes)
    return {
      mes: MES_CURTO.format(data).replace('.', ''),
      rotulo: capitalizar(MES_LONGO.format(data)),
      // sum() do Postgres chega como string via PostgREST; recharts exige number.
      receita: Number(f.receita_bruta ?? 0),
      pedidos: Number(f.total_pedidos ?? 0),
    }
  })

  // Tabela de faturamento: mais recente no topo.
  const faturamentoTabela = [...faturamentoOrdenado].reverse()

  return (
    <div className="px-6 py-5">
      <FinanceiroTabs />

      <PageHeader
        titulo="Relatórios"
        subtitulo="Visão de faturamento mês a mês e os produtos que mais pesam no caixa."
      />

      <section className="mb-8">
        <div className="rounded-xl border border-border bg-surface p-5 shadow-[0_12px_28px_-18px_rgba(0,0,0,0.55)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-text">
                Faturamento mensal
              </h2>
              <p className="mt-0.5 text-xs text-text-muted">
                Receita bruta por mês. O mês mais recente aparece em dourado.
              </p>
            </div>
            <span className="flex size-8 items-center justify-center rounded-lg bg-surface-2 text-text-muted">
              <TrendingUp className="size-4" strokeWidth={1.5} />
            </span>
          </div>

          <GraficoFaturamento dados={pontos} />
        </div>

        {faturamentoTabela.length > 0 && (
          <div className="mt-4">
            <Tabela>
              <TabelaHead>
                <tr>
                  <TabelaHeadCell>Mês</TabelaHeadCell>
                  <TabelaHeadCell alinhar="direita">Pedidos</TabelaHeadCell>
                  <TabelaHeadCell alinhar="direita">
                    Receita bruta
                  </TabelaHeadCell>
                  <TabelaHeadCell alinhar="direita">
                    Ticket médio
                  </TabelaHeadCell>
                </tr>
              </TabelaHead>
              <TabelaBody>
                {faturamentoTabela.map((f, i) => (
                  <TabelaRow key={i}>
                    <TabelaCell className="font-medium">
                      {capitalizar(MES_LONGO.format(new Date(f.mes)))}
                    </TabelaCell>
                    <TabelaCell alinhar="direita" className="text-text-muted">
                      {formatarNumero(f.total_pedidos)}
                    </TabelaCell>
                    <TabelaCell alinhar="direita">
                      <Money valor={f.receita_bruta} destaque />
                    </TabelaCell>
                    <TabelaCell alinhar="direita">
                      <Money valor={f.ticket_medio} />
                    </TabelaCell>
                  </TabelaRow>
                ))}
              </TabelaBody>
            </Tabela>
          </div>
        )}
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-text">Curva ABC</h2>
          <p className="mt-0.5 text-xs text-text-muted">
            Produtos por participação no faturamento dos últimos 90 dias. Classe
            A concentra o maior peso.
          </p>
        </div>

        {curvaABC.length === 0 ? (
          <EstadoVazio
            icone={TrendingUp}
            titulo="Curva ABC sem dados"
            descricao="Sem vendas registradas nos últimos 90 dias."
          />
        ) : (
          <Tabela>
            <TabelaHead>
              <tr>
                <TabelaHeadCell>Produto</TabelaHeadCell>
                <TabelaHeadCell alinhar="direita">Unidades</TabelaHeadCell>
                <TabelaHeadCell alinhar="direita">Faturamento</TabelaHeadCell>
                <TabelaHeadCell alinhar="direita">% Acumulado</TabelaHeadCell>
                <TabelaHeadCell alinhar="centro">Classe</TabelaHeadCell>
              </tr>
            </TabelaHead>
            <TabelaBody>
              {curvaABC.map((p) => (
                <TabelaRow key={p.produto_id}>
                  <TabelaCell className="font-medium">{p.nome}</TabelaCell>
                  <TabelaCell alinhar="direita" className="text-text-muted">
                    {formatarNumero(p.total_unidades)}
                  </TabelaCell>
                  <TabelaCell alinhar="direita">
                    <Money valor={p.total_faturamento} />
                  </TabelaCell>
                  <TabelaCell alinhar="direita" className="text-text-muted">
                    {formatarNumero(p.pct_acumulado, 1)}%
                  </TabelaCell>
                  <TabelaCell alinhar="centro">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        CLASSE_PILL[p.classe_abc] ?? CLASSE_PILL.C
                      }`}
                    >
                      <span className="size-1.5 rounded-full bg-current" />
                      {p.classe_abc}
                    </span>
                  </TabelaCell>
                </TabelaRow>
              ))}
            </TabelaBody>
          </Tabela>
        )}
      </section>
    </div>
  )
}
