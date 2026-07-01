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
  // Preço por unidade base e quantidade em unidades base — sempre a fonte
  // de verdade enviada pro backend, mesmo quando a linha foi lançada
  // vendendo a embalagem fechada (ver campos abaixo).
  preco_unitario: number
  quantidade: number
  total: number
  saldo_atual: number
  // Venda por embalagem (caixa/fardo) — opcional, só relevante quando o
  // produto tem fatorConversao > 1. Quando vendaEmbalagem é true, qtdEmbalagens
  // e precoEmbalagem são a entrada do operador; quantidade/preco_unitario/total
  // ficam sincronizados a partir deles.
  embalagem?: string
  fatorConversao?: number
  vendaEmbalagem?: boolean
  qtdEmbalagens?: number
  precoEmbalagem?: number
}

export interface ResumoFinanceiro {
  totalReceber: number
  totalRecebido: number
  totalPagar: number
  totalPago: number
  inadimplente: number
  lucroEstimado: number
}
