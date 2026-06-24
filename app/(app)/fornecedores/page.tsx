'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Truck } from 'lucide-react'
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
import { btnClass } from '@/components/ui-kit/Button'
import { buscarFornecedores } from '@/lib/actions/fornecedores'

type Fornecedor = {
  id: string
  nome: string
  razao_social: string | null
  cnpj: string | null
  telefone: string | null
  contato_nome: string | null
  status: string
}

export default function FornecedoresPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    let ativo = true
    buscarFornecedores()
      .then((d) => ativo && setFornecedores(d as Fornecedor[]))
      .finally(() => ativo && setLoading(false))
    return () => {
      ativo = false
    }
  }, [])

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase()
    if (!t) return fornecedores
    return fornecedores.filter(
      (f) =>
        f.nome.toLowerCase().includes(t) ||
        (f.razao_social ?? '').toLowerCase().includes(t) ||
        (f.cnpj ?? '').includes(t) ||
        (f.contato_nome ?? '').toLowerCase().includes(t),
    )
  }, [fornecedores, busca])

  return (
    <div className="px-6 py-5">
      <PageHeader
        titulo="Fornecedores"
        subtitulo="Distribuidoras e fábricas que abastecem o depósito."
      >
        <Link href="/fornecedores/novo" className={btnClass('primary')}>
          <Plus className="size-4" strokeWidth={1.5} />
          Novo fornecedor
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
            placeholder="Buscar por nome, CNPJ ou contato"
            className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/30"
          />
        </div>
        {!loading && (
          <span className="shrink-0 font-mono text-xs tabular-nums text-text-muted">
            {filtrados.length}{' '}
            {filtrados.length === 1 ? 'fornecedor' : 'fornecedores'}
          </span>
        )}
      </div>

      {loading ? (
        <SkeletonLinhas colunas={5} linhas={8} />
      ) : filtrados.length === 0 ? (
        busca ? (
          <EstadoVazio
            icone={Search}
            titulo="Nenhum fornecedor encontrado"
            descricao={`Nada corresponde a "${busca}". Tente outro termo.`}
          />
        ) : (
          <EstadoVazio
            icone={Truck}
            titulo="Nenhum fornecedor cadastrado"
            descricao="Cadastre o primeiro fornecedor para registrar compras e reposição."
            acao={
              <Link href="/fornecedores/novo" className={btnClass('primary')}>
                <Plus className="size-4" strokeWidth={1.5} />
                Novo fornecedor
              </Link>
            }
          />
        )
      ) : (
        <Tabela>
          <TabelaHead>
            <tr>
              <TabelaHeadCell>Nome</TabelaHeadCell>
              <TabelaHeadCell>CNPJ</TabelaHeadCell>
              <TabelaHeadCell>Contato</TabelaHeadCell>
              <TabelaHeadCell>Telefone</TabelaHeadCell>
              <TabelaHeadCell alinhar="centro">Status</TabelaHeadCell>
            </tr>
          </TabelaHead>
          <TabelaBody>
            {filtrados.map((f) => (
              <TabelaRow key={f.id}>
                <TabelaCell>
                  <p className="font-medium text-text">{f.nome}</p>
                  {f.razao_social && (
                    <p className="text-xs text-text-muted">{f.razao_social}</p>
                  )}
                </TabelaCell>
                <TabelaCell className="font-mono text-text-muted">
                  {f.cnpj ?? (
                    <span className="text-text-muted/50">não informado</span>
                  )}
                </TabelaCell>
                <TabelaCell className="text-text-muted">
                  {f.contato_nome ?? (
                    <span className="text-text-muted/50">não informado</span>
                  )}
                </TabelaCell>
                <TabelaCell className="text-text-muted">
                  {f.telefone ?? (
                    <span className="text-text-muted/50">sem telefone</span>
                  )}
                </TabelaCell>
                <TabelaCell alinhar="centro">
                  <StatusPill
                    status={f.status === 'ativo' ? 'ativo' : 'inativo'}
                  />
                </TabelaCell>
              </TabelaRow>
            ))}
          </TabelaBody>
        </Tabela>
      )}
    </div>
  )
}
