import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Plus, Printer } from 'lucide-react'

const statusCor: Record<string, 'default' | 'secondary' | 'destructive'> = {
  confirmado: 'default',
  em_separacao: 'secondary',
  saiu_entrega: 'secondary',
  entregue: 'default',
  cancelado: 'destructive',
  rascunho: 'secondary',
  parcial: 'secondary',
}

type PedidoLinha = {
  id: string
  numero_pedido: number
  status: string
  total: number
  data_pedido: string
  forma_pagamento: string
  clientes: { nome: string } | null
}

export default async function PedidosPage() {
  const supabase = await createClient()
  const { data: pedidosRaw } = await supabase
    .from('pedidos')
    .select('id, numero_pedido, status, total, data_pedido, forma_pagamento, clientes(nome)')
    .order('created_at', { ascending: false })
    .limit(100)

  const pedidos = (pedidosRaw ?? []) as unknown as PedidoLinha[]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <Link href="/pedidos/novo" className="inline-flex items-center gap-2 rounded-lg px-3 h-8 text-sm font-medium bg-[#2B7A78] hover:bg-[#1e5654] text-white transition-colors">
          <Plus size={16} />Novo Pedido
        </Link>
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-card border-b border-border">
            <tr>
              <th className="text-left p-3 font-medium">#</th>
              <th className="text-left p-3 font-medium">Cliente</th>
              <th className="text-left p-3 font-medium">Data</th>
              <th className="text-left p-3 font-medium">Pagamento</th>
              <th className="text-right p-3 font-medium">Total</th>
              <th className="text-center p-3 font-medium">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => (
              <tr key={p.id} className="border-b border-border hover:bg-card transition-colors">
                <td className="p-3 font-mono font-medium">#{String(p.numero_pedido).padStart(4, '0')}</td>
                <td className="p-3">{p.clientes?.nome}</td>
                <td className="p-3 text-muted-foreground">{new Date(p.data_pedido).toLocaleString('pt-BR')}</td>
                <td className="p-3 text-muted-foreground">{p.forma_pagamento}</td>
                <td className="p-3 text-right font-medium text-[#D4A520]">R$ {p.total.toFixed(2)}</td>
                <td className="p-3 text-center">
                  <Badge variant={statusCor[p.status] ?? 'default'}>{p.status}</Badge>
                </td>
                <td className="p-3">
                  <Link href={`/pedidos/${p.id}/romaneio`} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <Printer size={12} />Romaneio
                  </Link>
                </td>
              </tr>
            ))}
            {!pedidos.length && (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhum pedido encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
