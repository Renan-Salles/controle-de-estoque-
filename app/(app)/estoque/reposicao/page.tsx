'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShoppingBasket, ArrowLeft } from 'lucide-react'
import { buscarReposicao } from '@/lib/actions/estoque'
import type { ItemReposicao } from '@/types'
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
import { SkeletonLinhas } from '@/components/ui-kit/SkeletonLinhas'
import { formatarNumero } from '@/lib/formatos'

export default function ReposicaoPage() {
  const [itens, setItens] = useState<ItemReposicao[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ativo = true
    ;(async () => {
      setLoading(true)
      const dados = (await buscarReposicao()) as ItemReposicao[]
      if (!ativo) return
      setItens(dados)
      setLoading(false)
    })()
    return () => {
      ativo = false
    }
  }, [])

  return (
    <div className="px-6 py-5">
      <PageHeader
        titulo="Reposição"
        subtitulo="Produtos acabando, com sugestão de quanto comprar."
      >
        <Link
          href="/estoque"
          className="u-motion u-press inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text hover:border-brand/50 hover:text-brand"
        >
          <ArrowLeft className="size-4" strokeWidth={1.5} />
          Voltar ao estoque
        </Link>
      </PageHeader>

      {loading ? (
        <SkeletonLinhas colunas={4} linhas={8} />
      ) : itens.length === 0 ? (
        <EstadoVazio
          icone={ShoppingBasket}
          titulo="Nada para repor agora"
          descricao="Estoque tranquilo. Nenhum produto acabando no momento."
        />
      ) : (
        <Tabela>
          <TabelaHead>
            <tr>
              <TabelaHeadCell>Produto</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita">Saldo atual</TabelaHeadCell>
              <TabelaHeadCell alinhar="centro">Status</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita">Sugestão de compra</TabelaHeadCell>
            </tr>
          </TabelaHead>
          <TabelaBody>
            {itens.map((p) => (
              <TabelaRow key={p.id}>
                <TabelaCell>
                  <p className="font-medium text-text">{p.nome}</p>
                  {p.marca && (
                    <p className="text-[13px] text-text-muted">{p.marca}</p>
                  )}
                </TabelaCell>
                <TabelaCell alinhar="direita">
                  {formatarNumero(p.saldo_atual)}
                </TabelaCell>
                <TabelaCell alinhar="centro">
                  <StatusPill status={p.status_estoque} />
                </TabelaCell>
                <TabelaCell alinhar="direita">
                  <span className="font-mono font-semibold tabular-nums text-brand">
                    +{formatarNumero(p.sugestao_compra)}
                  </span>
                </TabelaCell>
              </TabelaRow>
            ))}
          </TabelaBody>
        </Tabela>
      )}
    </div>
  )
}
