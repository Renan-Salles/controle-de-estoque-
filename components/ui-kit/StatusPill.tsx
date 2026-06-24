import { statusInfo, SELO_CLASSE } from '@/lib/status-cor'

// Pill de status pequena com ponto colorido (DESIGN_SPEC).
// Aceita os status semânticos do domínio (union abaixo) e mapeia cor + rótulo.
// Para qualquer outra string, cai no statusInfo() (status do sistema) sem quebrar.

export type StatusPillTipo =
  | 'ok'
  | 'alerta'
  | 'critico'
  | 'ruptura'
  | 'aberto'
  | 'pago'
  | 'vencido'
  | 'parcial'
  | 'cancelado'
  | 'ativo'
  | 'inativo'

type Estilo = { label: string; classe: string; vivo?: boolean }

// classe = texto + fundo tonal. As cores vêm dos tokens semânticos do tema.
const MAPA: Record<StatusPillTipo, Estilo> = {
  ok: { label: 'OK', classe: 'text-ok bg-ok/10' },
  alerta: { label: 'Alerta', classe: 'text-warn bg-warn/10' },
  critico: { label: 'Crítico', classe: 'text-err bg-err/10' },
  ruptura: { label: 'Ruptura', classe: 'text-err bg-err/10' },
  aberto: { label: 'Aberto', classe: 'text-info bg-info/10', vivo: true },
  pago: { label: 'Pago', classe: 'text-ok bg-ok/10' },
  vencido: { label: 'Vencido', classe: 'text-err bg-err/10' },
  parcial: { label: 'Parcial', classe: 'text-warn bg-warn/10' },
  cancelado: { label: 'Cancelado', classe: 'text-text-muted bg-surface-2' },
  ativo: { label: 'Ativo', classe: 'text-ok bg-ok/10' },
  inativo: { label: 'Inativo', classe: 'text-text-muted bg-surface-2' },
}

export function StatusPill({
  status,
  label,
}: {
  status: StatusPillTipo | (string & {}) | null | undefined
  label?: string
}) {
  const conhecido =
    status && (MAPA as Record<string, Estilo>)[status as string]

  // Fallback para status do sistema (Omie/internos) via statusInfo.
  const fallback = !conhecido
    ? (() => {
        const { label: l, token, vivo } = statusInfo(
          (status as string) ?? null,
        )
        return { label: l, classe: SELO_CLASSE[token], vivo }
      })()
    : null

  const e = conhecido ?? fallback!

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${e.classe}`}
    >
      <span
        className={`size-1.5 rounded-full bg-current${e.vivo ? ' u-pulse-dot' : ''}`}
      />
      {label ?? e.label}
    </span>
  )
}
