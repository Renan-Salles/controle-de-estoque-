import { PackageCheck } from 'lucide-react'
import { listarMinhasEntregas } from '@/lib/actions/pedidos'
import { getLocalAtivo } from '@/lib/local'
import { getNomePerfil } from '@/lib/permissoes'
import { meuTurnoAtivo } from '@/lib/actions/turnos'
import { meuTempoMedioEntrega } from '@/lib/actions/relatorio-entregadores'
import { EstadoVazio } from '@/components/ui-kit/EstadoVazio'
import { CardEntrega, type EntregaResumo } from './CardEntrega'
import { BotaoSair } from './BotaoSair'
import { TurnoCard } from './TurnoCard'

// Bom dia / Boa tarde / Boa noite conforme o horario de Brasilia.
function saudacao(): string {
  const hora = Number(
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'America/Sao_Paulo',
    }).format(new Date()),
  )
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

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
  endereco_entrega: { rua?: string; numero?: string; bairro?: string; cidade?: string } | null
  clientes: Rel<{
    nome: string
    telefone: string | null
    endereco: { rua?: string; numero?: string; bairro?: string; cidade?: string } | null
  }>
}

// Tela unica do cargo Entregador: so as entregas designadas a ele, sem
// sidebar/topbar de admin. Renderizada por /dashboard quando ehEntregador().
export async function TelaEntregador() {
  const [entregasRaw, local, nome, turnoAtivo, tempoMedioMin] = await Promise.all([
    listarMinhasEntregas(),
    getLocalAtivo(),
    getNomePerfil(),
    meuTurnoAtivo(),
    meuTempoMedioEntrega(),
  ])
  const entregas = entregasRaw as unknown as EntregaRaw[]
  const logo = logoPartes(local.nome)
  const emRota = entregas.filter((e) => e.saiu_entrega_em).length
  const aguardando = entregas.length - emRota

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

      <main className="mx-auto max-w-lg px-4 py-6">
        {/* Saudacao + placar do dia */}
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm text-text-muted">
              {nome ? `${saudacao()}, ${nome.split(' ')[0]}!` : 'Suas entregas'}
            </p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-text">
              {entregas.length === 0
                ? 'Tudo entregue'
                : `${entregas.length} ${entregas.length === 1 ? 'entrega' : 'entregas'}`}
            </h1>
          </div>
          {entregas.length > 0 && (
            <div className="flex shrink-0 gap-1.5 pb-1">
              {emRota > 0 && (
                <span className="rounded-full bg-info/10 px-2.5 py-1 text-[11px] font-semibold text-info">
                  {emRota} em rota
                </span>
              )}
              {aguardando > 0 && (
                <span className="rounded-full bg-warn/10 px-2.5 py-1 text-[11px] font-semibold text-warn">
                  {aguardando} pra sair
                </span>
              )}
            </div>
          )}
        </div>

        <TurnoCard turnoInicial={turnoAtivo} tempoMedioMin={tempoMedioMin} />

        <div className="mt-5 space-y-4">
          {entregas.length === 0 ? (
            <EstadoVazio
              icone={PackageCheck}
              titulo="Nenhuma entrega pra você agora"
              descricao="Quando uma venda for designada a você, ela aparece aqui. Puxe a tela pra baixo pra atualizar."
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
                    endereco_entrega: e.endereco_entrega,
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
