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
  // 'status': entrou por alerta/critico/ruptura do proprio produto.
  // 'piso': saldo ok pelo minimo dele, mas abaixo do piso de seguranca de 12.
  // 'giro': saldo nao cobre 2 semanas do ritmo real de venda.
  motivo: 'status' | 'piso' | 'giro'
  // Unidades vendidas por semana (media dos ultimos 28 dias).
  giro_semanal: number
}

// Uma forma de venda cadastrada do produto (Unidade, Fardo 12, Caixa 24...).
// Vem de produto_embalagens; 'unidades' diz quantas unidades base consome.
export interface FormaVenda {
  id: string
  nome: string
  unidades: number
  preco: number
  padrao: boolean
}

export interface ItemPedido {
  produto_id: string
  nome: string
  categoria: string
  // Preço por unidade base e quantidade em unidades base — sempre a fonte
  // de verdade enviada pro backend, seja qual for a forma escolhida.
  preco_unitario: number
  quantidade: number
  total: number
  saldo_atual: number
  // Formas de venda cadastradas do produto. A escolhida (formaId) dirige
  // quantidade/preco_unitario/total: quantidade = qtdFormas * unidades,
  // total = qtdFormas * precoForma. precoForma parte do preco cadastrado
  // mas o operador pode ajustar na hora (negociacao de balcao).
  formas: FormaVenda[]
  formaId: string
  qtdFormas: number
  precoForma: number
}

export interface ResumoFinanceiro {
  totalReceber: number
  totalRecebido: number
  totalPagar: number
  totalPago: number
  inadimplente: number
  lucroEstimado: number
}
