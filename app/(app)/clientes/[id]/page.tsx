import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database.types'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Phone, MessageCircle, MapPin, CreditCard, ShoppingBag } from 'lucide-react'
import { PageHeader } from '@/components/ui-kit/PageHeader'
import {
  Tabela,
  TabelaHead,
  TabelaHeadCell,
  TabelaBody,
  TabelaRow,
  TabelaCell,
} from '@/components/ui-kit/tabela'
import { StatusPill, type StatusPillTipo } from '@/components/ui-kit/StatusPill'
import { Money } from '@/components/ui-kit/Money'
import { EstadoVazio } from '@/components/ui-kit/EstadoVazio'
import { btnClass } from '@/components/ui-kit/Button'
import { formatarData } from '@/lib/formatos'

type ClienteRow = Database['public']['Tables']['clientes']['Row']
type PedidoResumo = Pick<
  Database['public']['Tables']['pedidos']['Row'],
  'id' | 'numero_pedido' | 'total' | 'status' | 'data_pedido' | 'forma_pagamento'
>

const TIPO_LABEL: Record<string, string> = {
  bar: 'Bar',
  comercio: 'Comércio',
  consumidor_final: 'Consumidor final',
  revendedor: 'Revendedor',
}

const PGTO_LABEL: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao_debito: 'Cartão débito',
  cartao_credito: 'Cartão crédito',
}

// Status da venda -> aparência de StatusPill + rótulo. Venda à vista: concluída/cancelada.
function statusPedido(status: string): { tipo: StatusPillTipo; label: string } {
  switch (status) {
    case 'concluida':
      return { tipo: 'ok', label: 'Concluída' }
    case 'cancelada':
      return { tipo: 'cancelado', label: 'Cancelada' }
    default:
      return { tipo: 'inativo', label: status }
  }
}

function LinhaInfo({
  icone: Icone,
  rotulo,
  valor,
}: {
  icone: typeof Phone
  rotulo: string
  valor: string
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 text-text-muted">
        <Icone className="size-4" strokeWidth={1.5} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-text-muted">
          {rotulo}
        </p>
        <p className="text-sm text-text">{valor}</p>
      </div>
    </div>
  )
}

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: cliente } = (await supabase
    .from('clientes')
    .select('*')
    .eq('id', id)
    .single()) as { data: ClienteRow | null }
  if (!cliente) notFound()

  const { data: pedidos } = (await supabase
    .from('pedidos')
    .select('id, numero_pedido, total, status, data_pedido, forma_pagamento')
    .eq('cliente_id', id)
    .order('data_pedido', { ascending: false })
    .limit(20)) as { data: PedidoResumo[] | null }

  const end = cliente.endereco as {
    rua?: string
    numero?: string
    bairro?: string
    cidade?: string
  } | null

  const enderecoTxt = end?.rua
    ? [
        [end.rua, end.numero].filter(Boolean).join(', '),
        end.bairro,
        end.cidade,
      ]
        .filter(Boolean)
        .join(' / ')
    : null

  const totalComprado = (pedidos ?? [])
    .filter((p) => p.status !== 'cancelado')
    .reduce((s, p) => s + Number(p.total), 0)

  return (
    <div className="px-6 py-5">
      <PageHeader
        titulo={cliente.nome}
        subtitulo={`${TIPO_LABEL[cliente.tipo] ?? cliente.tipo} · ${
          PGTO_LABEL[cliente.forma_pagamento_padrao] ??
          cliente.forma_pagamento_padrao
        }`}
      >
        <StatusPill status={cliente.status === 'ativo' ? 'ativo' : 'inativo'} />
        <Link href="/clientes" className={btnClass('outline')}>
          Voltar
        </Link>
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-5 lg:col-span-1">
          <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Contato e cadastro
          </h2>
          <div className="divide-y divide-border/60">
            <LinhaInfo
              icone={Phone}
              rotulo="Telefone"
              valor={cliente.telefone ?? 'Não informado'}
            />
            <LinhaInfo
              icone={MessageCircle}
              rotulo="WhatsApp"
              valor={cliente.whatsapp ?? 'Não informado'}
            />
            <LinhaInfo
              icone={MapPin}
              rotulo="Endereço"
              valor={enderecoTxt ?? 'Não informado'}
            />
            <LinhaInfo
              icone={CreditCard}
              rotulo="Pagamento padrão"
              valor={`${
                PGTO_LABEL[cliente.forma_pagamento_padrao] ??
                cliente.forma_pagamento_padrao
              }${
                cliente.prazo_pagamento_dias > 0
                  ? ` · ${cliente.prazo_pagamento_dias} dias`
                  : ''
              }`}
            />
          </div>
          {cliente.cpf_cnpj && (
            <p className="mt-3 border-t border-border/60 pt-3 font-mono text-xs text-text-muted">
              CPF/CNPJ {cliente.cpf_cnpj}
            </p>
          )}
          {cliente.observacoes && (
            <p className="mt-3 rounded-md bg-surface-2 p-3 text-[13px] leading-relaxed text-text-muted">
              {cliente.observacoes}
            </p>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Histórico de pedidos
            </h2>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider text-text-muted">
                Total comprado
              </p>
              <Money valor={totalComprado} destaque className="text-base" />
            </div>
          </div>

          {pedidos && pedidos.length > 0 ? (
            <Tabela>
              <TabelaHead>
                <tr>
                  <TabelaHeadCell>Pedido</TabelaHeadCell>
                  <TabelaHeadCell>Data</TabelaHeadCell>
                  <TabelaHeadCell>Pagamento</TabelaHeadCell>
                  <TabelaHeadCell alinhar="centro">Status</TabelaHeadCell>
                  <TabelaHeadCell alinhar="direita">Total</TabelaHeadCell>
                </tr>
              </TabelaHead>
              <TabelaBody>
                {pedidos.map((p) => {
                  const s = statusPedido(p.status)
                  return (
                    <TabelaRow key={p.id}>
                      <TabelaCell className="font-mono text-text">
                        #{p.numero_pedido}
                      </TabelaCell>
                      <TabelaCell className="text-text-muted">
                        {formatarData(p.data_pedido)}
                      </TabelaCell>
                      <TabelaCell className="text-text-muted">
                        {PGTO_LABEL[p.forma_pagamento] ?? p.forma_pagamento}
                      </TabelaCell>
                      <TabelaCell alinhar="centro">
                        <StatusPill status={s.tipo} label={s.label} />
                      </TabelaCell>
                      <TabelaCell alinhar="direita">
                        <Money valor={p.total} />
                      </TabelaCell>
                    </TabelaRow>
                  )
                })}
              </TabelaBody>
            </Tabela>
          ) : (
            <EstadoVazio
              icone={ShoppingBag}
              titulo="Nenhum pedido ainda"
              descricao="Os pedidos deste cliente aparecerão aqui assim que forem registrados."
            />
          )}
        </div>
      </div>
    </div>
  )
}
