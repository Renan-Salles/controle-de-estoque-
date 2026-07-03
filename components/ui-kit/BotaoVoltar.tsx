'use client'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

// Volta pra tela anterior de verdade (historico do navegador), nao um link
// fixo -- pedido pode ter sido aberto tanto por Movimentacoes quanto por
// Pedidos, um href fixo erraria a metade das vezes.
export function BotaoVoltar({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back()
        else router.push(fallbackHref)
      }}
      className="u-motion mb-3 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text"
    >
      <ArrowLeft className="size-4" strokeWidth={1.5} />
      Voltar
    </button>
  )
}
