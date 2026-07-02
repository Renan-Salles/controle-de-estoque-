import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { RomaneioView } from '@/components/romaneio/RomaneioView'
import { PrintActions } from '@/components/romaneio/PrintActions'

export default async function RomaneioPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: pedido } = await supabase
    .from('pedidos')
    .select(
      `*, locais(nome, cnpj, telefone, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade), clientes(nome, telefone, endereco), pedido_itens(quantidade_pedida, preco_unitario, total, produtos(nome, embalagem)), entregador:profiles!pedidos_entregador_id_fkey(nome)`,
    )
    .eq('id', id)
    .single()

  if (!pedido) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = pedido as any

  return (
    <>
      <style>{`
        @page { margin: 0; }
        html, body { margin: 0; padding: 0; background: white; }
        @media print { .no-print { display: none !important; } }
        .romaneio { padding-bottom: 80px; }
        @media print { .romaneio { padding-bottom: 14mm; } }
      `}</style>
      <RomaneioView pedido={p} />
      <PrintActions numeroPedido={p.numero_pedido} />
    </>
  )
}
