// Rótulos e fluxo de status do pedido. Fonte única para listagem, detalhe e comanda.
// Apenas leitura/apresentação — não toca na lógica de negócio das actions.

import type { StatusPillTipo } from '@/components/ui-kit/StatusPill'

export type StatusPedido =
  | 'rascunho'
  | 'confirmado'
  | 'em_separacao'
  | 'saiu_entrega'
  | 'entregue'
  | 'parcial'
  | 'cancelado'

// Rótulo legível por status do pedido.
export const ROTULO_STATUS_PEDIDO: Record<string, string> = {
  rascunho: 'Rascunho',
  confirmado: 'Confirmado',
  em_separacao: 'Em separação',
  saiu_entrega: 'Saiu para entrega',
  entregue: 'Entregue',
  parcial: 'Parcial',
  cancelado: 'Cancelado',
}

// Mapeia o status do pedido para o tipo aceito pela StatusPill (cor + ponto).
export const STATUS_PEDIDO_PILL: Record<string, StatusPillTipo> = {
  rascunho: 'inativo',
  confirmado: 'aberto',
  em_separacao: 'parcial',
  saiu_entrega: 'aberto',
  entregue: 'ok',
  parcial: 'parcial',
  cancelado: 'cancelado',
}

// Próximo passo do fluxo operacional (confirmado -> separação -> entrega -> entregue).
const PROXIMO: Record<string, StatusPedido | undefined> = {
  confirmado: 'em_separacao',
  em_separacao: 'saiu_entrega',
  saiu_entrega: 'entregue',
}

export function proximoStatus(status: string): StatusPedido | undefined {
  return PROXIMO[status]
}

// Rótulos das formas de pagamento.
export const ROTULO_PAGAMENTO: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  fiado: 'Fiado',
  cartao_debito: 'Cartão débito',
  cartao_credito: 'Cartão crédito',
  boleto: 'Boleto',
}

export function rotuloPagamento(forma: string | null | undefined): string {
  if (!forma) return 'N/A'
  return ROTULO_PAGAMENTO[forma] ?? forma
}

export function rotuloStatusPedido(status: string | null | undefined): string {
  if (!status) return 'N/A'
  return ROTULO_STATUS_PEDIDO[status] ?? status
}
