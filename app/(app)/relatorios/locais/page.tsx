import { Store } from 'lucide-react'
import { PageHeader } from '@/components/ui-kit/PageHeader'
import { Money } from '@/components/ui-kit/Money'
import { EstadoVazio } from '@/components/ui-kit/EstadoVazio'
import { comparativoLocais } from '@/lib/actions/comparativo'
import { formatarNumero } from '@/lib/formatos'

export default async function ComparativoLocaisPage() {
  let locais
  try {
    locais = await comparativoLocais()
  } catch {
    // Nao-admin cai aqui (a funcao Postgres recusa). O item nem aparece na
    // sidebar de nao-admin, mas quem digitar a URL ve o aviso, nao um erro.
    return (
      <div className="px-6 py-5">
        <PageHeader titulo="Entre locais" />
        <EstadoVazio
          icone={Store}
          titulo="Somente administrador"
          descricao="O comparativo entre locais cruza dados de todos os pontos de venda."
        />
      </div>
    )
  }

  const totalReceita = locais.reduce((a, l) => a + l.receita, 0)

  return (
    <div className="px-6 py-5">
      <PageHeader
        titulo="Entre locais"
        subtitulo="Como cada ponto de venda está indo neste mês."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {locais.map((l) => {
          const participacao = totalReceita > 0 ? (l.receita / totalReceita) * 100 : 0
          return (
            <div
              key={l.local_id}
              className="rounded-xl border border-border bg-surface p-5 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.4)]"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-text">{l.local_nome}</h2>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[11px] tabular-nums text-text-muted">
                  {participacao.toFixed(0)}% da receita
                </span>
              </div>

              <div className="mt-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                  Receita do mês
                </p>
                <Money valor={l.receita} destaque className="mt-1 block text-2xl font-bold tracking-tight" />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border/60 pt-4 text-sm">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-text-muted">Vendas</p>
                  <p className="mt-0.5 font-mono font-semibold tabular-nums text-text">
                    {formatarNumero(l.vendas)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-text-muted">Ticket</p>
                  <p className="mt-0.5 font-mono font-semibold tabular-nums text-text">
                    <Money valor={l.ticket} className="text-sm" />
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-text-muted">Lucro bruto</p>
                  <p className="mt-0.5">
                    <Money
                      valor={l.lucro_bruto}
                      className={`text-sm font-semibold ${l.lucro_bruto >= 0 ? 'text-ok' : 'text-err'}`}
                    />
                  </p>
                </div>
              </div>

              {/* Barra de participacao na receita total */}
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-brand transition-[width] duration-500"
                  style={{ width: `${Math.min(100, participacao)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
