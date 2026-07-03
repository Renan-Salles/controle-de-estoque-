'use client'
import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PlayCircle, StopCircle, Clock } from 'lucide-react'
import { iniciarTurno, encerrarTurno, type TurnoAtivo } from '@/lib/actions/turnos'

// "3" -> "3 min"; "75" -> "1h 15min"
function tempoDecorrido(iniciadoEm: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iniciadoEm).getTime()) / 60000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const resto = min % 60
  return resto > 0 ? `${h}h ${resto}min` : `${h}h`
}

export function TurnoCard({
  turnoInicial,
  tempoMedioMin,
}: {
  turnoInicial: TurnoAtivo | null
  tempoMedioMin: number | null
}) {
  const router = useRouter()
  const [turno, setTurno] = useState(turnoInicial)
  const [, setTick] = useState(0)
  const [pendente, startTransition] = useTransition()

  // Re-renderiza a cada 30s so pra atualizar o "ha Xh Ymin" (o calculo em si
  // usa Date.now() direto, isso so forca o componente a recalcular).
  useEffect(() => {
    if (!turno) return
    const id = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(id)
  }, [turno])

  function alternar() {
    startTransition(async () => {
      if (turno) {
        const r = await encerrarTurno()
        if (r.error) {
          toast.error(r.error)
          return
        }
        setTurno(null)
        toast.success('Expediente encerrado')
      } else {
        const r = await iniciarTurno()
        if (r.error) {
          toast.error(r.error)
          return
        }
        setTurno({ id: 'novo', iniciado_em: new Date().toISOString() })
        toast.success('Expediente iniciado')
      }
      router.refresh()
    })
  }

  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
      <div className="min-w-0">
        {turno ? (
          <>
            <p className="text-sm font-semibold text-text">
              Em expediente há {tempoDecorrido(turno.iniciado_em)}
            </p>
            {tempoMedioMin != null && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-text-muted">
                <Clock className="size-3" strokeWidth={1.5} />
                Você costuma levar ~{tempoMedioMin} min por entrega
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-text-muted">Fora de expediente</p>
        )}
      </div>
      <button
        type="button"
        onClick={alternar}
        disabled={pendente}
        className={
          turno
            ? 'u-motion inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-err/30 bg-err/10 px-4 text-sm font-semibold text-err disabled:opacity-50'
            : 'u-motion inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50'
        }
      >
        {turno ? (
          <>
            <StopCircle className="size-4" strokeWidth={1.75} />
            Encerrar
          </>
        ) : (
          <>
            <PlayCircle className="size-4" strokeWidth={1.75} />
            Iniciar expediente
          </>
        )}
      </button>
    </div>
  )
}
