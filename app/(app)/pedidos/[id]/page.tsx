import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Printer } from 'lucide-react'

type PedidoComRelacoes = {
  id: string
  numero_pedido: number
  status: string
  total: number
  data_pedido: string
  forma_pagamento: string
  observacoes: string | null
  clientes: { nome: string; telefone: string | null } | null
  pedido_itens: { quantidade_pedida: number; preco_unitario: number; total: number; produtos: { nome: string; embalagem: string } }[]
}

export default async function PedidoDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: pedidoRaw } = await supabase
    .from('pedidos')
    .select(`id, numero_pedido, status, total, data_pedido, forma_pagamento, observacoes, clientes(nome, telefone), pedido_itens(quantidade_pedida, preco_unitario, total, produtos(nome, embalagem))`)
    .eq('id', params.id)
    .single()

  if (!pedidoRaw) notFound()
  const pedido = pedidoRaw as unknown as PedidoComRelacoes

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pedido #{String(pedido.numero_pedido).padStart(4, '0')}</h1>
        <div className="flex gap-2">
          <Badge>{pedido.status}</Badge>
          <Link href={`/pedidos/${pedido.id}/romaneio`} className="inline-flex items-center gap-1 rounded-lg px-2.5 h-7 text-[0.8rem] font-medium border border-border bg-background hover:bg-muted transition-colors">
            <Printer size={14} />Romaneio
          </Link>
        </div>
      </div>
      <div className="bg-card border border-border rounded-lg p-4 space-y-2 text-sm">
        <p><span className="text-muted-foreground">Cliente:</span> {pedido.clientes?.nome}</p>
        <p><span className="text-muted-foreground">Data:</span> {new Date(pedido.data_pedido).toLocaleString('pt-BR')}</p>
        <p><span className="text-muted-foreground">Pagamento:</span> {pedido.forma_pagamento}</p>
        {pedido.observacoes && <p><span className="text-muted-foreground">Obs:</span> {pedido.observacoes}</p>}
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-card border-b border-border">
            <tr>
              <th className="text-left p-3">Produto</th>
              <th className="text-center p-3">Qtde</th>
              <th className="text-right p-3">Preco un.</th>
              <th className="text-right p-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {pedido.pedido_itens.map((item, i) => (
              <tr key={i} className="border-b border-border">
                <td className="p-3">{item.produtos.nome}</td>
                <td className="p-3 text-center">{item.quantidade_pedida} {item.produtos.embalagem}</td>
                <td className="p-3 text-right">R$ {item.preco_unitario.toFixed(2)}</td>
                <td className="p-3 text-right font-medium">R$ {item.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border">
              <td colSpan={3} className="p-3 text-right font-semibold">Total</td>
              <td className="p-3 text-right font-bold text-[#D4A520]">R$ {pedido.total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
