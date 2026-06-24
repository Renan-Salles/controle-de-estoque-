import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'R$ DEPOSITO — Sistema',
  description: 'Controle de estoque e gestao financeira',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-background text-foreground antialiased min-h-screen">{children}</body>
    </html>
  )
}
