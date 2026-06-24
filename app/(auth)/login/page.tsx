'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const router = useRouter()

  async function entrar() {
    if (loading) return
    setErro(null)
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    })
    if (error) {
      setErro('Email ou senha incorretos.')
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-4">
      {/* Textura/gradiente teal escuro sutil */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60rem 40rem at 50% -10%, rgba(43,122,120,0.16), transparent 60%), radial-gradient(40rem 30rem at 110% 110%, rgba(43,122,120,0.08), transparent 55%)',
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="mb-7 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-text">
            <span className="text-accent-gold">R$</span> DEPÓSITO
          </h1>
          <p className="mt-1.5 text-sm text-text-muted">
            Acesse o painel de gestão
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-border bg-surface p-6 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)]">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium text-text">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && entrar()}
                placeholder="voce@deposito.com.br"
                className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-text placeholder:text-text-muted/60 u-motion outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="senha" className="text-sm font-medium text-text">
                Senha
              </label>
              <input
                id="senha"
                type="password"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && entrar()}
                placeholder="••••••••"
                className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-text placeholder:text-text-muted/60 u-motion outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
            </div>

            {erro && (
              <p className="text-xs text-err" role="alert">
                {erro}
              </p>
            )}

            <button
              type="button"
              onClick={entrar}
              disabled={loading}
              className="mt-1 flex h-10 items-center justify-center gap-2 rounded-md bg-brand text-sm font-medium text-white u-motion active:scale-[0.98] hover:bg-brand-strong disabled:opacity-70 disabled:active:scale-100"
            >
              {loading && <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />}
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-text-muted">
          R$ Depósito · Sistema de gestão de bebidas
        </p>
      </div>
    </div>
  )
}
