import Link from 'next/link'
import { Plus, ArrowLeftRight } from 'lucide-react'
import { PageHeader } from '@/components/ui-kit/PageHeader'
import { EstadoVazio } from '@/components/ui-kit/EstadoVazio'
import { listarMovimentacoes } from '@/lib/actions/movimentacoes'
import { rotuloPagamento } from '@/lib/pedido-labels'
import { cn } from '@/lib/utils'
import {
  MovimentacoesLista,
  type LinhaMov,
} from '@/components/movimentacao/MovimentacoesLista'

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
  tipo_fulfillment: string
  concluido_em: string | null
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

const FILTROS = [
  { chave: '', rotulo: 'Todas' },
  { chave: 'vendas', rotulo: 'Vendas' },
  { chave: 'entradas', rotulo: 'Entradas' },
] as const

type FiltroChave = '' | 'vendas' | 'entradas'
const CHAVES_VALIDAS: readonly string[] = ['vendas', 'entradas']

export default async function MovimentacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>
}) {
  const { tipo } = await searchParams
  const filtroAtivo: FiltroChave = CHAVES_VALIDAS.includes(tipo ?? '') ? (tipo as FiltroChave) : ''

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
      tipoFulfillment: v.tipo_fulfillment,
      concluidoEm: v.concluido_em,
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
        <MovimentacoesLista linhas={linhas} />
      )}
    </div>
  )
}
