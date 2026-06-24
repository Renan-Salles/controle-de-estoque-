'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ShoppingCart, Package, DollarSign, Users, Settings, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pedidos', label: 'Pedidos', icon: ShoppingCart },
  { href: '/estoque', label: 'Estoque', icon: Package },
  { href: '/financeiro/a-receber', label: 'Financeiro', icon: DollarSign },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/fornecedores', label: 'Fornecedores', icon: Truck },
  { href: '/configuracoes', label: 'Config', icon: Settings },
]

export function Sidebar() {
  const path = usePathname()
  return (
    <aside className="w-56 min-h-screen bg-card border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <span className="font-bold text-lg text-white">R$ DEPOSITO</span>
        <p className="text-xs text-muted-foreground">Deposito de Bebidas</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {nav.map(item => (
          <Link key={item.href} href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
              path.startsWith(item.href)
                ? 'bg-[#2B7A78]/20 text-[#2B7A78] font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}>
            <item.icon size={16} />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">R$ DEPOSITO v1.0</p>
      </div>
    </aside>
  )
}
