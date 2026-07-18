import Link from 'next/link'
import { Printer, Pencil } from 'lucide-react'
import { Money } from '@/components/ui-kit/Money'
import { StatusPill } from '@/components/ui-kit/StatusPill'
import { formatarData } from '@/lib/formatos'
import type { PedidoRecente } from '@/lib/actions/pedidos'

export function PedidosRecentes({
  pedidos,
  editaveis,
}: {
  pedidos: PedidoRecente[]
  /** ids dos pedidos que podem ser editados agora (ja calculado no servidor) */
  editaveis: Set<string>
}) {
  if (pedidos.length === 0) return null

  return (
    <div className="u-stagger mt-6 rounded-xl border border-border bg-surface p-5">
      <h2 className="mb-1 text-sm font-semibold tracking-tight text-text">
        Pedidos recentes
      </h2>
      <p className="mb-4 text-[11px] uppercase tracking-wider text-text-muted">
        Últimos {pedidos.length}
      </p>
      <div className="-mx-2 divide-y divide-border/60">
        {pedidos.map((p) => {
          const numeroFmt = `#${String(p.numero_pedido).padStart(4, '0')}`
          const cancelada = p.status === 'cancelada'
          return (
            <div key={p.id} className="flex items-center gap-3 px-2 py-3">
              <Link href={`/pedidos/${p.id}`} className="min-w-0 flex-1 hover:text-brand">
                <p className="truncate text-sm font-medium text-text">
                  {numeroFmt} · {p.cliente_nome ?? 'Venda de balcão'}
                </p>
                <p className="text-[13px] text-text-muted">{formatarData(p.data_pedido)}</p>
              </Link>
              <StatusPill status={cancelada ? 'critico' : 'ok'} label={cancelada ? 'Cancelada' : 'Concluída'} />
              <Money valor={p.total} destaque className="shrink-0 text-sm font-semibold" />
              <div className="flex shrink-0 items-center gap-1">
                <Link
                  href={`/pedidos/${p.id}/romaneio`}
                  className="u-motion flex size-8 items-center justify-center rounded-lg border border-border bg-surface text-text-muted hover:bg-surface-2 hover:text-text"
                  aria-label="Reimprimir"
                >
                  <Printer className="size-3.5" strokeWidth={1.5} />
                </Link>
                {editaveis.has(p.id) && (
                  <Link
                    href={`/pedidos/${p.id}/editar`}
                    className="u-motion flex size-8 items-center justify-center rounded-lg border border-border bg-surface text-text-muted hover:bg-surface-2 hover:text-text"
                    aria-label="Editar"
                  >
                    <Pencil className="size-3.5" strokeWidth={1.5} />
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
