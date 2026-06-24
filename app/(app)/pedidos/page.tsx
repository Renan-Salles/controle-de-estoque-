import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Printer, ShoppingCart } from 'lucide-react'
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
import { Money } from '@/components/ui-kit/Money'
import { formatarData } from '@/lib/formatos'
import {
  STATUS_PEDIDO_PILL,
  rotuloStatusPedido,
  rotuloPagamento,
} from '@/lib/pedido-labels'
import { cn } from '@/lib/utils'

type PedidoLinha = {
  id: string
  numero_pedido: number
  status: string
  total: number
  data_pedido: string
  forma_pagamento: string
  clientes: { nome: string } | null
}

const FILTROS = [
  { chave: '', rotulo: 'Todos' },
  { chave: 'confirmado', rotulo: 'Confirmado' },
  { chave: 'em_separacao', rotulo: 'Em separação' },
  { chave: 'saiu_entrega', rotulo: 'Saiu entrega' },
  { chave: 'entregue', rotulo: 'Entregue' },
  { chave: 'cancelado', rotulo: 'Cancelado' },
] as const

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const filtroAtivo = status ?? ''

  const supabase = await createClient()
  let query = supabase
    .from('pedidos')
    .select(
      'id, numero_pedido, status, total, data_pedido, forma_pagamento, clientes(nome)',
    )
    .order('created_at', { ascending: false })
    .limit(100)

  if (filtroAtivo) query = query.eq('status', filtroAtivo)

  const { data: pedidosRaw } = await query
  const pedidos = (pedidosRaw ?? []) as unknown as PedidoLinha[]

  return (
    <div>
      <PageHeader
        titulo="Pedidos"
        subtitulo="Vendas no balcão e por telefone"
      >
        <Link
          href="/pedidos/novo"
          className="u-motion inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-primary-foreground hover:bg-brand-strong active:scale-[0.98]"
        >
          <Plus className="size-4" strokeWidth={2} />
          Novo pedido
        </Link>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {FILTROS.map((f) => {
          const ativo = filtroAtivo === f.chave
          return (
            <Link
              key={f.chave || 'todos'}
              href={f.chave ? `/pedidos?status=${f.chave}` : '/pedidos'}
              className={cn(
                'u-motion inline-flex h-7 items-center rounded-full px-3 text-[13px] font-medium',
                ativo
                  ? 'bg-brand text-primary-foreground'
                  : 'border border-border bg-surface text-text-muted hover:bg-surface-2 hover:text-text',
              )}
            >
              {f.rotulo}
            </Link>
          )
        })}
      </div>

      {pedidos.length === 0 ? (
        <EstadoVazio
          icone={ShoppingCart}
          titulo={
            filtroAtivo
              ? 'Nenhum pedido neste status'
              : 'Nenhum pedido ainda'
          }
          descricao={
            filtroAtivo
              ? 'Tente outro filtro ou registre um novo pedido.'
              : 'Registre o primeiro pedido para começar a vender.'
          }
          acao={
            <Link
              href="/pedidos/novo"
              className="u-motion inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-primary-foreground hover:bg-brand-strong active:scale-[0.98]"
            >
              <Plus className="size-4" strokeWidth={2} />
              Novo pedido
            </Link>
          }
        />
      ) : (
        <Tabela>
          <TabelaHead>
            <tr>
              <TabelaHeadCell>#</TabelaHeadCell>
              <TabelaHeadCell>Cliente</TabelaHeadCell>
              <TabelaHeadCell>Data</TabelaHeadCell>
              <TabelaHeadCell>Pagamento</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita">Total</TabelaHeadCell>
              <TabelaHeadCell>Status</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita"> </TabelaHeadCell>
            </tr>
          </TabelaHead>
          <TabelaBody>
            {pedidos.map((p) => (
              <TabelaRow key={p.id} className="group">
                <TabelaCell mono className="text-text-muted">
                  <Link
                    href={`/pedidos/${p.id}`}
                    className="block font-medium text-text hover:text-brand"
                  >
                    #{String(p.numero_pedido).padStart(4, '0')}
                  </Link>
                </TabelaCell>
                <TabelaCell>
                  <Link
                    href={`/pedidos/${p.id}`}
                    className="block font-medium text-text hover:text-brand"
                  >
                    {p.clientes?.nome ?? 'Cliente removido'}
                  </Link>
                </TabelaCell>
                <TabelaCell className="text-text-muted">
                  <Link href={`/pedidos/${p.id}`} className="block">
                    {formatarData(p.data_pedido)}
                  </Link>
                </TabelaCell>
                <TabelaCell className="text-text-muted">
                  <Link href={`/pedidos/${p.id}`} className="block">
                    {rotuloPagamento(p.forma_pagamento)}
                  </Link>
                </TabelaCell>
                <TabelaCell alinhar="direita">
                  <Link href={`/pedidos/${p.id}`} className="block">
                    <Money valor={p.total} destaque />
                  </Link>
                </TabelaCell>
                <TabelaCell>
                  <Link href={`/pedidos/${p.id}`} className="block">
                    <StatusPill
                      status={STATUS_PEDIDO_PILL[p.status] ?? 'inativo'}
                      label={rotuloStatusPedido(p.status)}
                    />
                  </Link>
                </TabelaCell>
                <TabelaCell alinhar="direita">
                  <Link
                    href={`/pedidos/${p.id}/romaneio`}
                    className="u-motion inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-text-muted opacity-70 hover:bg-surface-2 hover:text-text group-hover:opacity-100"
                  >
                    <Printer className="size-3.5" strokeWidth={1.5} />
                    Romaneio
                  </Link>
                </TabelaCell>
              </TabelaRow>
            ))}
          </TabelaBody>
        </Tabela>
      )}
    </div>
  )
}
