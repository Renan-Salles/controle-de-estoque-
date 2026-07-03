import { PageHeader } from '@/components/ui-kit/PageHeader'
import { EstoqueTabs } from '@/components/estoque/EstoqueTabs'
import { listarInventarios } from '@/lib/actions/inventario'
import { ContagemClient } from './ContagemClient'
import { formatarData } from '@/lib/formatos'

export default async function ContagemPage() {
  const historico = await listarInventarios(20)

  return (
    <div className="px-6 py-5">
      <PageHeader
        titulo="Contagem de estoque"
        subtitulo="Conte as garrafas de verdade, digite o que achou e o sistema ajusta as diferenças."
      />
      <EstoqueTabs />
      <ContagemClient />

      {historico.length > 0 && (
        <div className="mt-8 rounded-xl border border-border bg-surface">
          <p className="border-b border-border px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Contagens anteriores
          </p>
          <ul className="divide-y divide-border/60">
            {historico.map((i) => (
              <li key={i.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span className="text-text-muted">
                  {formatarData(i.created_at)} · {i.realizado_por_nome ?? '-'}
                </span>
                <span className="font-mono text-xs tabular-nums text-text-muted">
                  {i.itens_conferidos} conferidos ·{' '}
                  <span className={i.itens_divergentes > 0 ? 'font-semibold text-warn' : 'text-ok'}>
                    {i.itens_divergentes} divergentes
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
