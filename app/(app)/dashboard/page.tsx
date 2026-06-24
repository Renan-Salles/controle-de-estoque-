import { createClient } from '@/lib/supabase/server'
import { BarChart3, Package, ShoppingCart, DollarSign } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const supabase = await createClient()

  const hoje = new Date().toISOString().split('T')[0]
  const inicioMes = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`

  type RowTotal = { total: number }
  type RowId = { id: string }
  type RowCR = { valor: number; valor_pago: number }
  type RowPedidoMes = { data_pedido: string; total: number }

  const [
    { data: pedidosHoje },
    { data: pedidosPendentes },
    { data: estoquesCriticos },
    { data: contasVencendo },
    { data: pedidosMes },
  ] = await Promise.all([
    supabase.from('pedidos').select('total').gte('data_pedido', `${hoje}T00:00:00`).not('status', 'in', '(cancelado,rascunho)') as unknown as Promise<{ data: RowTotal[] }>,
    supabase.from('pedidos').select('id').in('status', ['confirmado', 'em_separacao']) as unknown as Promise<{ data: RowId[] }>,
    supabase.from('v_posicao_estoque').select('id').in('status_estoque', ['critico', 'ruptura']) as unknown as Promise<{ data: RowId[] }>,
    supabase.from('contas_receber').select('valor, valor_pago').eq('data_vencimento', hoje).in('status', ['aberto', 'parcial']) as unknown as Promise<{ data: RowCR[] }>,
    supabase.from('pedidos').select('data_pedido, total').gte('data_pedido', `${inicioMes}T00:00:00`).not('status', 'in', '(cancelado,rascunho)').order('data_pedido') as unknown as Promise<{ data: RowPedidoMes[] }>,
  ])

  const receitaHoje = (pedidosHoje ?? []).reduce((acc, p) => acc + (p.total ?? 0), 0)
  const receitaMes = (pedidosMes ?? []).reduce((acc, p) => acc + (p.total ?? 0), 0)
  const aReceberHoje = (contasVencendo ?? []).reduce((acc, c) => acc + ((c.valor ?? 0) - (c.valor_pago ?? 0)), 0)

  const kpis = [
    { label: 'Pedidos hoje', valor: pedidosHoje?.length ?? 0, sub: `R$ ${receitaHoje.toFixed(2)}`, icon: ShoppingCart, cor: '#2B7A78' },
    { label: 'Pendentes', valor: pedidosPendentes?.length ?? 0, sub: 'Confirmados ou em separacao', icon: Package, cor: '#D4A520' },
    { label: 'Estoque critico', valor: estoquesCriticos?.length ?? 0, sub: 'Produtos abaixo do minimo', icon: Package, cor: (estoquesCriticos?.length ?? 0) > 0 ? '#ef4444' : '#2B7A78' },
    { label: 'A receber hoje', valor: `R$ ${aReceberHoje.toFixed(2)}`, sub: 'Vencimentos do dia', icon: DollarSign, cor: '#2B7A78' },
  ]

  // Grafico simples (ultimos 7 dias de pedidos do mes)
  const dadosGrafico = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const dStr = d.toISOString().split('T')[0]
    const total = (pedidosMes ?? [])
      .filter(p => p.data_pedido.startsWith(dStr))
      .reduce((acc, p) => acc + (p.total ?? 0), 0)
    return { dia: d.toLocaleDateString('pt-BR', { weekday: 'short' }), total }
  })

  const maxTotal = Math.max(...dadosGrafico.map(d => d.total), 1)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/pedidos/novo" className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-[#2B7A78] hover:bg-[#1e5654] text-white transition-colors">
          <ShoppingCart size={14} />Novo Pedido
        </Link>
      </div>

      {(estoquesCriticos?.length ?? 0) > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400 flex items-center gap-2">
          <Package size={16} />
          {estoquesCriticos?.length} produto(s) com estoque critico ou zerado.
          <Link href="/estoque?filtro=critico" className="underline ml-1">Ver estoque</Link>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-card border border-border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{k.label}</p>
              <k.icon size={16} style={{ color: k.cor }} />
            </div>
            <p className="text-2xl font-bold">{k.valor}</p>
            <p className="text-xs text-muted-foreground">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><BarChart3 size={16} />Vendas (ultimos 7 dias)</h2>
          <div className="flex items-end gap-2 h-32">
            {dadosGrafico.map(d => (
              <div key={d.dia} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t transition-all"
                  style={{
                    height: `${(d.total / maxTotal) * 100}%`,
                    background: '#2B7A78',
                    minHeight: d.total > 0 ? '4px' : '0',
                  }}
                />
                <p className="text-xs text-muted-foreground">{d.dia}</p>
                {d.total > 0 && <p className="text-xs font-mono">R${(d.total/1000).toFixed(1)}k</p>}
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border flex justify-between text-sm">
            <span className="text-muted-foreground">Total do mes</span>
            <span className="font-bold text-[#D4A520]">R$ {receitaMes.toFixed(2)}</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="font-semibold mb-4">Acesso Rapido</h2>
          <div className="space-y-2">
            <Link href="/pedidos/novo" className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors">
              <ShoppingCart size={16} className="text-[#2B7A78]" />
              <div>
                <p className="text-sm font-medium">Novo Pedido</p>
                <p className="text-xs text-muted-foreground">Registrar venda ou entrega</p>
              </div>
            </Link>
            <Link href="/estoque" className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors">
              <Package size={16} className="text-[#2B7A78]" />
              <div>
                <p className="text-sm font-medium">Dar Entrada no Estoque</p>
                <p className="text-xs text-muted-foreground">Registrar entrada de mercadoria</p>
              </div>
            </Link>
            <Link href="/financeiro/a-receber" className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors">
              <DollarSign size={16} className="text-[#D4A520]" />
              <div>
                <p className="text-sm font-medium">Contas a Receber</p>
                <p className="text-xs text-muted-foreground">Gerenciar fiados e pagamentos</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
