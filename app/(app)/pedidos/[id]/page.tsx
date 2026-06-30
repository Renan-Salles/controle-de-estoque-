import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Printer, User, CalendarDays, CreditCard, StickyNote, Ban, Clock } from 'lucide-react'
import { PageHeader } from '@/components/ui-kit/PageHeader'
import { StatusPill } from '@/components/ui-kit/StatusPill'
import { BotaoCancelar } from '@/components/movimentacao/BotaoCancelar'
import {
  Tabela,
  TabelaHead,
  TabelaHeadCell,
  TabelaBody,
  TabelaRow,
  TabelaCell,
} from '@/components/ui-kit/tabela'
import { Money } from '@/components/ui-kit/Money'
import { formatarData } from '@/lib/formatos'
import { rotuloPagamento } from '@/lib/pedido-labels'

type VendaComRelacoes = {
  id: string
  numero_pedido: number
  status: string
  total: number
  subtotal: number
  data_pedido: string
  forma_pagamento: string
  prazo_pagamento_dias: number
  data_vencimento: string | null
  observacoes: string | null
  clientes: { nome: string; telefone: string | null } | null
  pedido_itens: {
    quantidade_pedida: number
    preco_unitario: number
    total: number
    produtos: { nome: string; embalagem: string }
  }[]
}

function LinhaDado({
  icone: Icone,
  rotulo,
  valor,
}: {
  icone: typeof User
  rotulo: string
  valor: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-2 text-text-muted">
        <Icone className="size-3.5" strokeWidth={1.5} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          {rotulo}
        </p>
        <p className="mt-0.5 text-sm text-text">{valor}</p>
      </div>
    </div>
  )
}

export default async function VendaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: vendaRaw } = await supabase
    .from('pedidos')
    .select(
      `id, numero_pedido, status, total, subtotal, data_pedido, forma_pagamento, prazo_pagamento_dias, data_vencimento, observacoes, clientes(nome, telefone), pedido_itens(quantidade_pedida, preco_unitario, total, produtos(nome, embalagem))`,
    )
    .eq('id', id)
    .single()

  if (!vendaRaw) notFound()
  const venda = vendaRaw as unknown as VendaComRelacoes

  const numeroFmt = `#${String(venda.numero_pedido).padStart(4, '0')}`
  const cancelada = venda.status === 'cancelada'

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/movimentacoes"
        className="u-motion mb-3 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" strokeWidth={1.5} />
        Movimentações
      </Link>

      <PageHeader titulo={`Venda ${numeroFmt}`}>
        <StatusPill
          status={cancelada ? 'critico' : 'ok'}
          label={cancelada ? 'Cancelada' : 'Concluída'}
        />
        <Link
          href={`/pedidos/${venda.id}/romaneio`}
          className="u-motion inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text hover:bg-surface-2 active:scale-[0.98]"
        >
          <Printer className="size-4" strokeWidth={1.5} />
          Romaneio
        </Link>
        {!cancelada && (
          <BotaoCancelar pedidoId={venda.id} numero={numeroFmt} />
        )}
      </PageHeader>

      {/* Aviso de venda cancelada */}
      {cancelada && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-err/30 bg-err/10 px-4 py-3">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-err/15 text-err">
            <Ban className="size-3.5" strokeWidth={1.5} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-err">Venda cancelada</p>
            <p className="mt-0.5 text-sm text-text-muted">
              Os itens foram devolvidos ao estoque. Esta venda não conta no
              faturamento.
            </p>
          </div>
        </div>
      )}

      {/* Dados do cliente / pagamento */}
      <div className="grid grid-cols-1 divide-y divide-border/60 overflow-clip rounded-lg border border-border bg-surface sm:grid-cols-2 sm:divide-y-0 sm:[&>*:nth-child(odd)]:border-r sm:[&>*]:border-border/60 sm:[&>*:nth-child(n+3)]:border-t">
        <LinhaDado
          icone={User}
          rotulo="Cliente"
          valor={
            venda.clientes?.nome ? (
              <>
                {venda.clientes.nome}
                {venda.clientes.telefone && (
                  <span className="ml-2 font-mono text-xs tabular-nums text-text-muted">
                    {venda.clientes.telefone}
                  </span>
                )}
              </>
            ) : (
              <span className="text-text-muted">Venda de balcão</span>
            )
          }
        />
        <LinhaDado
          icone={CalendarDays}
          rotulo="Data"
          valor={formatarData(venda.data_pedido)}
        />
        <LinhaDado
          icone={CreditCard}
          rotulo="Pagamento"
          valor={rotuloPagamento(venda.forma_pagamento)}
        />
        {venda.forma_pagamento === 'fiado' && venda.data_vencimento && (
          <LinhaDado
            icone={Clock}
            rotulo="Vencimento"
            valor={`${formatarData(venda.data_vencimento)} (${venda.prazo_pagamento_dias} dias)`}
          />
        )}
        <LinhaDado
          icone={StickyNote}
          rotulo="Observações"
          valor={
            venda.observacoes ? (
              venda.observacoes
            ) : (
              <span className="text-text-muted">Nenhuma</span>
            )
          }
        />
      </div>

      {/* Itens */}
      <div className="mt-5">
        <Tabela>
          <TabelaHead>
            <tr>
              <TabelaHeadCell>Produto</TabelaHeadCell>
              <TabelaHeadCell alinhar="centro">Qtde</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita">Preço un.</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita">Total</TabelaHeadCell>
            </tr>
          </TabelaHead>
          <TabelaBody>
            {venda.pedido_itens.map((item, i) => (
              <TabelaRow key={i}>
                <TabelaCell className="font-medium">
                  {item.produtos.nome}
                </TabelaCell>
                <TabelaCell alinhar="centro">
                  {item.quantidade_pedida}{' '}
                  <span className="text-text-muted">{item.produtos.embalagem}</span>
                </TabelaCell>
                <TabelaCell alinhar="direita">
                  <Money valor={item.preco_unitario} />
                </TabelaCell>
                <TabelaCell alinhar="direita">
                  <Money valor={item.total} className="font-medium" />
                </TabelaCell>
              </TabelaRow>
            ))}
          </TabelaBody>
          <tfoot>
            <tr className="border-t-2 border-border">
              <td colSpan={3} className="h-12 px-4 text-right text-sm font-semibold text-text">
                Total
              </td>
              <td className="h-12 px-4 text-right">
                <Money valor={venda.total} destaque className="text-lg font-semibold" />
              </td>
            </tr>
          </tfoot>
        </Tabela>
      </div>
    </div>
  )
}
