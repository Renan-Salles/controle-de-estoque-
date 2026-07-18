import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Printer, User, CalendarDays, CreditCard, StickyNote, Ban, Clock } from 'lucide-react'
import { PageHeader } from '@/components/ui-kit/PageHeader'
import { StatusPill } from '@/components/ui-kit/StatusPill'
import { BotaoVoltar } from '@/components/ui-kit/BotaoVoltar'
import { BotaoCancelar } from '@/components/movimentacao/BotaoCancelar'
import { FulfillmentAcoes } from '@/components/movimentacao/FulfillmentAcoes'
import { getCargoUsuario } from '@/lib/permissoes'
import { listarEntregadoresElegiveis } from '@/lib/actions/cargos'
import { AtribuirEntregadorForm } from '@/components/pedido/AtribuirEntregadorForm'
import {
  Tabela,
  TabelaHead,
  TabelaHeadCell,
  TabelaBody,
  TabelaRow,
  TabelaCell,
} from '@/components/ui-kit/tabela'
import { Money } from '@/components/ui-kit/Money'
import { formatarData, formatarDataHora } from '@/lib/formatos'
import { rotuloPagamento, formatarDuracaoEntrega } from '@/lib/pedido-labels'

type VendaComRelacoes = {
  id: string
  numero_pedido: number
  local_id: string
  status: string
  total: number
  subtotal: number
  data_pedido: string
  forma_pagamento: string
  valor_pago_agora: number
  forma_pagamento_parcial: string | null
  prazo_pagamento_dias: number
  data_vencimento: string | null
  observacoes: string | null
  tipo_fulfillment: string
  frete: number
  pago: boolean
  concluido_em: string | null
  saiu_entrega_em: string | null
  endereco_entrega: { rua?: string; numero?: string; bairro?: string; cidade?: string } | null
  entregador: { nome: string; telefone: string | null } | null
  clientes: {
    nome: string
    telefone: string | null
    endereco: { rua?: string; numero?: string; bairro?: string; cidade?: string } | null
  } | null
  pedido_itens: {
    quantidade_pedida: number
    preco_unitario: number
    total: number
    embalagem_nome: string | null
    embalagem_unidades: number | null
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
      `id, numero_pedido, local_id, status, total, subtotal, data_pedido, forma_pagamento, valor_pago_agora, forma_pagamento_parcial, prazo_pagamento_dias, data_vencimento, observacoes, tipo_fulfillment, frete, pago, concluido_em, saiu_entrega_em, endereco_entrega, entregador:profiles!pedidos_entregador_id_fkey(nome, telefone), clientes(nome, telefone, endereco), pedido_itens(quantidade_pedida, preco_unitario, total, embalagem_nome, embalagem_unidades, produtos(nome, embalagem))`,
    )
    .eq('id', id)
    .single()

  if (!vendaRaw) notFound()
  const venda = vendaRaw as unknown as VendaComRelacoes

  const podeAtribuir =
    venda.tipo_fulfillment === 'entrega' && !venda.entregador && venda.status !== 'cancelada'
  const [cargo, entregadoresElegiveis] = podeAtribuir
    ? await Promise.all([getCargoUsuario(), listarEntregadoresElegiveis(venda.local_id)])
    : [null, []]
  const mostraAtribuir = podeAtribuir && (cargo?.admin || cargo?.nome === 'Funcionario')

  const numeroFmt = `#${String(venda.numero_pedido).padStart(4, '0')}`
  const cancelada = venda.status === 'cancelada'

  // Aviso pro entregador no WhatsApp: resumo pronto da entrega (nº, cliente,
  // endereço, valor, cobrar ou não). Só com telefone cadastrado na Equipe.
  const telEntregador = venda.entregador?.telefone?.replace(/\D/g, '')
  const linkAvisarEntregador = (() => {
    if (venda.tipo_fulfillment !== 'entrega' || !telEntregador || venda.concluido_em) return null
    const end = venda.clientes?.endereco ?? venda.endereco_entrega
    const endStr = [
      [end?.rua, end?.numero].filter(Boolean).join(', '),
      [end?.bairro, end?.cidade].filter(Boolean).join(', '),
    ]
      .filter(Boolean)
      .join(' - ')
    const msg =
      `Nova entrega ${numeroFmt}: ${venda.clientes?.nome ?? 'venda de balcão'}` +
      (endStr ? `, ${endStr}` : '') +
      `. Total R$ ${venda.total.toFixed(2).replace('.', ',')}` +
      (venda.pago ? ' (já pago).' : ' (cobrar na entrega).')
    return `https://wa.me/55${telEntregador}?text=${encodeURIComponent(msg)}`
  })()

  return (
    <div className="mx-auto max-w-3xl">
      <BotaoVoltar fallbackHref="/pedidos" />

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

      {venda.tipo_fulfillment !== 'balcao' && (
        <div className="mb-5 rounded-lg border border-border bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill
                status={venda.concluido_em ? 'ok' : 'aberto'}
                label={
                  venda.concluido_em
                    ? venda.tipo_fulfillment === 'entrega'
                      ? 'Entregue'
                      : 'Retirado'
                    : venda.tipo_fulfillment === 'entrega'
                      ? 'Aguardando entrega'
                      : 'Aguardando retirada'
                }
              />
              <StatusPill
                status={venda.pago ? 'ok' : 'alerta'}
                label={venda.pago ? 'Pago' : 'Pagamento pendente'}
              />
            </div>
            {!cancelada && (
              <FulfillmentAcoes
                pedidoId={venda.id}
                tipoFulfillment={venda.tipo_fulfillment}
                pago={venda.pago}
                concluidoEm={venda.concluido_em}
                saiuEntregaEm={venda.saiu_entrega_em}
              />
            )}
          </div>
          <div className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-2">
            {venda.tipo_fulfillment === 'entrega' && (
              <div className="flex items-center gap-2">
                {mostraAtribuir ? (
                  <AtribuirEntregadorForm pedidoId={venda.id} entregadores={entregadoresElegiveis} />
                ) : (
                  <span>
                    <span className="text-text-muted">Entregador: </span>
                    {venda.entregador?.nome ?? '-'}
                  </span>
                )}
                {linkAvisarEntregador && (
                  <a
                    href={linkAvisarEntregador}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="u-motion inline-flex h-6 items-center gap-1 rounded-md border border-ok/30 bg-ok/10 px-2 text-[11px] font-semibold text-ok hover:border-ok/60"
                  >
                    Avisar no WhatsApp
                  </a>
                )}
              </div>
            )}
            {venda.tipo_fulfillment === 'entrega' && venda.saiu_entrega_em && (
              <div>
                <span className="text-text-muted">Saiu para entrega: </span>
                {formatarDataHora(venda.saiu_entrega_em)}
              </div>
            )}
            {venda.concluido_em && (
              <div>
                <span className="text-text-muted">
                  {venda.tipo_fulfillment === 'entrega' ? 'Entregue em: ' : 'Retirado em: '}
                </span>
                {formatarDataHora(venda.concluido_em)}
              </div>
            )}
            {venda.tipo_fulfillment === 'entrega' && venda.saiu_entrega_em && venda.concluido_em && (
              <div>
                <span className="text-text-muted">Duração: </span>
                {formatarDuracaoEntrega(venda.saiu_entrega_em, venda.concluido_em)}
              </div>
            )}
            {venda.tipo_fulfillment === 'entrega' && venda.frete > 0 && (
              <div>
                <span className="text-text-muted">Frete: </span>
                <Money valor={venda.frete} />
              </div>
            )}
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
          valor={
            venda.forma_pagamento === 'fiado' && Number(venda.valor_pago_agora) > 0 ? (
              <>
                {rotuloPagamento(venda.forma_pagamento_parcial ?? '')} (pago agora):{' '}
                <Money valor={venda.valor_pago_agora} /> · Fiado:{' '}
                <Money valor={venda.total - Number(venda.valor_pago_agora)} />
              </>
            ) : (
              rotuloPagamento(venda.forma_pagamento)
            )
          }
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
                  {item.embalagem_nome && (item.embalagem_unidades ?? 1) > 1 ? (
                    <>
                      {item.quantidade_pedida / (item.embalagem_unidades ?? 1)}{' '}
                      <span className="text-text-muted">
                        {item.embalagem_nome} ({item.quantidade_pedida} un)
                      </span>
                    </>
                  ) : (
                    <>
                      {item.quantidade_pedida}{' '}
                      <span className="text-text-muted">un</span>
                    </>
                  )}
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
