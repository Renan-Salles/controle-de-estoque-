'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { mesAtualBrasil } from '@/lib/formatos'

export function MesSeletor() {
  const router = useRouter()
  const sp = useSearchParams()
  const mes = sp.get('mes') ?? mesAtualBrasil()
  return (
    <input
      type="month"
      value={mes}
      className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-brand/50"
      onChange={(e) => router.push('?mes=' + e.target.value)}
    />
  )
}
