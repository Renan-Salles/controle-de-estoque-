// Helpers de formatação pt-BR. Fonte única para dinheiro, datas e números.

const FMT_REAL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const FMT_NUMERO = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 2,
})

const FMT_DATA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
})

const RE_DATA_PURA = /^\d{4}-\d{2}-\d{2}$/

const FMT_DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
})

/** Formata como R$ X.XXX,XX (vírgula decimal, ponto de milhar). */
export function formatarReal(n: number | null | undefined): string {
  return FMT_REAL.format(n ?? 0)
}

/** Formata número genérico em pt-BR (até 2 casas). */
export function formatarNumero(
  n: number | null | undefined,
  casas?: number,
): string {
  if (n == null || Number.isNaN(n)) return '0'
  if (casas != null) {
    return n.toLocaleString('pt-BR', {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas,
    })
  }
  return FMT_NUMERO.format(n)
}

/** Formata data como DD/MM/AAAA. Aceita Date, ISO string ou timestamp. */
export function formatarData(
  d: Date | string | number | null | undefined,
): string {
  if (d == null || d === '') return ''
  // Data pura (YYYY-MM-DD, sem hora, ex. data_vencimento/data_emissao): o
  // Date nativo interpreta como meia-noite UTC, que formatada em
  // America/Sao_Paulo (UTC-3) vira o dia anterior. Ancora ao meio-dia pra
  // ficar imune ao fuso -- so timestamp de verdade (com hora) usa o valor
  // como veio, convertido certo pro fuso do negocio.
  const data =
    typeof d === 'string' && RE_DATA_PURA.test(d)
      ? new Date(`${d}T12:00:00`)
      : d instanceof Date
        ? d
        : new Date(d)
  if (Number.isNaN(data.getTime())) return ''
  return FMT_DATA.format(data)
}

/**
 * Formata data+hora como DD/MM/AAAA HH:MM, sempre timestamp de verdade
 * (nunca data pura) -- usado pra momentos como "saiu para entrega" e
 * "confirmado em", nao pra datas de vencimento/emissao (essas usam
 * formatarData). timeZone explicito: sem isso, servidor (UTC) e
 * navegador (Brasil) formatam hora diferente pro mesmo instante e o
 * React acusa mismatch de hidratacao.
 */
export function formatarDataHora(
  d: Date | string | number | null | undefined,
): string {
  if (d == null || d === '') return ''
  const data = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(data.getTime())) return ''
  return FMT_DATA_HORA.format(data)
}

// new Date().toISOString() usa UTC. Servidor (Vercel) roda em UTC, mas o
// negocio e no fuso de Brasilia (UTC-3): das 21h as 23h59 no Brasil, UTC ja
// virou o dia seguinte. "Hoje"/"mes atual" calculado com toISOString() fica
// adiantado nesse intervalo -- exatamente o horario de pico do balcao.
// hojeBrasil()/mesAtualBrasil() sao a fonte unica de "que dia e hoje" pro
// servidor; nunca usar new Date().toISOString().split('T')[0] direto.

/** Data de "hoje" (YYYY-MM-DD) no fuso de Brasilia, nao UTC do servidor. */
export function hojeBrasil(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

/** Mes atual (YYYY-MM) no fuso de Brasilia. */
export function mesAtualBrasil(): string {
  return hojeBrasil().slice(0, 7)
}

/** Soma dias a uma data (YYYY-MM-DD) e devolve YYYY-MM-DD. */
export function addDias(dataISO: string, dias: number): string {
  const d = new Date(`${dataISO}T00:00:00`)
  d.setDate(d.getDate() + dias)
  return d.toISOString().split('T')[0]
}
