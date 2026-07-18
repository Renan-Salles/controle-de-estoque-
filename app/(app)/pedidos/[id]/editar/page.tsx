import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { caixaFechadoHoje, buscarItensParaEditar } from '@/lib/actions/pedidos'
import { podeEditarPedido } from '@/lib/pedido-labels'
import { EditarVendaForm } from '@/components/pedido/EditarVendaForm'

export default async function EditarVendaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: pedidoRaw } = await supabase
    .from('pedidos')
    .select('id, numero_pedido, local_id, status, data_pedido, concluido_em, tipo_fulfillment')
    .eq('id', id)
    .single()

  type PedidoBasico = {
    id: string
    numero_pedido: number
    local_id: string
    status: string
    data_pedido: string
    concluido_em: string | null
    tipo_fulfillment: string
  }
  const pedido = pedidoRaw as PedidoBasico | null
  if (!pedido) notFound()

  const fechado = await caixaFechadoHoje(pedido.local_id)
  if (!podeEditarPedido(pedido, fechado)) notFound()

  const itens = await buscarItensParaEditar(id)

  return (
    <div className="mx-auto max-w-3xl">
      <EditarVendaForm
        pedidoId={id}
        numeroPedido={pedido.numero_pedido}
        itensIniciais={itens}
      />
    </div>
  )
}
