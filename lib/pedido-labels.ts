// Rótulos do pedido/venda. Fonte única para listagem e detalhe.
// Status só concluída ou cancelada; o estoque sai na hora mesmo se for fiado.
// Fiado vira uma linha em contas_receber, controlada à parte (lib/actions/financeiro.ts).

import type { StatusPillTipo } from '@/components/ui-kit/StatusPill'

export type StatusPedido = 'concluida' | 'cancelada'

export const ROTULO_STATUS_PEDIDO: Record<string, string> = {
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

// Mapeia o status para o tipo aceito pela StatusPill (cor + ponto).
export const STATUS_PEDIDO_PILL: Record<string, StatusPillTipo> = {
  concluida: 'ok',
  cancelada: 'cancelado',
}

// Rótulos das formas de pagamento (inclui fiado, com prazo a receber).
export const ROTULO_PAGAMENTO: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao_debito: 'Cartão débito',
  cartao_credito: 'Cartão crédito',
  fiado: 'Fiado',
}

export function rotuloPagamento(forma: string | null | undefined): string {
  if (!forma) return 'N/A'
  return ROTULO_PAGAMENTO[forma] ?? forma
}

export function rotuloStatusPedido(status: string | null | undefined): string {
  if (!status) return 'N/A'
  return ROTULO_STATUS_PEDIDO[status] ?? status
}
