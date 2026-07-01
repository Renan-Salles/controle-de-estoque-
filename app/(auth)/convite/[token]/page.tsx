import { consultarConvite } from '@/lib/actions/convites'
import { ConviteForm } from './ConviteForm'

export default async function ConvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const resultado = await consultarConvite(token)

  if (!resultado.valido) {
    return (
      <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-4">
        <div className="relative w-full max-w-sm rounded-xl border border-border bg-surface p-6 text-center shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)]">
          <h1 className="text-lg font-semibold text-text">Convite inválido</h1>
          <p className="mt-2 text-sm text-text-muted">
            Este convite não é mais válido. Peça um novo convite pra quem te chamou.
          </p>
        </div>
      </div>
    )
  }

  return (
    <ConviteForm
      token={token}
      cargoNome={resultado.cargoNome}
      localNome={resultado.localNome}
    />
  )
}
