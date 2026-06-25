export type Perfil = 'admin' | 'gerente'
// Venda à vista, sem ciclo de entrega: só concluída ou cancelada.
export type StatusPedido = 'concluida' | 'cancelada'
export type FormaPagamento = 'dinheiro' | 'pix' | 'cartao_debito' | 'cartao_credito'
export type StatusEstoque = 'ok' | 'alerta' | 'critico' | 'ruptura'
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

export interface ItemReposicao extends PosicaoEstoque {
  sugestao_compra: number
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
