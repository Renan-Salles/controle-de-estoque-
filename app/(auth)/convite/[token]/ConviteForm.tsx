'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { resgatarConvite } from '@/lib/actions/convites'

export function ConviteForm({
  token,
  cargoNome,
  localNome,
}: {
  token: string
  cargoNome: string
  localNome: string
}) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const router = useRouter()

  async function criarConta() {
    if (loading) return
    setErro(null)
    if (!nome.trim() || !email.trim() || senha.length < 6) {
      setErro('Preencha nome, email e uma senha com ao menos 6 caracteres.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
    })
    if (error) {
      setLoading(false)
      setErro(error.message)
      return
    }
    if (!data.session) {
      setLoading(false)
      setErro('Não foi possível criar a sessão. Confirme o email e faça login depois.')
      return
    }
    const resultado = await resgatarConvite(token, nome.trim())
    setLoading(false)
    if ('error' in resultado) {
      setErro(resultado.error)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60rem 40rem at 50% -10%, rgba(14,154,167,0.16), transparent 60%), radial-gradient(38rem 28rem at 108% 108%, rgba(200,148,26,0.08), transparent 55%)',
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-7 text-center">
          <h1 className="font-display text-2xl font-bold tracking-tight text-text">
            DepSys
          </h1>
          <p className="mt-1.5 text-sm text-text-muted">
            Convite para {localNome} · {cargoNome}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)]">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="nome" className="text-sm font-medium text-text">
                Nome
              </label>
              <input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
                className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-text placeholder:text-text-muted/60 u-motion outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
            </div>

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
                onKeyDown={(e) => e.key === 'Enter' && criarConta()}
                placeholder="voce@email.com"
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
                autoComplete="new-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && criarConta()}
                placeholder="••••••••"
                className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-text placeholder:text-text-muted/60 u-motion outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
              <p className="text-[11px] text-text-muted">Mínimo 6 caracteres.</p>
            </div>

            {erro && (
              <p className="text-xs text-err" role="alert">
                {erro}
              </p>
            )}

            <button
              type="button"
              onClick={criarConta}
              disabled={loading}
              className="mt-1 flex h-10 items-center justify-center gap-2 rounded-md bg-brand text-sm font-medium text-white u-motion active:scale-[0.98] hover:bg-brand-strong disabled:opacity-70 disabled:active:scale-100"
            >
              {loading && <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />}
              {loading ? 'Criando...' : 'Criar minha conta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
