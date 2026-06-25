'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

type Modo = 'login' | 'cadastro'

export default function LoginPage() {
  const [modo, setModo] = useState<Modo>('login')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
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

  async function cadastrar() {
    if (loading) return
    setErro(null)
    if (!email.trim() || senha.length < 6) {
      setErro('Informe email e senha com ao menos 6 caracteres.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
    })
    setLoading(false)
    if (error) {
      setErro(error.message)
      return
    }
    setSucesso('Conta criada! Verifique seu email para confirmar e depois faça login.')
    setModo('login')
  }

  function trocar(m: Modo) {
    setModo(m)
    setErro(null)
    setSucesso(null)
  }

  const acao = modo === 'login' ? entrar : cadastrar

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
            Gestão de Bebidas
          </h1>
          <p className="mt-1.5 text-sm text-text-muted">
            <span className="text-accent-gold">R$ Depósito</span> · Império Salles
          </p>
        </div>

        {/* Abas login / cadastro */}
        <div className="mb-4 flex rounded-lg border border-border bg-surface p-1">
          {(['login', 'cadastro'] as Modo[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => trocar(m)}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium u-motion ${
                modo === m
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              {m === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          ))}
        </div>

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
                onKeyDown={(e) => e.key === 'Enter' && acao()}
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
                autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && acao()}
                placeholder="••••••••"
                className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-text placeholder:text-text-muted/60 u-motion outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
              {modo === 'cadastro' && (
                <p className="text-[11px] text-text-muted">Mínimo 6 caracteres.</p>
              )}
            </div>

            {erro && (
              <p className="text-xs text-err" role="alert">{erro}</p>
            )}
            {sucesso && (
              <p className="text-xs text-brand" role="status">{sucesso}</p>
            )}

            <button
              type="button"
              onClick={acao}
              disabled={loading}
              className="mt-1 flex h-10 items-center justify-center gap-2 rounded-md bg-brand text-sm font-medium text-white u-motion active:scale-[0.98] hover:bg-brand-strong disabled:opacity-70 disabled:active:scale-100"
            >
              {loading && <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />}
              {loading
                ? modo === 'login' ? 'Entrando...' : 'Criando...'
                : modo === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-text-muted">
          Estoque, vendas e financeiro dos seus pontos de venda
        </p>
      </div>
    </div>
  )
}
