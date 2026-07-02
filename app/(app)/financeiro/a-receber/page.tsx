'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowDownToLine, BadgeCheck, Clock, HandCoins } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

import { PageHeader } from '@/components/ui-kit/PageHeader'
import {
  Tabela,
  TabelaHead,
  TabelaHeadCell,
  TabelaBody,
  TabelaRow,
  TabelaCell,
} from '@/components/ui-kit/tabela'
import { StatusPill } from '@/components/ui-kit/StatusPill'
import { EstadoVazio } from '@/components/ui-kit/EstadoVazio'
import { SkeletonLinhas } from '@/components/ui-kit/SkeletonLinhas'
import { Money } from '@/components/ui-kit/Money'
import { formatarData, addDias, hojeBrasil } from '@/lib/formatos'

import { KpiFinanceiro } from '@/components/financeiro/KpiFinanceiro'
import { FiltroStatus, type OpcaoFiltro } from '@/components/financeiro/FiltroStatus'

import {
  buscarContasReceber,
  marcarContaReceberPaga,
  buscarResumoFiado,
} from '@/lib/actions/financeiro'

type ContaReceber = {
  id: string
  pedido_id: string | null
  descricao: string | null
  valor: number
  valor_pago: number
  status: string
  data_vencimento: string
  clientes: { nome: string; telefone: string | null } | null
  pedidos: { numero_pedido: number } | null
}

const FILTROS: OpcaoFiltro[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'aberto', label: 'Em aberto' },
  { value: 'pago', label: 'Recebido' },
]

const RESUMO_VAZIO = { totalAberto: 0, qtdVencidas: 0, totalVencido: 0, qtdVencendo: 0, totalVencendo: 0 }

export default function ContasReceberPage() {
  const [contas, setContas] = useState<ContaReceber[]>([])
  const [filtroStatus, setFiltroStatus] = useState('aberto')
  const [carregando, setCarregando] = useState(true)
  const [resumo, setResumo] = useState(RESUMO_VAZIO)
  const [marcandoId, setMarcandoId] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const [dados, res] = await Promise.all([
        buscarContasReceber(filtroStatus),
        buscarResumoFiado(),
      ])
      setContas(dados as unknown as ContaReceber[])
      setResumo(res)
    } catch {
      toast.error('Não foi possível carregar os fiados.')
    } finally {
      setCarregando(false)
    }
  }, [filtroStatus])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar()
  }, [carregar])

  const hoje = hojeBrasil()

  async function marcarPago(id: string) {
    setMarcandoId(id)
    const resultado = await marcarContaReceberPaga(id)
    setMarcandoId(null)
    if (resultado.error) {
      toast.error(resultado.error)
      return
    }
    toast.success('Fiado marcado como recebido')
    carregar()
  }

  return (
    <div className="px-6 py-5">
      <PageHeader
        titulo="Fiado / A receber"
        subtitulo="Vendas fiado em aberto, com prazo escolhido na venda e aviso de vencimento."
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiFinanceiro
          rotulo="Em aberto"
          valor={resumo.totalAberto}
          icone={ArrowDownToLine}
          tom="neutro"
        />
        <KpiFinanceiro
          rotulo="Vencendo em 3 dias"
          valor={resumo.totalVencendo}
          icone={Clock}
          tom={resumo.qtdVencendo > 0 ? 'critico' : 'neutro'}
          hint={resumo.qtdVencendo > 0 ? `${resumo.qtdVencendo} fiado${resumo.qtdVencendo > 1 ? 's' : ''}` : undefined}
        />
        <KpiFinanceiro
          rotulo="Vencido"
          valor={resumo.totalVencido}
          icone={BadgeCheck}
          tom={resumo.qtdVencidas > 0 ? 'critico' : 'neutro'}
          hint={resumo.qtdVencidas > 0 ? `${resumo.qtdVencidas} fiado${resumo.qtdVencidas > 1 ? 's' : ''}` : undefined}
        />
      </div>

      <div className="mb-4">
        <FiltroStatus opcoes={FILTROS} valor={filtroStatus} onChange={setFiltroStatus} />
      </div>

      {carregando ? (
        <SkeletonLinhas colunas={6} linhas={7} />
      ) : contas.length === 0 ? (
        <EstadoVazio
          icone={HandCoins}
          titulo="Nenhum fiado por aqui"
          descricao="Vendas registradas como fiado aparecem aqui automaticamente, com o prazo escolhido na hora da venda."
        />
      ) : (
        <Tabela>
          <TabelaHead>
            <tr>
              <TabelaHeadCell>Cliente</TabelaHeadCell>
              <TabelaHeadCell>Venda</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita">Valor</TabelaHeadCell>
              <TabelaHeadCell>Vencimento</TabelaHeadCell>
              <TabelaHeadCell>Status</TabelaHeadCell>
              <TabelaHeadCell />
            </tr>
          </TabelaHead>
          <TabelaBody>
            {contas.map((c) => {
              const aberta = c.status === 'aberto'
              const vencida = aberta && c.data_vencimento < hoje
              const vencendo = aberta && !vencida && c.data_vencimento <= addDias(hoje, 3)
              return (
                <TabelaRow
                  key={c.id}
                  className={vencida ? 'bg-err/5 hover:bg-err/10' : vencendo ? 'bg-warn/5 hover:bg-warn/10' : undefined}
                >
                  <TabelaCell className="font-medium">
                    {c.clientes?.nome ?? '-'}
                  </TabelaCell>
                  <TabelaCell className="text-text-muted">
                    {c.pedidos ? `#${String(c.pedidos.numero_pedido).padStart(4, '0')}` : c.descricao || '-'}
                  </TabelaCell>
                  <TabelaCell alinhar="direita">
                    <Money valor={c.valor} />
                  </TabelaCell>
                  <TabelaCell mono className={vencida ? 'text-err' : vencendo ? 'text-warn' : 'text-text-muted'}>
                    {formatarData(`${c.data_vencimento}T00:00:00`)}
                  </TabelaCell>
                  <TabelaCell>
                    <StatusPill status={vencida ? 'vencido' : c.status} />
                  </TabelaCell>
                  <TabelaCell alinhar="direita">
                    {aberta && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="u-press"
                        disabled={marcandoId === c.id}
                        onClick={() => marcarPago(c.id)}
                      >
                        {marcandoId === c.id ? 'Marcando...' : 'Marcar recebido'}
                      </Button>
                    )}
                  </TabelaCell>
                </TabelaRow>
              )
            })}
          </TabelaBody>
        </Tabela>
      )}
    </div>
  )
}
