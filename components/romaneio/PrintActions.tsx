'use client'
import { Printer, FileDown, X } from 'lucide-react'

export function PrintActions({ numeroPedido }: { numeroPedido: number }) {
  function imprimir() {
    window.print()
  }

  function baixarPdf() {
    const original = document.title
    document.title = `Cupom-${String(numeroPedido).padStart(4, '0')}`
    window.print()
    setTimeout(() => { document.title = original }, 1000)
  }

  function fechar() {
    window.close()
  }

  return (
    <div
      className="no-print fixed bottom-0 left-0 right-0 flex items-center justify-center gap-3 border-t border-gray-200 bg-white px-6 py-4"
      style={{ zIndex: 100 }}
    >
      <button
        onClick={imprimir}
        className="flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-700"
      >
        <Printer className="size-4" />
        Imprimir
      </button>
      <button
        onClick={baixarPdf}
        className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
      >
        <FileDown className="size-4" />
        Baixar PDF
      </button>
      <button
        onClick={fechar}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50"
      >
        <X className="size-4" />
        Fechar
      </button>
    </div>
  )
}
