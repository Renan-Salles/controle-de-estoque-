'use client'
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import { Copy, QrCode } from 'lucide-react'
import { gerarPayloadPix } from '@/lib/pix'
import { formatarReal } from '@/lib/formatos'

// QR Pix estatico com valor, gerado 100% no client (chave do deposito +
// payload EMV proprio). Cliente aponta a camera OU usa o copia-e-cola.
export function QrPix({
  chave,
  valor,
  nome,
  cidade,
}: {
  chave: string
  valor: number
  nome: string
  cidade: string
}) {
  const [aberto, setAberto] = useState(false)
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const payload = gerarPayloadPix({ chave, valor, nome, cidade })

  useEffect(() => {
    if (!aberto) return
    QRCode.toDataURL(payload, { width: 280, margin: 2 })
      .then(setDataUrl)
      .catch(() => toast.error('Não foi possível gerar o QR Code'))
  }, [aberto, payload])

  async function copiar() {
    try {
      await navigator.clipboard.writeText(payload)
      toast.success('Código Pix copiado')
    } catch {
      toast.error('Não foi possível copiar')
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-brand-strong"
      >
        <QrCode className="size-4" strokeWidth={1.75} />
        QR Code Pix ({formatarReal(valor)})
      </button>
    )
  }

  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-xl border border-border bg-surface p-4">
      <p className="text-sm font-semibold text-text">
        Pix de {formatarReal(valor)}
      </p>
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt="QR Code Pix" className="rounded-lg bg-white p-1" />
      ) : (
        <div className="flex h-[280px] w-[280px] items-center justify-center text-sm text-text-muted">
          Gerando...
        </div>
      )}
      <button
        type="button"
        onClick={copiar}
        className="u-motion flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border text-sm font-medium text-text hover:border-brand/50 hover:text-brand"
      >
        <Copy className="size-4" strokeWidth={1.5} />
        Copiar código (copia e cola)
      </button>
      <p className="text-center text-[11px] leading-relaxed text-text-muted">
        Confira o recebimento no app do seu banco antes de liberar o cliente.
      </p>
    </div>
  )
}
