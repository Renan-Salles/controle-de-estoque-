'use client'
import { Printer } from 'lucide-react'
import { btnClass } from '@/components/ui-kit/Button'

// Imprime a pagina atual. Sidebar/Topbar tem print:hidden, entao sai so o
// conteudo -- vira o "extrato impresso" sem template dedicado.
export function BotaoImprimir() {
  return (
    <button type="button" onClick={() => window.print()} className={btnClass('outline')}>
      <Printer className="size-4" strokeWidth={1.5} />
      Imprimir extrato
    </button>
  )
}
