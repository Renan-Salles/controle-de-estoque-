'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Package, Plus, Search } from 'lucide-react'
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
import { Money } from '@/components/ui-kit/Money'
import { CardLinha } from '@/components/ui-kit/CardLinha'
import { EstadoVazio } from '@/components/ui-kit/EstadoVazio'
import { SkeletonLinhas } from '@/components/ui-kit/SkeletonLinhas'
import { btnClass } from '@/components/ui-kit/Button'
import { formatarNumero } from '@/lib/formatos'
import { buscarPosicaoProdutos } from '@/lib/actions/produtos'
import type { Database } from '@/types/database.types'

type Produto = Database['public']['Views']['v_posicao_estoque']['Row']

export default function ProdutosPage() {
  const router = useRouter()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    let ativo = true
    buscarPosicaoProdutos()
      .then((d) => ativo && setProdutos(d as Produto[]))
      .finally(() => ativo && setLoading(false))
    return () => {
      ativo = false
    }
  }, [])

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase()
    if (!t) return produtos
    return produtos.filter(
      (p) =>
        p.nome.toLowerCase().includes(t) ||
        (p.marca ?? '').toLowerCase().includes(t) ||
        (p.categoria ?? '').toLowerCase().includes(t) ||
        (p.codigo_barras ?? '').toLowerCase().includes(t),
    )
  }, [produtos, busca])

  return (
    <div className="px-6 py-5">
      <PageHeader
        titulo="Produtos"
        subtitulo="Catálogo de bebidas com posição de estoque e preço de venda."
      >
        <Link href="/produtos/novo" className={btnClass('primary')}>
          <Plus className="size-4" strokeWidth={1.5} />
          Novo produto
        </Link>
      </PageHeader>

      <div className="mb-4 flex items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
            strokeWidth={1.5}
          />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, marca, categoria ou código"
            className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/30"
          />
        </div>
        {!loading && (
          <span className="shrink-0 font-mono text-xs tabular-nums text-text-muted">
            {filtrados.length} {filtrados.length === 1 ? 'item' : 'itens'}
          </span>
        )}
      </div>

      {loading ? (
        <SkeletonLinhas colunas={6} linhas={8} />
      ) : filtrados.length === 0 ? (
        busca ? (
          <EstadoVazio
            icone={Search}
            titulo="Nenhum produto encontrado"
            descricao={`Nada corresponde a "${busca}". Tente outro termo.`}
          />
        ) : (
          <EstadoVazio
            icone={Package}
            titulo="Nenhum produto cadastrado"
            descricao="Cadastre o primeiro para começar a vender."
            acao={
              <Link href="/produtos/novo" className={btnClass('primary')}>
                <Plus className="size-4" strokeWidth={1.5} />
                Novo produto
              </Link>
            }
          />
        )
      ) : (
        <>
        <div className="hidden lg:block">
        <Tabela>
          <TabelaHead>
            <tr>
              <TabelaHeadCell>Produto</TabelaHeadCell>
              <TabelaHeadCell>Código</TabelaHeadCell>
              <TabelaHeadCell>Categoria</TabelaHeadCell>
              <TabelaHeadCell>Embalagem</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita">Estoque</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita">Preço</TabelaHeadCell>
              <TabelaHeadCell alinhar="centro">Status</TabelaHeadCell>
            </tr>
          </TabelaHead>
          <TabelaBody>
            {filtrados.map((p) => (
              <TabelaRow
                key={p.id}
                onClick={() => router.push(`/produtos/${p.id}/editar`)}
              >
                <TabelaCell>
                  <p className="font-medium text-text">{p.nome}</p>
                  {p.marca && (
                    <p className="text-xs text-text-muted">{p.marca}</p>
                  )}
                </TabelaCell>
                <TabelaCell mono className="text-text-muted">
                  {p.codigo_barras ?? '-'}
                </TabelaCell>
                <TabelaCell className="text-text-muted">
                  {p.categoria}
                </TabelaCell>
                <TabelaCell className="text-text-muted capitalize">
                  {p.embalagem}
                  {p.volume_ml ? (
                    <span className="ml-1 text-text-muted/70">
                      {p.volume_ml}ml
                    </span>
                  ) : null}
                </TabelaCell>
                <TabelaCell alinhar="direita">
                  {formatarNumero(p.saldo_atual)}
                </TabelaCell>
                <TabelaCell alinhar="direita">
                  <Money valor={p.preco_venda_padrao} />
                </TabelaCell>
                <TabelaCell alinhar="centro">
                  <StatusPill status={p.status_estoque} />
                </TabelaCell>
              </TabelaRow>
            ))}
          </TabelaBody>
        </Tabela>
        </div>

        {/* Mobile: cards */}
        <div className="space-y-2 lg:hidden">
          {filtrados.map((p) => (
            <CardLinha
              key={p.id}
              href={`/produtos/${p.id}/editar`}
              titulo={
                <span>
                  {p.nome}
                  {p.marca && (
                    <span className="block text-xs font-normal text-text-muted">
                      {p.marca}
                    </span>
                  )}
                </span>
              }
              destaque={<StatusPill status={p.status_estoque} />}
              campos={[
                { label: 'Código', valor: <span className="font-mono">{p.codigo_barras ?? '-'}</span> },
                { label: 'Categoria', valor: p.categoria },
                {
                  label: 'Embalagem',
                  valor: (
                    <span className="capitalize">
                      {p.embalagem}
                      {p.volume_ml ? ` ${p.volume_ml}ml` : ''}
                    </span>
                  ),
                },
                { label: 'Estoque', valor: formatarNumero(p.saldo_atual) },
                { label: 'Preço', valor: <Money valor={p.preco_venda_padrao} /> },
              ]}
            />
          ))}
        </div>
        </>
      )}
    </div>
  )
}
