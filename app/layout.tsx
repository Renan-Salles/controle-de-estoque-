import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const sans = Plus_Jakarta_Sans({
  variable: '--font-sans-src',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

const mono = JetBrains_Mono({
  variable: '--font-mono-src',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  title: 'R$ DEPÓSITO · Sistema',
  description: 'Controle de estoque e gestão financeira de depósito de bebidas',
}

export const viewport: Viewport = {
  themeColor: '#2eb5c3',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${sans.variable} ${mono.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        {/* Aplica o tema salvo antes do render, evitando flash claro->escuro.
            Padrao: claro (so vira escuro se o usuario tiver escolhido). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('tema')==='dark')document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  )
}
