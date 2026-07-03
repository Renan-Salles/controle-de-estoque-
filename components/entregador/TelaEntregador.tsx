import { PackageCheck } from 'lucide-react'
import { listarMinhasEntregas } from '@/lib/actions/pedidos'
import { getLocalAtivo } from '@/lib/local'
import { getNomePerfil } from '@/lib/permissoes'
import { EstadoVazio } from '@/components/ui-kit/EstadoVazio'
import { CardEntrega, type EntregaResumo } from './CardEntrega'
import { BotaoSair } from './BotaoSair'

// Copia local de logoPartes (a original vive em nav-items.tsx, que e
// 'use client' -- funcao de client component nao pode ser chamada aqui).
function logoPartes(nome: string) {
  if (nome.toUpperCase().startsWith('R$')) {
    return { selo: 'R$', texto: nome.replace(/^R\$\s*/i, '') }
  }
  const iniciais = nome
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return { selo: iniciais, texto: nome }
}

// Relacoes do Supabase chegam como objeto ou array; normaliza para objeto.
type Rel<T> = T | T[] | null
function umaRel<T>(rel: Rel<T>): T | null {
  if (!rel) return null
  return Array.isArray(rel) ? (rel[0] ?? null) : rel
}

type EntregaRaw = {
  id: string
  numero_pedido: number
  total: number
  forma_pagamento: string
  pago: boolean
  saiu_entrega_em: string | null
  clientes: Rel<{
    nome: string
    telefone: string | null
    endereco: { rua?: string; numero?: string; bairro?: string; cidade?: string } | null
  }>
}

// Tela unica do cargo Entregador: so as entregas designadas a ele, sem
// sidebar/topbar de admin. Renderizada por /dashboard quando ehEntregador().
export async function TelaEntregador() {
  const [entregasRaw, local, nome] = await Promise.all([
    listarMinhasEntregas(),
    getLocalAtivo(),
    getNomePerfil(),
  ])
  const entregas = entregasRaw as unknown as EntregaRaw[]
  const logo = logoPartes(local.nome)

  return (
    <div className="min-h-screen bg-background">
      {/* Cabecalho simples: logo + nome + sair */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-bg/80 px-4 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-gold/15 text-[13px] font-bold text-accent-gold">
            {logo.selo}
          </span>
          <span className="truncate text-sm font-semibold text-text">{logo.texto}</span>
        </div>
        <div className="flex items-center gap-3">
          {nome && <span className="hidden text-sm text-text-muted sm:block">{nome}</span>}
          <BotaoSair />
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-5">
        <h1 className="text-xl font-semibold tracking-tight text-text">Suas entregas</h1>
        <p className="mt-1 text-sm text-text-muted">
          {entregas.length === 0
            ? 'Nada pendente agora.'
            : `${entregas.length} ${entregas.length === 1 ? 'entrega pendente' : 'entregas pendentes'}.`}
        </p>

        <div className="mt-5 space-y-4">
          {entregas.length === 0 ? (
            <EstadoVazio
              icone={PackageCheck}
              titulo="Nenhuma entrega pra você agora"
              descricao="Quando uma venda for designada a você, ela aparece aqui."
            />
          ) : (
            entregas.map((e) => (
              <CardEntrega
                key={e.id}
                entrega={
                  {
                    id: e.id,
                    numero_pedido: e.numero_pedido,
                    total: e.total,
                    forma_pagamento: e.forma_pagamento,
                    pago: e.pago,
                    saiu_entrega_em: e.saiu_entrega_em,
                    cliente: umaRel(e.clientes),
                    localNome: local.nome,
                  } satisfies EntregaResumo
                }
              />
            ))
          )}
        </div>
      </main>
    </div>
  )
}
