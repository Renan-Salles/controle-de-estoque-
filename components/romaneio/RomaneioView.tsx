interface Props {
  pedido: {
    numero_pedido: number
    data_pedido: string
    total: number
    forma_pagamento: string
    observacoes: string | null
    clientes: { nome: string; telefone: string | null; endereco: Record<string, string> | null }
    pedido_itens: Array<{
      quantidade_pedida: number
      preco_unitario: number
      total: number
      produtos: { nome: string; embalagem: string }
    }>
  }
}

export function RomaneioView({ pedido }: Props) {
  const end = pedido.clientes.endereco
  const endStr = end ? `${end.rua || ''}, ${end.numero || ''} - ${end.bairro || ''} - ${end.cidade || ''}` : ''
  const dataFmt = new Date(pedido.data_pedido).toLocaleString('pt-BR')

  return (
    <div className="romaneio bg-white text-black p-8 max-w-[210mm] mx-auto" style={{ fontFamily: 'Arial, sans-serif', fontSize: '11px' }}>
      <div className="border-b-2 border-black pb-4 mb-4 flex justify-between">
        <div>
          <p className="font-bold text-lg">R$ DEPOSITO</p>
          <p>Deposito de Bebidas</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-lg">ROMANEIO #{String(pedido.numero_pedido).padStart(4, '0')}</p>
          <p>{dataFmt}</p>
        </div>
      </div>
      <div className="border border-black p-3 mb-4">
        <p className="font-bold mb-1">DADOS DO CLIENTE</p>
        <p><strong>Nome:</strong> {pedido.clientes.nome}</p>
        {pedido.clientes.telefone && <p><strong>Telefone:</strong> {pedido.clientes.telefone}</p>}
        {endStr.trim() !== ',  -  -' && <p><strong>Endereco de entrega:</strong> {endStr}</p>}
      </div>
      <table className="w-full border-collapse mb-4" style={{ border: '1px solid black' }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th className="border border-black p-1 text-left">#</th>
            <th className="border border-black p-1 text-left">Produto</th>
            <th className="border border-black p-1 text-center">Unid</th>
            <th className="border border-black p-1 text-center">Qtde</th>
            <th className="border border-black p-1 text-right">Preco un.</th>
            <th className="border border-black p-1 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {pedido.pedido_itens.map((item, i) => (
            <tr key={i}>
              <td className="border border-black p-1">{i + 1}</td>
              <td className="border border-black p-1">{(item.produtos as { nome: string; embalagem: string }).nome}</td>
              <td className="border border-black p-1 text-center">{(item.produtos as { nome: string; embalagem: string }).embalagem.toUpperCase()}</td>
              <td className="border border-black p-1 text-center">{item.quantidade_pedida}</td>
              <td className="border border-black p-1 text-right">R$ {item.preco_unitario.toFixed(2)}</td>
              <td className="border border-black p-1 text-right font-medium">R$ {item.total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-between mb-6">
        <div>
          <p><strong>Forma de pagamento:</strong> {pedido.forma_pagamento.replace(/_/g, ' ').toUpperCase()}</p>
          {pedido.observacoes && <p><strong>Obs:</strong> {pedido.observacoes}</p>}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">TOTAL: R$ {pedido.total.toFixed(2)}</p>
        </div>
      </div>
      <div className="flex justify-between mt-8 pt-4 border-t border-black">
        <div className="text-center w-5/12">
          <div className="border-t border-black mt-8 pt-1">Assinatura do Entregador</div>
        </div>
        <div className="text-center w-5/12">
          <div className="border-t border-black mt-8 pt-1">Assinatura do Cliente</div>
        </div>
      </div>
    </div>
  )
}
