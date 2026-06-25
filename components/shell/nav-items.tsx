'use client'

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
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Fonte única dos itens de navegação. Consumida pela Sidebar (desktop) e pelo
// MobileNav (drawer no celular) para garantir paridade de telas em todos os
// breakpoints.

export type Item = { href: string; label: string; icon: LucideIcon }
export type Grupo = { titulo: string; itens: Item[] }

export const GRUPOS: Grupo[] = [
  {
    titulo: 'Operação',
    itens: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/movimentacoes', label: 'Movimentações', icon: ArrowRightLeft },
    ],
  },
  {
    titulo: 'Cadastros',
    itens: [
      { href: '/produtos', label: 'Produtos', icon: Package },
      { href: '/clientes', label: 'Clientes', icon: Users },
      { href: '/fornecedores', label: 'Fornecedores', icon: Truck },
    ],
  },
  {
    titulo: 'Gestão',
    itens: [
      { href: '/estoque', label: 'Estoque', icon: Boxes },
      { href: '/financeiro/formas-pagamento', label: 'Financeiro', icon: DollarSign },
      { href: '/financeiro/relatorios', label: 'Relatórios', icon: BarChart3 },
    ],
  },
]

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

// Marca uma rota como ativa. Para "/movimentacoes", evita ativar quando estamos
// em "/movimentacoes/nova" (que tem item próprio destacado).
export function rotaAtiva(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  if (href === '/movimentacoes')
    return pathname === '/movimentacoes' || /^\/movimentacoes\/(?!nova)/.test(pathname)
  return pathname === href || pathname.startsWith(href + '/')
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
}: {
  item: Item
  ativo: boolean
  onNavegar?: () => void
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
      <span className="truncate">{item.label}</span>
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

// Bloco completo de navegação (Nova Movimentação + grupos + Config no rodapé).
// `onNavegar` é chamado ao tocar em qualquer item — usado pelo drawer para
// fechar ao navegar.
export function NavConteudo({
  pathname,
  onNavegar,
}: {
  pathname: string
  onNavegar?: () => void
}) {
  const novoAtivo = pathname === ITEM_NOVA_MOVIMENTACAO.href
  return (
    <>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <NovaMovimentacaoLink ativo={novoAtivo} onNavegar={onNavegar} />

        {GRUPOS.map((grupo) => (
          <div key={grupo.titulo} className="mb-5">
            <p className="mb-1.5 px-3 text-[10px] font-medium uppercase tracking-wider text-text-muted">
              {grupo.titulo}
            </p>
            <div className="space-y-0.5">
              {grupo.itens.map((item) => (
                <LinkItem
                  key={item.href}
                  item={item}
                  ativo={rotaAtiva(pathname, item.href)}
                  onNavegar={onNavegar}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <LinkItem
          item={ITEM_CONFIGURACOES}
          ativo={rotaAtiva(pathname, ITEM_CONFIGURACOES.href)}
          onNavegar={onNavegar}
        />
      </div>
    </>
  )
}
