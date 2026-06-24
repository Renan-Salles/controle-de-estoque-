import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { RomaneioView } from '@/components/romaneio/RomaneioView'

function AutoPrint() {
  return <script dangerouslySetInnerHTML={{ __html: 'window.onload=function(){setTimeout(function(){window.print()},500)}' }} />
}

export default async function RomaneioPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: pedido } = await supabase
    .from('pedidos')
    .select(`*, clientes(nome, telefone, endereco), pedido_itens(quantidade_pedida, preco_unitario, total, produtos(nome, embalagem))`)
    .eq('id', params.id)
    .single()

  if (!pedido) notFound()

  return (
    <>
      <AutoPrint />
      <RomaneioView pedido={pedido as Parameters<typeof RomaneioView>[0]['pedido']} />
    </>
  )
}
