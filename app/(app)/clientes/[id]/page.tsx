import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database.types'
import { notFound } from 'next/navigation'

type ClienteRow = Database['public']['Tables']['clientes']['Row']
type PedidoResumo = Pick<
  Database['public']['Tables']['pedidos']['Row'],
  'id' | 'numero_pedido' | 'total' | 'status' | 'data_pedido' | 'forma_pagamento'
>

export default async function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: cliente } = await supabase.from('clientes').select('*').eq('id', id).single() as { data: ClienteRow | null }
  if (!cliente) notFound()

  const { data: pedidos } = await supabase
    .from('pedidos')
    .select('id, numero_pedido, total, status, data_pedido, forma_pagamento')
    .eq('cliente_id', id)
    .order('data_pedido', { ascending: false })
    .limit(20) as { data: PedidoResumo[] | null }

  const end = cliente.endereco as { rua?: string; numero?: string; bairro?: string; cidade?: string } | null

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">{cliente.nome}</h1>
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg p-4 space-y-2">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Dados</h2>
          <p><span className="text-muted-foreground">Tipo:</span> {cliente.tipo}</p>
          <p><span className="text-muted-foreground">Telefone:</span> {cliente.telefone ?? '-'}</p>
          <p><span className="text-muted-foreground">WhatsApp:</span> {cliente.whatsapp ?? '-'}</p>
          {end?.rua && <p><span className="text-muted-foreground">Endereco:</span> {end.rua}, {end.numero} - {end.bairro} - {end.cidade}</p>}
          <p><span className="text-muted-foreground">Pagamento padrao:</span> {cliente.forma_pagamento_padrao}</p>
          {cliente.prazo_pagamento_dias > 0 && <p><span className="text-muted-foreground">Prazo:</span> {cliente.prazo_pagamento_dias} dias</p>}
        </div>
        <div className="bg-card border border-border rounded-lg p-4 space-y-2">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Ultimos Pedidos</h2>
          {(pedidos ?? []).map(p => (
            <div key={p.id} className="flex justify-between text-sm py-1 border-b border-border last:border-0">
              <span>#{p.numero_pedido} - {p.status}</span>
              <span className="font-medium">R$ {Number(p.total).toFixed(2)}</span>
            </div>
          ))}
          {!pedidos?.length && <p className="text-muted-foreground text-sm">Nenhum pedido ainda</p>}
        </div>
      </div>
    </div>
  )
}
