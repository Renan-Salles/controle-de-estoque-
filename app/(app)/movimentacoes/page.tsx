import Link from 'next/link'
import { Plus, Printer, ArrowLeftRight, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
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
import { CardLinha } from '@/components/ui-kit/CardLinha'
import { EstadoVazio } from '@/components/ui-kit/EstadoVazio'
import { Money } from '@/components/ui-kit/Money'
import { listarMovimentacoes } from '@/lib/actions/movimentacoes'
import { rotuloPagamento } from '@/lib/pedido-labels'
import { cn } from '@/lib/utils'

// Relacoes do Supabase chegam como objeto ou array; normaliza para objeto.
type Rel<T> = T | T[] | null
function umaRel<T>(rel: Rel<T>): T | null {
  if (!rel) return null
  return Array.isArray(rel) ? (rel[0] ?? null) : rel
}

type VendaRaw = {
  id: string
  numero_pedido: number
  total: number
  data_pedido: string
  forma_pagamento: string
  status: string
  clientes: Rel<{ nome: string }>
}

type EntradaRaw = {
  id: string
  quantidade: number
  custo_unitario: number
  created_at: string
  observacao: string | null
  produtos: Rel<{ nome: string }>
}

type LinhaMov = {
  chave: string
  tipo: 'saida' | 'entrada'
  data: string
  descricao: string
  numero: string | null
  detalhe: string
  valor: number
  href: string | null
  romaneioHref: string | null
  statusVenda?: string
}

const FILTROS = [
  { chave: '', rotulo: 'Todas' },
  { chave: 'vendas', rotulo: 'Vendas' },
  { chave: 'entradas', rotulo: 'Entradas' },
] as const

const FMT_DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function dataHora(d: string): string {
  const data = new Date(d)
  if (Number.isNaN(data.getTime())) return ''
  return FMT_DATA_HORA.format(data)
}

export default async function MovimentacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>
}) {
  const { tipo } = await searchParams
  const filtroAtivo = tipo === 'vendas' || tipo === 'entradas' ? tipo : ''

  const { vendas, entradas } = await listarMovimentacoes()

  const linhasVenda: LinhaMov[] = (vendas as unknown as VendaRaw[]).map((v) => {
    const cliente = umaRel(v.clientes)?.nome
    return {
      chave: `venda-${v.id}`,
      tipo: 'saida',
      data: v.data_pedido,
      descricao: cliente ?? 'Venda balcão',
      numero: `#${String(v.numero_pedido).padStart(4, '0')}`,
      detalhe: rotuloPagamento(v.forma_pagamento),
      valor: v.total ?? 0,
      href: `/pedidos/${v.id}`,
      romaneioHref: `/pedidos/${v.id}/romaneio`,
      statusVenda: v.status,
    }
  })

  const linhasEntrada: LinhaMov[] = (entradas as unknown as EntradaRaw[]).map(
    (e) => {
      const produto = umaRel(e.produtos)?.nome ?? 'Produto removido'
      return {
        chave: `entrada-${e.id}`,
        tipo: 'entrada',
        data: e.created_at,
        descricao: `${produto} · Compra`,
        numero: null,
        detalhe: `${e.quantidade} un`,
        valor: e.quantidade * (e.custo_unitario ?? 0),
        href: null,
        romaneioHref: null,
      }
    },
  )

  let linhas: LinhaMov[]
  if (filtroAtivo === 'vendas') linhas = linhasVenda
  else if (filtroAtivo === 'entradas') linhas = linhasEntrada
  else linhas = [...linhasVenda, ...linhasEntrada]

  // Mais recente primeiro (une as duas listas por data/hora).
  linhas.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())

  return (
    <div>
      <PageHeader
        titulo="Movimentações"
        subtitulo="Vendas (saídas) e compras de estoque (entradas)"
      >
        <Link
          href="/movimentacoes/nova"
          className="u-motion inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-primary-foreground hover:bg-brand-strong active:scale-[0.98]"
        >
          <Plus className="size-4" strokeWidth={2} />
          Nova movimentação
        </Link>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {FILTROS.map((f) => {
          const ativo = filtroAtivo === f.chave
          return (
            <Link
              key={f.chave || 'todas'}
              href={f.chave ? `/movimentacoes?tipo=${f.chave}` : '/movimentacoes'}
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

      {linhas.length === 0 ? (
        <EstadoVazio
          icone={ArrowLeftRight}
          titulo={
            filtroAtivo === 'vendas'
              ? 'Nenhuma venda ainda'
              : filtroAtivo === 'entradas'
                ? 'Nenhuma entrada ainda'
                : 'Nenhuma movimentação ainda'
          }
          descricao="Registre uma venda ou uma compra de estoque para começar."
          acao={
            <Link
              href="/movimentacoes/nova"
              className="u-motion inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-primary-foreground hover:bg-brand-strong active:scale-[0.98]"
            >
              <Plus className="size-4" strokeWidth={2} />
              Nova movimentação
            </Link>
          }
        />
      ) : (
        <>
        <div className="hidden lg:block">
        <Tabela>
          <TabelaHead>
            <tr>
              <TabelaHeadCell>Tipo</TabelaHeadCell>
              <TabelaHeadCell>Data/hora</TabelaHeadCell>
              <TabelaHeadCell>Descrição</TabelaHeadCell>
              <TabelaHeadCell>Detalhe</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita">Valor</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita"> </TabelaHeadCell>
            </tr>
          </TabelaHead>
          <TabelaBody>
            {linhas.map((l) => {
              const saida = l.tipo === 'saida'
              const Icone = saida ? ArrowUpRight : ArrowDownLeft
              const conteudo = (
                <span className="flex items-center gap-2">
                  <span className="font-medium text-text">{l.descricao}</span>
                  {l.numero && (
                    <span className="font-mono text-xs tabular-nums text-text-muted">
                      {l.numero}
                    </span>
                  )}
                </span>
              )
              return (
                <TabelaRow key={l.chave} className="group">
                  <TabelaCell>
                    <StatusPill
                      status={saida ? 'critico' : 'ok'}
                      label={saida ? 'Saída' : 'Entrada'}
                    />
                  </TabelaCell>
                  <TabelaCell className="text-text-muted" mono>
                    {l.href ? (
                      <Link href={l.href} className="block">
                        {dataHora(l.data)}
                      </Link>
                    ) : (
                      dataHora(l.data)
                    )}
                  </TabelaCell>
                  <TabelaCell>
                    {l.href ? (
                      <Link
                        href={l.href}
                        className="block hover:text-brand"
                      >
                        <span className="flex items-center gap-2">
                          <Icone
                            className={cn(
                              'size-3.5 shrink-0',
                              saida ? 'text-err' : 'text-ok',
                            )}
                            strokeWidth={2}
                          />
                          {conteudo}
                        </span>
                      </Link>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Icone
                          className="size-3.5 shrink-0 text-ok"
                          strokeWidth={2}
                        />
                        {conteudo}
                      </span>
                    )}
                  </TabelaCell>
                  <TabelaCell className="text-text-muted">
                    {l.detalhe}
                  </TabelaCell>
                  <TabelaCell alinhar="direita">
                    <Money valor={l.valor} destaque={saida} />
                  </TabelaCell>
                  <TabelaCell alinhar="direita">
                    {l.romaneioHref && (
                      <Link
                        href={l.romaneioHref}
                        className="u-motion inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-text-muted opacity-70 hover:bg-surface-2 hover:text-text group-hover:opacity-100"
                      >
                        <Printer className="size-3.5" strokeWidth={1.5} />
                        Romaneio
                      </Link>
                    )}
                  </TabelaCell>
                </TabelaRow>
              )
            })}
          </TabelaBody>
        </Tabela>
        </div>

        {/* Mobile: cards */}
        <div className="space-y-2 lg:hidden">
          {linhas.map((l) => {
            const saida = l.tipo === 'saida'
            return (
              <CardLinha
                key={l.chave}
                href={l.href ?? undefined}
                titulo={
                  <span className="flex items-center gap-2">
                    {l.descricao}
                    {l.numero && (
                      <span className="font-mono text-xs font-normal text-text-muted">
                        {l.numero}
                      </span>
                    )}
                  </span>
                }
                destaque={<Money valor={l.valor} destaque={saida} />}
                campos={[
                  {
                    label: 'Tipo',
                    valor: (
                      <StatusPill
                        status={saida ? 'critico' : 'ok'}
                        label={saida ? 'Saída' : 'Entrada'}
                      />
                    ),
                  },
                  { label: 'Data/hora', valor: dataHora(l.data) },
                  { label: 'Detalhe', valor: l.detalhe },
                ]}
              />
            )
          })}
        </div>
        </>
      )}
    </div>
  )
}
