'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Search, Store } from 'lucide-react'
import { PageHeader } from '@/components/ui-kit/PageHeader'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { SkeletonLinhas } from '@/components/ui-kit/SkeletonLinhas'
import { btnClass } from '@/components/ui-kit/Button'
import { buscarClientes } from '@/lib/actions/clientes'

type Cliente = {
  id: string
  nome: string
  telefone: string | null
  whatsapp: string | null
  tipo: string
  status: string
  forma_pagamento_padrao: string
  prazo_pagamento_dias: number
}

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

type FiltroTipo = 'todos' | 'bar' | 'comercio' | 'consumidor_final' | 'revendedor'

const TIPO_OPCOES: Array<{ valor: FiltroTipo; label: string }> = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'bar', label: 'Bar' },
  { valor: 'comercio', label: 'Comércio' },
  { valor: 'consumidor_final', label: 'Consumidor final' },
  { valor: 'revendedor', label: 'Revendedor' },
]

type FiltroStatus = 'todos' | 'ativo' | 'inativo'

const STATUS_OPCOES: Array<{ valor: FiltroStatus; label: string }> = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'ativo', label: 'Ativo' },
  { valor: 'inativo', label: 'Inativo' },
]

export default function ClientesPage() {
  const router = useRouter()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [tipo, setTipo] = useState<FiltroTipo>('todos')
  const [status, setStatus] = useState<FiltroStatus>('todos')

  useEffect(() => {
    let ativo = true
    buscarClientes()
      .then((d) => ativo && setClientes(d as Cliente[]))
      .catch((e) => ativo && setErro(String(e)))
      .finally(() => ativo && setLoading(false))
    return () => {
      ativo = false
    }
  }, [])

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return clientes.filter((c) => {
      if (t) {
        const bateBusca =
          c.nome.toLowerCase().includes(t) ||
          (c.telefone ?? '').includes(t) ||
          (c.whatsapp ?? '').includes(t)
        if (!bateBusca) return false
      }
      if (tipo !== 'todos' && c.tipo !== tipo) return false
      if (status !== 'todos' && c.status !== status) return false
      return true
    })
  }, [clientes, busca, tipo, status])

  return (
    <div className="px-6 py-5">
      <PageHeader
        titulo="Clientes"
        subtitulo="Bares, comércios e revendedores que compram no depósito."
      >
        <Link href="/clientes/novo" className={btnClass('primary')}>
          <Plus className="size-4" strokeWidth={1.5} />
          Novo cliente
        </Link>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
            strokeWidth={1.5}
          />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou telefone"
            className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/30"
          />
        </div>

        <Tabs value={tipo} onValueChange={(v) => setTipo((v ?? 'todos') as FiltroTipo)}>
          <TabsList>
            {TIPO_OPCOES.map((t) => (
              <TabsTrigger key={t.valor} value={t.valor}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Tabs value={status} onValueChange={(v) => setStatus((v ?? 'todos') as FiltroStatus)}>
          <TabsList>
            {STATUS_OPCOES.map((s) => (
              <TabsTrigger key={s.valor} value={s.valor}>
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {!loading && (
          <span className="shrink-0 font-mono text-xs tabular-nums text-text-muted">
            {filtrados.length} {filtrados.length === 1 ? 'cliente' : 'clientes'}
          </span>
        )}
      </div>

      {erro && (
        <p className="rounded-lg border border-err/30 bg-err/10 px-4 py-3 text-sm text-err">{erro}</p>
      )}
      {loading ? (
        <SkeletonLinhas colunas={5} linhas={8} />
      ) : filtrados.length === 0 ? (
        busca || tipo !== 'todos' || status !== 'todos' ? (
          <EstadoVazio
            icone={Search}
            titulo="Nenhum cliente encontrado"
            descricao="Nada corresponde à busca ou aos filtros selecionados. Tente ajustar."
          />
        ) : (
          <EstadoVazio
            icone={Store}
            titulo="Nenhum cliente cadastrado"
            descricao="Cadastre o primeiro cliente para identificar quem compra."
            acao={
              <Link href="/clientes/novo" className={btnClass('primary')}>
                <Plus className="size-4" strokeWidth={1.5} />
                Novo cliente
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
              <TabelaHeadCell>Nome</TabelaHeadCell>
              <TabelaHeadCell>Tipo</TabelaHeadCell>
              <TabelaHeadCell>Telefone</TabelaHeadCell>
              <TabelaHeadCell>Pagamento</TabelaHeadCell>
              <TabelaHeadCell alinhar="centro">Status</TabelaHeadCell>
            </tr>
          </TabelaHead>
          <TabelaBody>
            {filtrados.map((c) => (
              <TabelaRow
                key={c.id}
                onClick={() => router.push(`/clientes/${c.id}`)}
              >
                <TabelaCell className="font-medium text-text">
                  {c.nome}
                </TabelaCell>
                <TabelaCell className="text-text-muted">
                  {TIPO_LABEL[c.tipo] ?? c.tipo}
                </TabelaCell>
                <TabelaCell className="text-text-muted">
                  {c.telefone ?? (
                    <span className="text-text-muted/50">sem telefone</span>
                  )}
                </TabelaCell>
                <TabelaCell className="text-text-muted">
                  {PGTO_LABEL[c.forma_pagamento_padrao] ??
                    c.forma_pagamento_padrao}
                  {c.prazo_pagamento_dias > 0 && (
                    <span className="ml-1 font-mono text-xs text-text-muted/70">
                      {c.prazo_pagamento_dias}d
                    </span>
                  )}
                </TabelaCell>
                <TabelaCell alinhar="centro">
                  <StatusPill status={c.status === 'ativo' ? 'ativo' : 'inativo'} />
                </TabelaCell>
              </TabelaRow>
            ))}
          </TabelaBody>
        </Tabela>
        </div>

        {/* Mobile: cards */}
        <div className="space-y-2 lg:hidden">
          {filtrados.map((c) => (
            <CardLinha
              key={c.id}
              href={`/clientes/${c.id}`}
              titulo={c.nome}
              destaque={
                <StatusPill status={c.status === 'ativo' ? 'ativo' : 'inativo'} />
              }
              campos={[
                { label: 'Tipo', valor: TIPO_LABEL[c.tipo] ?? c.tipo },
                { label: 'Telefone', valor: c.telefone ?? '-' },
                {
                  label: 'Pagamento',
                  valor: (
                    <span>
                      {PGTO_LABEL[c.forma_pagamento_padrao] ?? c.forma_pagamento_padrao}
                      {c.prazo_pagamento_dias > 0 ? ` ${c.prazo_pagamento_dias}d` : ''}
                    </span>
                  ),
                },
              ]}
            />
          ))}
        </div>
        </>
      )}
    </div>
  )
}
