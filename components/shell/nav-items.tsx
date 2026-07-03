'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  LayoutDashboard,
  Plus,
  ArrowRightLeft,
  Package,
  Users,
  Truck,
  Boxes,
  DollarSign,
  BarChart3,
  Settings,
  ShoppingCart,
  ChevronDown,
  UserCog,
  PackageCheck,
  TrendingUp,
  ArrowUpFromLine,
  HandCoins,
  ReceiptText,
  Wallet,
  Landmark,
  Store,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { itemVisivel } from '@/lib/nav-catalogo'

// Fonte única de navegação. Consumida pela Sidebar (desktop) e pelo MobileNav
// (drawer no celular) para garantir paridade de telas em todos os breakpoints.

export type Item = { href: string; label: string; icon: LucideIcon }
export type Grupo = { titulo: string; icone: LucideIcon; itens: Item[] }

// Um bloco da navegação é um item solto (link direto) ou um grupo colapsável.
export type Bloco = { tipo: 'item'; item: Item } | { tipo: 'grupo'; grupo: Grupo }

const ITEM_DASHBOARD: Item = { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }
export const ITEM_PEDIDOS: Item = { href: '/pedidos', label: 'Pedidos', icon: PackageCheck }
const ITEM_MOVIMENTACOES: Item = { href: '/movimentacoes', label: 'Movimentações', icon: ArrowRightLeft }
const ITEM_ESTOQUE: Item = { href: '/estoque', label: 'Estoque', icon: Boxes }

const ITEM_CAIXA: Item = { href: '/caixa', label: 'Caixa', icon: Landmark }

const GRUPO_OPERACAO: Grupo = {
  titulo: 'Operação',
  icone: ArrowRightLeft,
  itens: [ITEM_PEDIDOS, ITEM_MOVIMENTACOES, ITEM_ESTOQUE, ITEM_CAIXA],
}

const GRUPO_CADASTRO: Grupo = {
  titulo: 'Cadastro',
  icone: ShoppingCart,
  itens: [
    { href: '/clientes', label: 'Clientes', icon: Users },
    { href: '/fornecedores', label: 'Fornecedores', icon: Truck },
    { href: '/produtos', label: 'Produtos', icon: Package },
  ],
}

const ITEM_EQUIPE: Item = { href: '/equipe', label: 'Equipe', icon: UserCog }

// Vendas (relatorios/*) + Financeiro (financeiro/*, absorvido aqui pra nao
// deixar "Financeiro" como item solto) numa lista so, com sub-rotulo visual
// separando os dois blocos (ver GrupoColapsavel).
const GRUPO_RELATORIOS: Grupo = {
  titulo: 'Relatórios',
  icone: BarChart3,
  itens: [
    { href: '/relatorios', label: 'Por período', icon: BarChart3 },
    { href: '/relatorios/produto', label: 'Por produto', icon: Package },
    { href: '/relatorios/cliente', label: 'Por cliente', icon: Users },
    { href: '/relatorios/entregadores', label: 'Entregadores', icon: Truck },
    // So admin enxerga de fato: fora do NAV_CATALOGO, cargo restrito nao
    // recebe o href em itens_visiveis e o item some (a rota tambem barra).
    { href: '/relatorios/locais', label: 'Entre locais', icon: Store },
    { href: '/financeiro/relatorios', label: 'Faturamento & ABC', icon: TrendingUp },
    { href: '/financeiro/resultado', label: 'Resultado', icon: DollarSign },
    { href: '/financeiro/a-pagar', label: 'A pagar', icon: ArrowUpFromLine },
    { href: '/financeiro/a-receber', label: 'A receber', icon: HandCoins },
    { href: '/financeiro/custos-fixos', label: 'Custos Fixos', icon: ReceiptText },
    { href: '/financeiro/formas-pagamento', label: 'Formas de pagamento', icon: Wallet },
  ],
}

// Primeiro item financeiro dentro de Relatorios -- marca onde entra o
// sub-rotulo "FINANCEIRO" (ver GrupoColapsavel).
const PRIMEIRO_HREF_FINANCEIRO = '/financeiro/relatorios'

// Ordem da sidebar (itens soltos e grupos intercalados).
export const NAV: Bloco[] = [
  { tipo: 'item', item: ITEM_DASHBOARD },
  { tipo: 'grupo', grupo: GRUPO_OPERACAO },
  { tipo: 'grupo', grupo: GRUPO_CADASTRO },
  { tipo: 'grupo', grupo: GRUPO_RELATORIOS },
]

const GRUPOS: Grupo[] = NAV.flatMap((b) => (b.tipo === 'grupo' ? [b.grupo] : []))

export const ITEM_NOVA_MOVIMENTACAO: Item = {
  href: '/movimentacoes/nova',
  label: 'Nova Movimentação',
  icon: Plus,
}

export const ITEM_CONFIGURACOES: Item = {
  href: '/configuracoes',
  label: 'Configurações',
  icon: Settings,
}

const LS_SECOES = 'deposito.sidebar.secoesAbertas'

function lerLS<T>(chave: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const v = window.localStorage.getItem(chave)
    return v === null ? fallback : (JSON.parse(v) as T)
  } catch {
    return fallback
  }
}

function gravarLS(chave: string, valor: unknown) {
  try {
    window.localStorage.setItem(chave, JSON.stringify(valor))
  } catch {
    /* localStorage indisponível (modo privado): degrada sem quebrar. */
  }
}

// Marca uma rota como ativa. Para "/movimentacoes", evita ativar quando estamos
// em "/movimentacoes/nova" (que tem item próprio destacado). "/estoque" e
// "/relatorios" são exatos para não acender junto com suas sub-rotas próprias.
export function rotaAtiva(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  if (href === '/estoque') return pathname.startsWith('/estoque')
  if (href === '/relatorios') return pathname === '/relatorios'
  if (href === '/movimentacoes')
    return pathname === '/movimentacoes' || /^\/movimentacoes\/(?!nova)/.test(pathname)
  return pathname === href || pathname.startsWith(href + '/')
}

// Qual grupo contém a rota atual.
function grupoDaRota(pathname: string): string | null {
  for (const g of GRUPOS) {
    if (g.itens.some((i) => rotaAtiva(pathname, i.href))) return g.titulo
  }
  return null
}

// Estado das seções abertas (múltiplas), persistido em localStorage. A seção da
// rota atual fica sempre aberta. Inicializa estável no SSR e reidrata após montar.
export function useSecoesAbertas(pathname: string) {
  const daRota = grupoDaRota(pathname)
  const [abertas, setAbertas] = useState<string[]>(() => (daRota ? [daRota] : []))

  // Reidrata do localStorage só após o mount (evita mismatch de hidratação SSR).
  // setState em effect é intencional aqui: sincroniza com sistema externo.
  useEffect(() => {
    const salvas = lerLS<string[]>(LS_SECOES, daRota ? [daRota] : [GRUPOS[0].titulo])
    const comRota = daRota && !salvas.includes(daRota) ? [...salvas, daRota] : salvas
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAbertas(comRota)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Ao navegar, garante que a seção da rota atual esteja aberta.
  useEffect(() => {
    if (!daRota) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAbertas((atual) => (atual.includes(daRota) ? atual : [...atual, daRota]))
  }, [daRota])

  function alternar(titulo: string) {
    setAbertas((atual) => {
      const proximo = atual.includes(titulo)
        ? atual.filter((t) => t !== titulo)
        : [...atual, titulo]
      gravarLS(LS_SECOES, proximo)
      return proximo
    })
  }

  return { aberta: (titulo: string) => abertas.includes(titulo), alternar }
}

// Monta o logo a partir do nome do local: selo dourado + texto.
// "R$ DEPÓSITO" => selo "R$" + "DEPÓSITO"; "Império Salles" => selo "IS" + nome.
export function logoPartes(nome: string) {
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

export function LinkItem({
  item,
  ativo,
  onNavegar,
  selo,
}: {
  item: Item
  ativo: boolean
  onNavegar?: () => void
  /** Numero pra destacar (ex. contagem de pedidos pendentes). Sem selo quando 0/undefined. */
  selo?: number
}) {
  const Icone = item.icon
  return (
    <Link
      href={item.href}
      aria-current={ativo ? 'page' : undefined}
      onClick={onNavegar}
      className={cn(
        'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm u-motion u-press-sm',
        ativo
          ? 'bg-brand/12 font-medium text-text'
          : 'text-text-muted hover:bg-surface-2 hover:text-text',
      )}
    >
      {ativo && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-brand" />
      )}
      <Icone
        className={cn('size-[18px] shrink-0', ativo ? 'text-brand' : '')}
        strokeWidth={1.5}
      />
      <span className="flex-1 truncate">{item.label}</span>
      {!!selo && (
        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-info px-1.5 text-[11px] font-semibold text-white">
          {selo}
        </span>
      )}
    </Link>
  )
}

// Botão destacado "Nova Movimentação" (teal cheio). Compartilhado entre
// sidebar e drawer.
export function NovaMovimentacaoLink({
  ativo,
  onNavegar,
}: {
  ativo: boolean
  onNavegar?: () => void
}) {
  const Icone = ITEM_NOVA_MOVIMENTACAO.icon
  return (
    <Link
      href={ITEM_NOVA_MOVIMENTACAO.href}
      aria-current={ativo ? 'page' : undefined}
      onClick={onNavegar}
      className={cn(
        'mb-4 flex items-center gap-2.5 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white u-motion u-press shadow-sm hover:bg-brand-strong',
        ativo && 'bg-brand-strong',
      )}
    >
      <Icone className="size-[18px]" strokeWidth={1.5} />
      {ITEM_NOVA_MOVIMENTACAO.label}
    </Link>
  )
}

// Rótulo de sub-seção dentro de um grupo (ex. "VENDAS"/"FINANCEIRO" dentro
// de Relatórios) -- só um cabeçalho visual, não colapsa nada.
function RotuloSecao({ texto, topo = false }: { texto: string; topo?: boolean }) {
  return (
    <p
      className={cn(
        'px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted/70',
        topo ? 'pt-0.5' : 'pt-2.5',
      )}
    >
      {texto}
    </p>
  )
}

// Seção colapsável: header clicável + lista que anima a altura via
// grid-template-rows 0fr->1fr (barato, sem medir o DOM). Mostra um ponto quando
// está fechada mas contém a rota ativa.
function GrupoColapsavel({
  grupo,
  aberto,
  onToggle,
  pathname,
  onNavegar,
  pedidosPendentes = 0,
}: {
  grupo: Grupo
  aberto: boolean
  onToggle: () => void
  pathname: string
  onNavegar?: () => void
  /** Contagem de entregas/retiradas ainda não confirmadas, pro selo do item Pedidos. */
  pedidosPendentes?: number
}) {
  const Icone = grupo.icone
  const temAtivoFechado =
    !aberto && grupo.itens.some((i) => rotaAtiva(pathname, i.href))
  const ehRelatorios = grupo.titulo === 'Relatórios'
  return (
    <div className="mb-1.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={aberto}
        className="group flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-text-muted u-motion u-press-sm hover:bg-surface-2 hover:text-text"
      >
        <Icone className="size-[18px] shrink-0" strokeWidth={1.5} />
        <span className="flex-1 text-left font-medium">{grupo.titulo}</span>
        {temAtivoFechado && (
          <span className="size-1.5 rounded-full bg-brand" aria-hidden />
        )}
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-text-muted/60 transition-transform duration-200',
            aberto ? 'rotate-0' : '-rotate-90',
          )}
          strokeWidth={1.75}
        />
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-in-out"
        style={{ gridTemplateRows: aberto ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="space-y-0.5 pb-1 pl-3 pt-0.5">
            {grupo.itens.map((item, i) => (
              <div key={item.href}>
                {ehRelatorios && i === 0 && <RotuloSecao texto="Vendas" topo />}
                {ehRelatorios && item.href === PRIMEIRO_HREF_FINANCEIRO && (
                  <RotuloSecao texto="Financeiro" />
                )}
                <LinkItem
                  item={item}
                  ativo={rotaAtiva(pathname, item.href)}
                  onNavegar={onNavegar}
                  selo={item.href === ITEM_PEDIDOS.href ? pedidosPendentes : undefined}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Bloco completo de navegação (Nova Movimentação + itens de topo + grupos
// colapsáveis + Config no rodapé). `onNavegar` é chamado ao tocar em qualquer
// item — usado pelo drawer para fechar ao navegar.
export function NavConteudo({
  pathname,
  onNavegar,
  itensVisiveis = null,
  isAdmin = false,
  pedidosPendentes = 0,
}: {
  pathname: string
  onNavegar?: () => void
  // null = sem restrição (mostra tudo). Array = só os hrefs do cargo.
  itensVisiveis?: string[] | null
  isAdmin?: boolean
  /** Contagem de entregas/retiradas ainda não confirmadas, pro selo do item. */
  pedidosPendentes?: number
}) {
  const novoAtivo = pathname === ITEM_NOVA_MOVIMENTACAO.href
  const { aberta, alternar } = useSecoesAbertas(pathname)

  const novoVisivel = itemVisivel(ITEM_NOVA_MOVIMENTACAO.href, itensVisiveis)

  return (
    <>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {novoVisivel && (
          <NovaMovimentacaoLink ativo={novoAtivo} onNavegar={onNavegar} />
        )}

        {NAV.map((bloco) => {
          if (bloco.tipo === 'item') {
            if (!itemVisivel(bloco.item.href, itensVisiveis)) return null
            return (
              <div key={bloco.item.href} className="mb-1.5">
                <LinkItem
                  item={bloco.item}
                  ativo={rotaAtiva(pathname, bloco.item.href)}
                  onNavegar={onNavegar}
                />
              </div>
            )
          }
          // Grupo: filtra itens pelo cargo; some se não sobrar nenhum.
          const itens = bloco.grupo.itens.filter((i) =>
            itemVisivel(i.href, itensVisiveis),
          )
          if (bloco.grupo.titulo === 'Cadastro' && isAdmin) {
            itens.push(ITEM_EQUIPE)
          }
          if (itens.length === 0) return null
          const grupo = { ...bloco.grupo, itens }
          return (
            <GrupoColapsavel
              key={grupo.titulo}
              grupo={grupo}
              aberto={aberta(grupo.titulo)}
              onToggle={() => alternar(grupo.titulo)}
              pathname={pathname}
              onNavegar={onNavegar}
              pedidosPendentes={pedidosPendentes}
            />
          )
        })}
      </nav>

      {/* Configurações é a área do admin (usuários + cargos). Só admin vê. */}
      {isAdmin && (
        <div className="border-t border-border p-3">
          <LinkItem
            item={ITEM_CONFIGURACOES}
            ativo={rotaAtiva(pathname, ITEM_CONFIGURACOES.href)}
            onNavegar={onNavegar}
          />
        </div>
      )}
    </>
  )
}
