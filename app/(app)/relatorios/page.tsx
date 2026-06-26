'use client'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { BarChart3 } from 'lucide-react'
import { relatorioVendasPeriodo } from '@/lib/actions/relatorios'
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
import { FiltroPeriodo } from '@/components/relatorios/FiltroPeriodo'
import { RelatoriosTabs } from '@/components/relatorios/RelatoriosTabs'
import { CardLinha } from '@/components/ui-kit/CardLinha'

function mesCorrente() {
  const hoje = new Date().toISOString().slice(0, 10)
  const ini = hoje.slice(0, 8) + '01'
  return { ini, fim: hoje }
}

function dataBr(iso: string) {
  return iso.split('-').reverse().join('/')
}

type Dados = Awaited<ReturnType<typeof relatorioVendasPeriodo>>

export default function RelatorioPeriodoPage() {
  const [periodo, setPeriodo] = useState(mesCorrente())
  const [dados, setDados] = useState<Dados | null>(null)
  const [loading, setLoading] = useState(true)

  async function carregar(p: { ini: string; fim: string }) {
    setLoading(true)
    try {
      setDados(await relatorioVendasPeriodo(p))
    } catch (e) {
      console.error(e)
      toast.error('Erro ao carregar relatório')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar(periodo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function aplicar(p: { ini: string; fim: string }) {
    setPeriodo(p)
    carregar(p)
  }

  return (
    <div className="px-6 py-5">
      <RelatoriosTabs />
      <PageHeader
        titulo="Vendas por período"
        subtitulo="Faturamento e pedidos no intervalo escolhido."
      />
      <FiltroPeriodo tipo="periodo" ini={periodo.ini} fim={periodo.fim} onAplicar={aplicar} />

      {dados && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-surface px-3 py-2">
            <p className="text-[11px] uppercase tracking-wider text-text-muted">Receita</p>
            <Money valor={dados.totalReceita} destaque className="text-sm font-semibold" />
          </div>
          <div className="rounded-lg border border-border bg-surface px-3 py-2">
            <p className="text-[11px] uppercase tracking-wider text-text-muted">Pedidos</p>
            <p className="font-mono text-sm font-semibold text-text">
              {formatarNumero(dados.totalPedidos)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface px-3 py-2">
            <p className="text-[11px] uppercase tracking-wider text-text-muted">Ticket médio</p>
            <Money valor={dados.ticketMedio} className="text-sm font-semibold" />
          </div>
        </div>
      )}

      {loading ? null : !dados || dados.dias.length === 0 ? (
        <EstadoVazio
          icone={BarChart3}
          titulo="Sem vendas no período"
          descricao="Ajuste as datas para ver o faturamento."
        />
      ) : (
        <>
          {/* Desktop: tabela */}
          <div className="hidden lg:block">
            <Tabela>
              <TabelaHead>
                <tr>
                  <TabelaHeadCell>Data</TabelaHeadCell>
                  <TabelaHeadCell alinhar="direita">Pedidos</TabelaHeadCell>
                  <TabelaHeadCell alinhar="direita">Receita</TabelaHeadCell>
                </tr>
              </TabelaHead>
              <TabelaBody>
                {dados.dias.map((d) => (
                  <TabelaRow key={d.data}>
                    <TabelaCell className="font-medium">{dataBr(d.data)}</TabelaCell>
                    <TabelaCell alinhar="direita" className="text-text-muted">
                      {formatarNumero(d.pedidos)}
                    </TabelaCell>
                    <TabelaCell alinhar="direita">
                      <Money valor={d.receita} />
                    </TabelaCell>
                  </TabelaRow>
                ))}
              </TabelaBody>
            </Tabela>
          </div>

          {/* Mobile: cards */}
          <div className="space-y-2 lg:hidden">
            {dados.dias.map((d) => (
              <CardLinha
                key={d.data}
                titulo={dataBr(d.data)}
                destaque={<Money valor={d.receita} destaque />}
                campos={[{ label: 'Pedidos', valor: formatarNumero(d.pedidos) }]}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
