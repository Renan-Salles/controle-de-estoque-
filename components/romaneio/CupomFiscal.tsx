import { formatarReal, formatarData } from '@/lib/formatos'
import { rotuloPagamento, rotuloFulfillment } from '@/lib/pedido-labels'

export interface CupomData {
  numero_pedido: number
  data_pedido: string
  total: number
  subtotal?: number | null
  desconto_total?: number | null
  frete?: number | null
  valor_recebido?: number | null
  valor_pago_agora?: number | null
  forma_pagamento_parcial?: string | null
  forma_pagamento: string
  prazo_pagamento_dias?: number | null
  observacoes?: string | null
  locais: {
    nome: string
    cnpj?: string | null
    telefone?: string | null
    endereco_rua?: string | null
    endereco_numero?: string | null
    endereco_bairro?: string | null
    endereco_cidade?: string | null
  } | null
  clientes: {
    nome: string
    telefone: string | null
    endereco: Record<string, string> | null
  } | null
  tipo_fulfillment?: string | null
  entregador?: { nome: string } | null
  pedido_itens: Array<{
    quantidade_pedida: number
    preco_unitario: number
    total: number
    embalagem_nome?: string | null
    embalagem_unidades?: number | null
    produtos: { nome: string; embalagem: string }
  }>
}

function Divisor({ tipo = 'dash' }: { tipo?: 'dash' | 'solid' }) {
  return (
    <div
      style={{
        borderTop: tipo === 'dash' ? '1px dashed #555' : '1px solid #111',
        margin: '6px 0',
      }}
    />
  )
}

export function CupomFiscal({ data }: { data: CupomData }) {
  const end = data.clientes?.endereco ?? null
  const rua = [end?.rua, end?.numero].filter(Boolean).join(', ')
  const complemento = [end?.bairro, end?.cidade].filter(Boolean).join(' - ')

  const prazo = data.prazo_pagamento_dias && data.prazo_pagamento_dias > 0
    ? `${data.prazo_pagamento_dias} dias`
    : 'À vista'

  const totalItens = data.pedido_itens.reduce((a, i) => a + i.quantidade_pedida, 0)

  return (
    <div
      className="cupom-fiscal"
      style={{
        fontFamily: "Consolas, 'Lucida Console', 'Courier New', monospace",
        fontSize: '11px',
        lineHeight: '1.5',
        color: '#111',
        background: '#fff',
        width: '72mm',
        margin: '0 auto',
        padding: '12px 10px',
        boxSizing: 'border-box',
      }}
    >
      {/* Cabeçalho */}
      <div style={{ textAlign: 'center', marginBottom: '4px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.5px' }}>
          {data.locais?.nome?.toUpperCase() ?? 'R$ DEPÓSITO'}
        </div>
        {data.locais?.cnpj && (
          <div style={{ fontSize: '10px', marginTop: '2px' }}>
            CNPJ: {data.locais.cnpj}
          </div>
        )}
        {data.locais?.telefone && (
          <div style={{ fontSize: '10px' }}>Tel: {data.locais.telefone}</div>
        )}
        {(data.locais?.endereco_rua) && (
          <div style={{ fontSize: '10px' }}>
            {[data.locais.endereco_rua, data.locais.endereco_numero].filter(Boolean).join(', ')}
            {(data.locais.endereco_bairro || data.locais.endereco_cidade) && (
              ` - ${[data.locais.endereco_bairro, data.locais.endereco_cidade].filter(Boolean).join('/')}`
            )}
          </div>
        )}
        <div style={{ fontSize: '10px' }}>DEPÓSITO DE BEBIDAS</div>
      </div>

      <Divisor tipo="solid" />

      {/* Número e data */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
        <span>CUPOM Nº <strong>{String(data.numero_pedido).padStart(4, '0')}</strong></span>
        <span>{formatarData(data.data_pedido)}</span>
      </div>

      <Divisor />

      {/* Cliente */}
      {data.clientes ? (
        <div style={{ fontSize: '10px' }}>
          <div style={{ fontWeight: 700, marginBottom: '2px' }}>CLIENTE</div>
          <div>{data.clientes.nome}</div>
          {data.clientes.telefone && (
            <div>Tel: {data.clientes.telefone}</div>
          )}
          {rua && <div>End: {rua}</div>}
          {complemento && (
            <div style={{ paddingLeft: '29px' }}>{complemento}</div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: '10px', fontStyle: 'italic' }}>
          Consumidor não identificado
        </div>
      )}

      {data.tipo_fulfillment && (
        <div style={{ fontSize: '10px', marginTop: '4px' }}>
          <span>Tipo: {rotuloFulfillment(data.tipo_fulfillment)}</span>
          {data.entregador?.nome && (
            <div>Entregador: {data.entregador.nome}</div>
          )}
        </div>
      )}

      <Divisor />

      {/* Cabeçalho dos itens */}
      <div style={{ display: 'flex', fontSize: '10px', fontWeight: 700 }}>
        <span style={{ width: '28px' }}>QTD</span>
        <span style={{ flex: 1 }}>PRODUTO</span>
        <span style={{ width: '60px', textAlign: 'right' }}>TOTAL</span>
      </div>
      <Divisor />

      {/* Itens */}
      {data.pedido_itens.map((item, i) => {
        const nome = item.produtos.nome
        const nomeCorto = nome.length > 18 ? nome.slice(0, 17) + '…' : nome
        return (
          <div key={i}>
            <div style={{ display: 'flex', fontSize: '11px' }}>
              <span style={{ width: '28px' }}>
                {String(item.quantidade_pedida).padStart(2, ' ')}
              </span>
              <span style={{ flex: 1 }}>{nomeCorto}</span>
              <span style={{ width: '60px', textAlign: 'right' }}>
                {formatarReal(item.total)}
              </span>
            </div>
            <div style={{ paddingLeft: '28px', fontSize: '10px', color: '#555' }}>
              {item.embalagem_nome && (item.embalagem_unidades ?? 1) > 1
                ? `${item.quantidade_pedida / (item.embalagem_unidades ?? 1)} ${item.embalagem_nome} (${item.quantidade_pedida} un)`
                : `${item.quantidade_pedida} un x ${formatarReal(item.preco_unitario)}`}
            </div>
          </div>
        )
      })}

      <Divisor />

      {/* Totais */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
        <span>Itens: {totalItens}</span>
        <span style={{ fontSize: '10px', color: '#555' }}>
          {data.pedido_itens.length} produto{data.pedido_itens.length !== 1 ? 's' : ''}
        </span>
      </div>
      {(Number(data.desconto_total ?? 0) > 0 || Number(data.frete ?? 0) > 0) && (
        <div style={{ fontSize: '10px', color: '#444', marginTop: '2px' }}>
          {Number(data.frete ?? 0) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Frete</span>
              <span>{formatarReal(Number(data.frete))}</span>
            </div>
          )}
          {Number(data.desconto_total ?? 0) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Desconto</span>
              <span>-{formatarReal(Number(data.desconto_total))}</span>
            </div>
          )}
        </div>
      )}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '14px',
          fontWeight: 700,
          marginTop: '4px',
        }}
      >
        <span>TOTAL</span>
        <span>{formatarReal(data.total)}</span>
      </div>
      {data.valor_recebido != null && Number(data.valor_recebido) > 0 && (
        <div style={{ fontSize: '10px', color: '#444', marginTop: '2px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Recebido</span>
            <span>{formatarReal(Number(data.valor_recebido))}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
            <span>Troco</span>
            <span>{formatarReal(Number(data.valor_recebido) - data.total)}</span>
          </div>
        </div>
      )}

      <Divisor />

      {/* Pagamento */}
      <div style={{ fontSize: '10px' }}>
        {data.forma_pagamento === 'fiado' && Number(data.valor_pago_agora ?? 0) > 0 ? (
          <>
            <div>
              Pago agora: {formatarReal(Number(data.valor_pago_agora))} (
              {rotuloPagamento(data.forma_pagamento_parcial ?? '')})
            </div>
            <div>
              Fiado: {formatarReal(data.total - Number(data.valor_pago_agora))} ({prazo})
            </div>
          </>
        ) : (
          <div>PGTO: {rotuloPagamento(data.forma_pagamento)} ({prazo})</div>
        )}
        {data.observacoes && (
          <div style={{ marginTop: '4px', color: '#444' }}>OBS: {data.observacoes}</div>
        )}
      </div>

      <Divisor tipo="solid" />

      {/* Rodapé */}
      <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '4px' }}>
        <div>Obrigado pela preferência!</div>
        <div style={{ marginTop: '2px', color: '#555' }}>
          Este cupom é seu comprovante de compra
        </div>
      </div>
    </div>
  )
}
