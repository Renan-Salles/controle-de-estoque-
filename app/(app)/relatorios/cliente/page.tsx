'use client'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Users } from 'lucide-react'
import { relatorioVendasCliente } from '@/lib/actions/relatorios'
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

type Linha = Awaited<ReturnType<typeof relatorioVendasCliente>>[number]

export default function RelatorioClientePage() {
  const [periodo, setPeriodo] = useState(mesCorrente())
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [loading, setLoading] = useState(true)

  async function carregar(p: { ini: string; fim: string }) {
    setLoading(true)
    try {
      setLinhas(await relatorioVendasCliente(p))
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

  const totalGeral = linhas.reduce((s, l) => s + l.total, 0)

  return (
    <div className="px-6 py-5">
      <RelatoriosTabs />
      <PageHeader
        titulo="Vendas por cliente"
        subtitulo="Quanto cada cliente comprou no período."
      />
      <FiltroPeriodo tipo="cliente" ini={periodo.ini} fim={periodo.fim} onAplicar={aplicar} />

      {linhas.length > 0 && (
        <div className="mb-4 inline-flex rounded-lg border border-border bg-surface px-3 py-2">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-text-muted">
              Total no período
            </p>
            <Money valor={totalGeral} destaque className="text-sm font-semibold" />
          </div>
        </div>
      )}

      {loading ? null : linhas.length === 0 ? (
        <EstadoVazio
          icone={Users}
          titulo="Sem vendas no período"
          descricao="Ajuste as datas para ver as compras por cliente."
        />
      ) : (
        <>
          {/* Desktop: tabela */}
          <div className="hidden lg:block">
            <Tabela>
              <TabelaHead>
                <tr>
                  <TabelaHeadCell>Cliente</TabelaHeadCell>
                  <TabelaHeadCell alinhar="direita">Pedidos</TabelaHeadCell>
                  <TabelaHeadCell alinhar="direita">Total</TabelaHeadCell>
                </tr>
              </TabelaHead>
              <TabelaBody>
                {linhas.map((l, i) => (
                  <TabelaRow key={l.cliente_id ?? `balcao-${i}`}>
                    <TabelaCell className="font-medium">{l.nome}</TabelaCell>
                    <TabelaCell alinhar="direita" className="text-text-muted">
                      {formatarNumero(l.pedidos)}
                    </TabelaCell>
                    <TabelaCell alinhar="direita">
                      <Money valor={l.total} />
                    </TabelaCell>
                  </TabelaRow>
                ))}
              </TabelaBody>
            </Tabela>
          </div>

          {/* Mobile: cards */}
          <div className="space-y-2 lg:hidden">
            {linhas.map((l, i) => (
              <CardLinha
                key={l.cliente_id ?? `balcao-${i}`}
                titulo={l.nome}
                destaque={<Money valor={l.total} destaque />}
                campos={[{ label: 'Pedidos', valor: formatarNumero(l.pedidos) }]}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
