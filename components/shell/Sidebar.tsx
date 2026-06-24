'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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

type Item = { href: string; label: string; icon: LucideIcon }
type Grupo = { titulo: string; itens: Item[] }

const GRUPOS: Grupo[] = [
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

// Marca uma rota como ativa. Para "/movimentacoes", evita ativar quando estamos
// em "/movimentacoes/nova" (que tem item próprio destacado).
function rotaAtiva(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  if (href === '/movimentacoes')
    return pathname === '/movimentacoes' || /^\/movimentacoes\/(?!nova)/.test(pathname)
  return pathname === href || pathname.startsWith(href + '/')
}

function LinkItem({ item, ativo }: { item: Item; ativo: boolean }) {
  const Icone = item.icon
  return (
    <Link
      href={item.href}
      aria-current={ativo ? 'page' : undefined}
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

export function Sidebar() {
  const pathname = usePathname()
  const novoAtivo = pathname === '/movimentacoes/nova'

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-border px-5">
        <Link
          href="/dashboard"
          className="font-display flex items-center gap-2 text-[17px] font-bold tracking-tight text-text"
        >
          <span className="flex size-7 items-center justify-center rounded-md bg-accent-gold/15 text-sm font-bold text-accent-gold">
            R$
          </span>
          DEPÓSITO
        </Link>
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {/* Nova Movimentação — destaque (botão teal cheio) */}
        <Link
          href="/movimentacoes/nova"
          aria-current={novoAtivo ? 'page' : undefined}
          className={cn(
            'mb-4 flex items-center gap-2.5 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white u-motion u-press shadow-sm hover:bg-brand-strong',
            novoAtivo && 'bg-brand-strong',
          )}
        >
          <Plus className="size-[18px]" strokeWidth={1.5} />
          Nova Movimentação
        </Link>

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
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Rodapé: Config */}
      <div className="border-t border-border p-3">
        <LinkItem
          item={{ href: '/configuracoes', label: 'Configurações', icon: Settings }}
          ativo={rotaAtiva(pathname, '/configuracoes')}
        />
      </div>
    </aside>
  )
}
