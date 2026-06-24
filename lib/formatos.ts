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
  const data = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(data.getTime())) return ''
  return FMT_DATA.format(data)
}
