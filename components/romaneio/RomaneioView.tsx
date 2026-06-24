import { formatarReal, formatarData } from '@/lib/formatos'
import { rotuloPagamento } from '@/lib/pedido-labels'

interface Props {
  pedido: {
    numero_pedido: number
    data_pedido: string
    total: number
    forma_pagamento: string
    prazo_pagamento_dias?: number
    observacoes: string | null
    clientes: {
      nome: string
      telefone: string | null
      endereco: Record<string, string> | null
    } | null
    pedido_itens: Array<{
      quantidade_pedida: number
      preco_unitario: number
      total: number
      produtos: { nome: string; embalagem: string }
    }>
  }
}

export function RomaneioView({ pedido }: Props) {
  const end = pedido.clientes?.endereco ?? null
  const partes = [
    [end?.rua, end?.numero].filter(Boolean).join(', '),
    end?.bairro,
    end?.cidade,
  ].filter(Boolean)
  const endStr = partes.join(' - ')

  const numeroFmt = String(pedido.numero_pedido).padStart(4, '0')
  const totalItens = pedido.pedido_itens.reduce(
    (acc, i) => acc + i.quantidade_pedida,
    0,
  )
  const prazoFmt =
    pedido.prazo_pagamento_dias && pedido.prazo_pagamento_dias > 0
      ? `${pedido.prazo_pagamento_dias} dias`
      : 'À vista'

  const cinza = '#666'
  const tdBase: React.CSSProperties = {
    border: '1px solid #333',
    padding: '6px 8px',
  }
  const thBase: React.CSSProperties = {
    border: '1px solid #333',
    padding: '6px 8px',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: cinza,
    fontWeight: 600,
  }

  return (
    <div
      className="romaneio mx-auto max-w-[210mm] bg-white p-10 text-black"
      style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '12px' }}
    >
      {/* Cabeçalho */}
      <div
        className="mb-6 flex items-end justify-between pb-4"
        style={{ borderBottom: '2px solid #111' }}
      >
        <div>
          <p style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em' }}>
            R$ DEPÓSITO
          </p>
          <p style={{ color: cinza, marginTop: '2px' }}>
            Depósito de Bebidas · Comprovante de pedido
          </p>
        </div>
        <div className="text-right">
          <p style={{ fontSize: '11px', color: cinza, letterSpacing: '0.08em' }}>
            ROMANEIO Nº
          </p>
          <p style={{ fontSize: '22px', fontWeight: 800 }}>{numeroFmt}</p>
          <p style={{ color: cinza, marginTop: '2px' }}>
            {formatarData(pedido.data_pedido)}
          </p>
        </div>
      </div>

      {/* Cliente */}
      <div className="mb-5">
        <p
          style={{
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: cinza,
            fontWeight: 700,
            marginBottom: '6px',
          }}
        >
          Dados do cliente
        </p>
        <div
          style={{
            border: '1px solid #333',
            borderRadius: '4px',
            padding: '12px 14px',
          }}
        >
          <p style={{ fontSize: '15px', fontWeight: 700 }}>
            {pedido.clientes?.nome ?? 'Consumidor não identificado (venda de balcão)'}
          </p>
          <div
            className="mt-1 flex flex-wrap gap-x-8 gap-y-1"
            style={{ color: '#222' }}
          >
            {pedido.clientes?.telefone && (
              <span>
                <strong style={{ color: cinza, fontWeight: 600 }}>Telefone: </strong>
                {pedido.clientes.telefone}
              </span>
            )}
            {endStr && (
              <span>
                <strong style={{ color: cinza, fontWeight: 600 }}>Entrega: </strong>
                {endStr}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Itens */}
      <table
        className="mb-5 w-full"
        style={{ borderCollapse: 'collapse' }}
      >
        <thead>
          <tr>
            <th style={{ ...thBase, textAlign: 'left', width: '36px' }}>#</th>
            <th style={{ ...thBase, textAlign: 'left' }}>Produto</th>
            <th style={{ ...thBase, textAlign: 'center' }}>Unid.</th>
            <th style={{ ...thBase, textAlign: 'center' }}>Qtde</th>
            <th style={{ ...thBase, textAlign: 'right' }}>Preço un.</th>
            <th style={{ ...thBase, textAlign: 'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {pedido.pedido_itens.map((item, i) => (
            <tr key={i}>
              <td style={{ ...tdBase, color: cinza }}>{i + 1}</td>
              <td style={{ ...tdBase, fontWeight: 600 }}>{item.produtos.nome}</td>
              <td style={{ ...tdBase, textAlign: 'center', textTransform: 'uppercase' }}>
                {item.produtos.embalagem}
              </td>
              <td style={{ ...tdBase, textAlign: 'center' }}>
                {item.quantidade_pedida}
              </td>
              <td style={{ ...tdBase, textAlign: 'right' }}>
                {formatarReal(item.preco_unitario)}
              </td>
              <td style={{ ...tdBase, textAlign: 'right', fontWeight: 600 }}>
                {formatarReal(item.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Rodapé: pagamento + total */}
      <div className="mb-8 flex items-start justify-between gap-6">
        <div style={{ color: '#222' }}>
          <p>
            <strong style={{ color: cinza, fontWeight: 600 }}>Pagamento: </strong>
            {rotuloPagamento(pedido.forma_pagamento)} ({prazoFmt})
          </p>
          <p style={{ marginTop: '2px' }}>
            <strong style={{ color: cinza, fontWeight: 600 }}>Itens: </strong>
            {totalItens} {totalItens === 1 ? 'unidade' : 'unidades'}
          </p>
          {pedido.observacoes && (
            <p style={{ marginTop: '6px', maxWidth: '90mm' }}>
              <strong style={{ color: cinza, fontWeight: 600 }}>Obs.: </strong>
              {pedido.observacoes}
            </p>
          )}
        </div>
        <div
          className="text-right"
          style={{
            border: '1px solid #111',
            borderRadius: '4px',
            padding: '10px 16px',
            minWidth: '64mm',
          }}
        >
          <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: cinza, fontWeight: 700 }}>
            Total do pedido
          </p>
          <p style={{ fontSize: '22px', fontWeight: 800, marginTop: '2px' }}>
            {formatarReal(pedido.total)}
          </p>
        </div>
      </div>

      {/* Assinaturas */}
      <div className="mt-10 flex justify-between" style={{ gap: '8mm' }}>
        <div className="w-5/12 text-center">
          <div style={{ borderTop: '1px solid #111', paddingTop: '6px', marginTop: '24px', color: cinza }}>
            Assinatura do entregador
          </div>
        </div>
        <div className="w-5/12 text-center">
          <div style={{ borderTop: '1px solid #111', paddingTop: '6px', marginTop: '24px', color: cinza }}>
            Assinatura do cliente
          </div>
        </div>
      </div>
    </div>
  )
}
