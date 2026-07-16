import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { CupomFiscal } from '@/components/romaneio/CupomFiscal'
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
      `*, locais(nome, cnpj, telefone, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade), clientes(nome, telefone, endereco), pedido_itens(quantidade_pedida, preco_unitario, total, embalagem_nome, embalagem_unidades, produtos(nome, embalagem)), entregador:profiles!pedidos_entregador_id_fkey(nome)`,
    )
    .eq('id', id)
    .single()

  if (!pedido) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = pedido as any

  return (
    <>
      <div className="cupom-print-area mx-auto max-w-xs py-6">
        <CupomFiscal data={p} />
      </div>
      <PrintActions numeroPedido={p.numero_pedido} />
    </>
  )
}
