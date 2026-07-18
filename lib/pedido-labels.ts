// Rótulos do pedido/venda. Fonte única para listagem e detalhe.
// Status só concluída ou cancelada; o estoque sai na hora mesmo se for fiado.
// Fiado vira uma linha em contas_receber, controlada à parte (lib/actions/financeiro.ts).

import type { StatusPillTipo } from '@/components/ui-kit/StatusPill'
import { hojeBrasil } from '@/lib/formatos'

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

export const ROTULO_FULFILLMENT: Record<string, string> = {
  balcao: 'Balcão',
  entrega: 'Entrega',
  retirada: 'Retirada',
}

export function rotuloFulfillment(tipo: string | null | undefined): string {
  if (!tipo) return 'N/A'
  return ROTULO_FULFILLMENT[tipo] ?? tipo
}

// Badge de status pra listagem/detalhe. null quando é balcão (não se aplica).
export function badgeFulfillment(
  tipo: string,
  concluidoEm: string | null,
): { label: string; status: 'aberto' | 'ok' } | null {
  if (tipo === 'balcao') return null
  if (concluidoEm) {
    return { label: tipo === 'entrega' ? 'Entregue' : 'Retirado', status: 'ok' }
  }
  return { label: tipo === 'entrega' ? 'Aguardando entrega' : 'Aguardando retirada', status: 'aberto' }
}

// "23 min" ou "1h 12min". "—" se faltar saiu_entrega_em ou concluido_em --
// so faz sentido pra tipo_fulfillment='entrega' (retirada nao tem trajeto).
export function formatarDuracaoEntrega(
  saiuEntregaEm: string | null | undefined,
  concluidoEm: string | null | undefined,
): string {
  if (!saiuEntregaEm || !concluidoEm) return '—'
  const ms = new Date(concluidoEm).getTime() - new Date(saiuEntregaEm).getTime()
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const min = Math.round(ms / 60000)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const resto = min % 60
  return resto > 0 ? `${h}h ${resto}min` : `${h}h`
}

// So edita venda concluida HOJE, com o caixa do dia ainda aberto. Depois
// disso so cancelar (BotaoCancelar). Entregue/retirado tambem pode editar
// (ex.: cliente pediu mais um item depois que ja recebeu a entrega) --
// so o dia+caixa importam, nao o status de entrega.
export function podeEditarPedido(
  p: {
    status: string
    data_pedido: string
  },
  caixaFechado: boolean,
): boolean {
  const hoje = hojeBrasil()
  return (
    p.status === 'concluida' &&
    p.data_pedido.startsWith(hoje) &&
    !caixaFechado
  )
}

export type LinhaPagamento = {
  forma_pagamento: string
  total: number
  forma_pagamento_secundaria: string | null
  valor_secundario: number | null
}

// Distribui o total de cada pedido entre as formas informadas. Uma venda
// dividida entra com uma fatia em cada forma das duas pernas; a perna
// fiado nunca soma em dinheiro/pix/cartao_* (nao e dinheiro em caixa).
export function somarPorForma(
  rows: LinhaPagamento[],
  formas: readonly string[],
): { forma: string; valor: number; quantidade: number }[] {
  return formas.map((f) => {
    const principal = rows.filter(
      (r) => r.forma_pagamento === f && r.forma_pagamento_secundaria !== f,
    )
    const secundaria = rows.filter((r) => r.forma_pagamento_secundaria === f)
    const valor =
      principal.reduce((a, r) => {
        const valorPrincipal =
          r.forma_pagamento_secundaria != null
            ? r.total - (r.valor_secundario ?? 0)
            : r.total
        return a + valorPrincipal
      }, 0) + secundaria.reduce((a, r) => a + (r.valor_secundario ?? 0), 0)
    return { forma: f, valor, quantidade: principal.length + secundaria.length }
  })
}

// Rotulo combinado pra exibicao (cupom, detalhe do pedido): "Dinheiro" se
// nao ha split, "Dinheiro + Pix" se ha.
export function rotuloPagamentoVenda(venda: {
  forma_pagamento: string
  forma_pagamento_secundaria: string | null
}): string {
  if (!venda.forma_pagamento_secundaria) return rotuloPagamento(venda.forma_pagamento)
  return `${rotuloPagamento(venda.forma_pagamento)} + ${rotuloPagamento(venda.forma_pagamento_secundaria)}`
}
