import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MessageCircle, ShoppingCart, Star, AlertCircle } from 'lucide-react'
import { PageHeader } from '@/components/ui-kit/PageHeader'
import { btnClass } from '@/components/ui-kit/Button'
import { formatarReal, formatarData } from '@/lib/formatos'
import { buscarStatsCliente, buscarHistoricoCliente } from '@/lib/actions/clientes-stats'
import { classificarCliente } from '@/lib/utils/clientes'

const BADGE: Record<string, { cls: string; label: string; icon?: boolean }> = {
  vip:     { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', label: 'VIP', icon: true },
  regular: { cls: 'bg-surface-2 text-text-muted', label: 'Regular' },
  sumido:  { cls: 'bg-err/10 text-err', label: 'Sumido' },
}

const FORMA: Record<string, string> = {
  dinheiro: 'Dinheiro', pix: 'PIX',
  cartao_debito: 'Débito', cartao_credito: 'Crédito',
}

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: raw } = await supabase.from('clientes').select('*').eq('id', id).single()
  if (!raw) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = raw as any
  const [stats, historico] = await Promise.all([buscarStatsCliente(id), buscarHistoricoCliente(id)])
  const classif = classificarCliente(stats)
  const badge = BADGE[classif]
  const tel = c.whatsapp || c.telefone
  const waLink = tel ? `https://wa.me/55${tel.replace(/\D/g, '')}` : null
  const end = c.endereco ?? {}
  const endStr = [end.rua, end.numero, end.bairro, end.cidade].filter(Boolean).join(', ')

  return (
    <div className="px-6 py-5">
      <PageHeader titulo={c.nome} back="/clientes" subtitulo={endStr || undefined}>
        {waLink && (
          <a href={waLink} target="_blank" rel="noopener noreferrer" className={btnClass('outline')}>
            <MessageCircle className="size-4" /> WhatsApp
          </a>
        )}
        <Link href={`/movimentacoes/nova?cliente_id=${id}`} className={btnClass('primary')}>
          <ShoppingCart className="size-4" /> Nova venda
        </Link>
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>
          {badge.icon && <Star className="size-3" />}
          {classif === 'sumido' && <AlertCircle className="size-3" />}
          {badge.label}
        </span>
        {stats.produto_favorito && (
          <span className="text-xs text-text-muted">
            Favorito: <strong className="text-text">{stats.produto_favorito}</strong>
          </span>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total gasto', valor: formatarReal(stats.valor_total) },
          { label: 'Compras', valor: String(stats.total_compras) },
          { label: 'Ticket médio', valor: formatarReal(stats.ticket_medio) },
          { label: 'Última compra', valor: stats.ultima_compra ? formatarData(stats.ultima_compra) : '-' },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs text-text-muted">{s.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-text">{s.valor}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 rounded-lg border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-text">Dados do cliente</h2>
        <dl className="grid gap-y-2 text-sm sm:grid-cols-2 sm:gap-x-8">
          {c.telefone && <><dt className="text-text-muted">Telefone</dt><dd className="text-text">{c.telefone}</dd></>}
          {c.whatsapp && <><dt className="text-text-muted">WhatsApp</dt><dd className="text-text">{c.whatsapp}</dd></>}
          {c.cpf_cnpj && <><dt className="text-text-muted">CPF/CNPJ</dt><dd className="text-text">{c.cpf_cnpj}</dd></>}
          {endStr && <><dt className="text-text-muted">Endereço</dt><dd className="text-text">{endStr}</dd></>}
          <dt className="text-text-muted">Forma padrão</dt>
          <dd className="text-text">{FORMA[c.forma_pagamento_padrao] ?? c.forma_pagamento_padrao}</dd>
          {c.prazo_pagamento_dias > 0 && (
            <><dt className="text-text-muted">Prazo</dt><dd className="text-text">{c.prazo_pagamento_dias} dias</dd></>
          )}
        </dl>
      </div>

      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-text">Últimas compras</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2">
              <th className="px-4 py-2.5 text-left font-medium text-text-muted">N</th>
              <th className="px-4 py-2.5 text-left font-medium text-text-muted">Data</th>
              <th className="px-4 py-2.5 text-left font-medium text-text-muted hidden sm:table-cell">Forma</th>
              <th className="px-4 py-2.5 text-right font-medium text-text-muted">Total</th>
            </tr>
          </thead>
          <tbody>
            {historico.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-text-muted">Nenhuma compra registrada</td></tr>
            )}
            {historico.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surface-2/50">
                <td className="px-4 py-2.5 text-text-muted">#{String(p.numero_pedido).padStart(4, '0')}</td>
                <td className="px-4 py-2.5 text-text">{formatarData(p.data_pedido)}</td>
                <td className="px-4 py-2.5 text-text-muted hidden sm:table-cell">
                  {FORMA[p.forma_pagamento] ?? p.forma_pagamento}
                </td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums text-text">{formatarReal(p.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
