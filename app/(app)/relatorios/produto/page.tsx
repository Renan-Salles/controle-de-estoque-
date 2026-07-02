'use client'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Package } from 'lucide-react'
import { relatorioVendasProduto, produtosPorMargem } from '@/lib/actions/relatorios'
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
import { formatarNumero, formatarReal, hojeBrasil } from '@/lib/formatos'
import { FiltroPeriodo } from '@/components/relatorios/FiltroPeriodo'
import { RelatoriosTabs } from '@/components/relatorios/RelatoriosTabs'
import { CardLinha } from '@/components/ui-kit/CardLinha'

function mesCorrente() {
  const hoje = hojeBrasil()
  const ini = hoje.slice(0, 8) + '01'
  return { ini, fim: hoje }
}

type Linha = Awaited<ReturnType<typeof relatorioVendasProduto>>[number]
type LinhaMargem = Awaited<ReturnType<typeof produtosPorMargem>>[number]

export default function RelatorioProdutoPage() {
  const [periodo, setPeriodo] = useState(mesCorrente())
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [margem, setMargem] = useState<LinhaMargem[]>([])
  const [loading, setLoading] = useState(true)

  async function carregar(p: { ini: string; fim: string }) {
    setLoading(true)
    try {
      const [vendas, mg] = await Promise.all([relatorioVendasProduto(p), produtosPorMargem()])
      setLinhas(vendas)
      setMargem(mg)
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

  const totalFaturamento = linhas.reduce((s, l) => s + l.faturamento, 0)

  return (
    <div className="px-6 py-5">
      <RelatoriosTabs />
      <PageHeader
        titulo="Vendas por produto"
        subtitulo="Ranking de unidades e faturamento no período."
      />
      <FiltroPeriodo tipo="produto" ini={periodo.ini} fim={periodo.fim} onAplicar={aplicar} />

      {linhas.length > 0 && (
        <div className="mb-4 inline-flex rounded-lg border border-border bg-surface px-3 py-2">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-text-muted">
              Faturamento total
            </p>
            <Money valor={totalFaturamento} destaque className="text-sm font-semibold" />
          </div>
        </div>
      )}

      {loading ? null : linhas.length === 0 ? (
        <EstadoVazio
          icone={Package}
          titulo="Sem vendas no período"
          descricao="Ajuste as datas para ver os produtos vendidos."
        />
      ) : (
        <>
          {/* Desktop: tabela */}
          <div className="hidden lg:block">
            <Tabela>
              <TabelaHead>
                <tr>
                  <TabelaHeadCell>Produto</TabelaHeadCell>
                  <TabelaHeadCell alinhar="direita">Unidades</TabelaHeadCell>
                  <TabelaHeadCell alinhar="direita">Faturamento</TabelaHeadCell>
                </tr>
              </TabelaHead>
              <TabelaBody>
                {linhas.map((l) => (
                  <TabelaRow key={l.produto_id}>
                    <TabelaCell className="font-medium">{l.nome}</TabelaCell>
                    <TabelaCell alinhar="direita" className="text-text-muted">
                      {formatarNumero(l.unidades)}
                    </TabelaCell>
                    <TabelaCell alinhar="direita">
                      <Money valor={l.faturamento} />
                    </TabelaCell>
                  </TabelaRow>
                ))}
              </TabelaBody>
            </Tabela>
          </div>

          {/* Mobile: cards */}
          <div className="space-y-2 lg:hidden">
            {linhas.map((l) => (
              <CardLinha
                key={l.produto_id}
                titulo={l.nome}
                destaque={<Money valor={l.faturamento} destaque />}
                campos={[{ label: 'Unidades', valor: formatarNumero(l.unidades) }]}
              />
            ))}
          </div>
        </>
      )}

      {margem.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-base font-semibold text-text">Produtos por margem</h2>
          <div className="rounded-lg border border-border bg-surface overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <th className="px-4 py-2.5 text-left font-medium text-text-muted">Produto</th>
                  <th className="px-4 py-2.5 text-right font-medium text-text-muted hidden sm:table-cell">Custo</th>
                  <th className="px-4 py-2.5 text-right font-medium text-text-muted hidden sm:table-cell">Venda</th>
                  <th className="px-4 py-2.5 text-right font-medium text-text-muted">Margem R$</th>
                  <th className="px-4 py-2.5 text-right font-medium text-text-muted">Margem %</th>
                </tr>
              </thead>
              <tbody className="u-rows">
                {margem.slice(0, 25).map((p) => (
                  <tr key={p.produto_id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="text-sm text-text">{p.nome}</div>
                      <div className="text-xs text-text-muted">{p.categoria}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-text-muted hidden sm:table-cell">
                      {formatarReal(p.custo_medio)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-text hidden sm:table-cell">
                      {formatarReal(p.preco_venda_padrao)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-text">
                      {formatarReal(p.margem_rs)}
                    </td>
                    <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${
                      p.margem_pct >= 25 ? 'text-green-600 dark:text-green-400'
                      : p.margem_pct >= 10 ? 'text-text'
                      : 'text-err'
                    }`}>
                      {p.margem_pct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
