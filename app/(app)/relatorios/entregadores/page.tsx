'use client'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Bike } from 'lucide-react'
import { relatorioEntregadores, type LinhaEntregador } from '@/lib/actions/relatorio-entregadores'
import { turnosAbertosPorEntregador } from '@/lib/actions/turnos'
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
import { formatarNumero, hojeBrasil } from '@/lib/formatos'
import { FiltroPeriodo } from '@/components/relatorios/FiltroPeriodo'

function mesCorrente() {
  const hoje = hojeBrasil()
  return { ini: hoje.slice(0, 8) + '01', fim: hoje }
}

// "72" -> "1h 12min"; "45" -> "45 min"
function tempoLegivel(min: number | null): string {
  if (min == null) return '—'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const resto = min % 60
  return resto > 0 ? `${h}h ${resto}min` : `${h}h`
}

export default function RelatorioEntregadoresPage() {
  const [periodo, setPeriodo] = useState(mesCorrente())
  const [linhas, setLinhas] = useState<LinhaEntregador[]>([])
  const [turnosAbertos, setTurnosAbertos] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  async function carregar(p: { ini: string; fim: string }) {
    setLoading(true)
    try {
      const [dados, turnos] = await Promise.all([relatorioEntregadores(p), turnosAbertosPorEntregador()])
      setLinhas(dados)
      setTurnosAbertos(turnos)
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

  const totalEntregas = linhas.reduce((s, l) => s + l.entregas, 0)

  return (
    <div className="px-6 py-5">
      <PageHeader
        titulo="Entregadores"
        subtitulo="Quem entregou, quantas vezes e em quanto tempo."
      />
      <FiltroPeriodo tipo="sem-pdf" ini={periodo.ini} fim={periodo.fim} onAplicar={aplicar} />

      {linhas.length > 0 && (
        <div className="mb-4 inline-flex rounded-lg border border-border bg-surface px-3 py-2">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-text-muted">
              Entregas no período
            </p>
            <p className="font-mono text-sm font-semibold tabular-nums text-text">
              {formatarNumero(totalEntregas)}
            </p>
          </div>
        </div>
      )}

      {loading ? null : linhas.length === 0 ? (
        <EstadoVazio
          icone={Bike}
          titulo="Nenhuma entrega concluída no período"
          descricao="Entregas confirmadas com entregador designado aparecem aqui."
        />
      ) : (
        <Tabela minWidth={560}>
          <TabelaHead>
            <tr>
              <TabelaHeadCell>Entregador</TabelaHeadCell>
              <TabelaHeadCell>Turno</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita">Entregas</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita">Tempo médio</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita">Frete somado</TabelaHeadCell>
            </tr>
          </TabelaHead>
          <TabelaBody>
            {linhas.map((l) => (
              <TabelaRow key={l.entregador_id}>
                <TabelaCell className="font-medium">{l.nome}</TabelaCell>
                <TabelaCell>
                  {turnosAbertos[l.entregador_id] ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ok">
                      <span className="size-1.5 rounded-full bg-ok" aria-hidden />
                      Em expediente
                    </span>
                  ) : (
                    <span className="text-xs text-text-muted">Fora</span>
                  )}
                </TabelaCell>
                <TabelaCell alinhar="direita">{formatarNumero(l.entregas)}</TabelaCell>
                <TabelaCell alinhar="direita" className="text-text-muted">
                  {tempoLegivel(l.tempo_medio_min)}
                </TabelaCell>
                <TabelaCell alinhar="direita">
                  <Money valor={l.frete_total} />
                </TabelaCell>
              </TabelaRow>
            ))}
          </TabelaBody>
        </Tabela>
      )}
    </div>
  )
}
