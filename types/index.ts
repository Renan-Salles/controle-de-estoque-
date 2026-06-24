export type Perfil = 'admin' | 'gerente'
export type StatusPedido = 'rascunho' | 'confirmado' | 'em_separacao' | 'saiu_entrega' | 'entregue' | 'parcial' | 'cancelado'
export type FormaPagamento = 'dinheiro' | 'pix' | 'fiado' | 'cartao_debito' | 'cartao_credito' | 'boleto'
export type StatusEstoque = 'ok' | 'alerta' | 'critico' | 'ruptura'
export type StatusCR = 'aberto' | 'pago' | 'parcial' | 'vencido' | 'cancelado'
export type ClasseABC = 'A' | 'B' | 'C'

export interface PosicaoEstoque {
  id: string
  nome: string
  marca: string | null
  categoria: string
  embalagem: string
  volume_ml: number | null
  saldo_atual: number
  estoque_minimo: number
  custo_medio: number
  valor_total: number
  status_estoque: StatusEstoque
  preco_venda_padrao: number
}

export interface ItemPedido {
  produto_id: string
  nome: string
  categoria: string
  preco_unitario: number
  quantidade: number
  total: number
  saldo_atual: number
}

export interface ResumoFinanceiro {
  totalReceber: number
  totalRecebido: number
  totalPagar: number
  totalPago: number
  inadimplente: number
  lucroEstimado: number
}
