import Link from 'next/link'
import { PackageCheck } from 'lucide-react'
import { PageHeader } from '@/components/ui-kit/PageHeader'
import { EstadoVazio } from '@/components/ui-kit/EstadoVazio'
import {
  Tabela,
  TabelaHead,
  TabelaHeadCell,
  TabelaBody,
  TabelaRow,
  TabelaCell,
} from '@/components/ui-kit/tabela'
import {
  listarPedidosEmAndamento,
  listarPedidosConcluidos,
} from '@/lib/actions/pedidos'
import { getLocalAtivo } from '@/lib/local'
import { rotuloFulfillment } from '@/lib/pedido-labels'
import { formatarDataHora } from '@/lib/formatos'
import { cn } from '@/lib/utils'

// Relacoes do Supabase chegam como objeto ou array; normaliza para objeto.
type Rel<T> = T | T[] | null
function umaRel<T>(rel: Rel<T>): T | null {
  if (!rel) return null
  return Array.isArray(rel) ? (rel[0] ?? null) : rel
}

type PedidoRaw = {
  id: string
  numero_pedido: number
  tipo_fulfillment: string
  data_pedido: string
  concluido_em?: string | null
  saiu_entrega_em: string | null
  clientes: Rel<{ nome: string }>
  entregador: Rel<{ nome: string }>
}

const ABAS = [
  { chave: 'andamento', rotulo: 'Em andamento' },
  { chave: 'concluidos', rotulo: 'Concluídos' },
] as const
type AbaChave = (typeof ABAS)[number]['chave']

// "23 min" ou "1h 12min". Vazio se faltar saiu_entrega_em ou concluido_em --
// balcao e retirada nao tem saida, entao a maioria das linhas fica sem duracao.
function formatarDuracao(saiu: string | null, concluido: string | null | undefined): string {
  if (!saiu || !concluido) return '—'
  const ms = new Date(concluido).getTime() - new Date(saiu).getTime()
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const min = Math.round(ms / 60000)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const resto = min % 60
  return resto > 0 ? `${h}h ${resto}min` : `${h}h`
}

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>
}) {
  const { aba } = await searchParams
  const abaAtiva: AbaChave = aba === 'concluidos' ? 'concluidos' : 'andamento'

  const [local, linhasRaw] = await Promise.all([
    getLocalAtivo(),
    abaAtiva === 'andamento' ? listarPedidosEmAndamento() : listarPedidosConcluidos(),
  ])
  const linhas = linhasRaw as unknown as PedidoRaw[]

  return (
    <div>
      <PageHeader
        titulo="Pedidos"
        subtitulo="Histórico operacional: quem entregou, quanto tempo levou"
      />

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {ABAS.map((a) => {
          const ativo = abaAtiva === a.chave
          return (
            <Link
              key={a.chave}
              href={`/pedidos?aba=${a.chave}`}
              className={cn(
                'u-motion inline-flex h-7 items-center rounded-full px-3 text-[13px] font-medium',
                ativo
                  ? 'bg-brand text-primary-foreground'
                  : 'border border-border bg-surface text-text-muted hover:bg-surface-2 hover:text-text',
              )}
            >
              {a.rotulo}
            </Link>
          )
        })}
      </div>

      {linhas.length === 0 ? (
        <EstadoVazio
          icone={PackageCheck}
          titulo={
            abaAtiva === 'andamento'
              ? 'Nenhum pedido em andamento'
              : 'Nenhum pedido concluído ainda'
          }
          descricao={
            abaAtiva === 'andamento'
              ? 'Entregas e retiradas ainda não confirmadas aparecem aqui.'
              : 'Vendas de balcão, entregas e retiradas já confirmadas aparecem aqui.'
          }
        />
      ) : (
        <Tabela>
          <TabelaHead>
            <tr>
              <TabelaHeadCell>Nº</TabelaHeadCell>
              <TabelaHeadCell>Tipo</TabelaHeadCell>
              <TabelaHeadCell>Local</TabelaHeadCell>
              <TabelaHeadCell>Cliente</TabelaHeadCell>
              {abaAtiva === 'concluidos' && (
                <TabelaHeadCell>Entregador</TabelaHeadCell>
              )}
              <TabelaHeadCell>Saiu às</TabelaHeadCell>
              {abaAtiva === 'concluidos' && (
                <>
                  <TabelaHeadCell>Confirmado às</TabelaHeadCell>
                  <TabelaHeadCell>Duração</TabelaHeadCell>
                </>
              )}
            </tr>
          </TabelaHead>
          <TabelaBody>
            {linhas.map((p) => {
              const cliente = umaRel(p.clientes)?.nome
              const entregador = umaRel(p.entregador)?.nome
              const numeroFmt = `#${String(p.numero_pedido).padStart(4, '0')}`
              return (
                <TabelaRow key={p.id} className="group">
                  <TabelaCell mono>
                    <Link href={`/pedidos/${p.id}`} className="block">
                      {numeroFmt}
                    </Link>
                  </TabelaCell>
                  <TabelaCell className="text-text-muted">
                    <Link href={`/pedidos/${p.id}`} className="block">
                      {rotuloFulfillment(p.tipo_fulfillment)}
                    </Link>
                  </TabelaCell>
                  <TabelaCell className="text-text-muted">{local.nome}</TabelaCell>
                  <TabelaCell>
                    <Link href={`/pedidos/${p.id}`} className="block hover:text-brand">
                      {cliente ?? 'Venda de balcão'}
                    </Link>
                  </TabelaCell>
                  {abaAtiva === 'concluidos' && (
                    <TabelaCell className="text-text-muted">{entregador ?? '—'}</TabelaCell>
                  )}
                  <TabelaCell className="text-text-muted" mono>
                    {p.saiu_entrega_em ? formatarDataHora(p.saiu_entrega_em) : '—'}
                  </TabelaCell>
                  {abaAtiva === 'concluidos' && (
                    <>
                      <TabelaCell className="text-text-muted" mono>
                        {p.concluido_em ? formatarDataHora(p.concluido_em) : '—'}
                      </TabelaCell>
                      <TabelaCell className="text-text-muted" mono>
                        {formatarDuracao(p.saiu_entrega_em, p.concluido_em)}
                      </TabelaCell>
                    </>
                  )}
                </TabelaRow>
              )
            })}
          </TabelaBody>
        </Tabela>
      )}
    </div>
  )
}
