'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { btnClass } from '@/components/ui-kit/Button'
import { Campo } from '@/components/ui-kit/FormKit'
import { formatarReal, formatarData } from '@/lib/formatos'
import { ajustarEstoque } from '@/lib/actions/estoque'

type Produto = { produto_id: string; nome: string; saldo_atual: number | null }
type Descarte = {
  id: string
  produto_id: string
  quantidade: number
  custo_unitario: number | null
  observacao: string | null
  created_at: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  produtos: any
}

const MOTIVOS = [
  { value: 'quebra', label: 'Quebra / Dano fisico' },
  { value: 'vencimento', label: 'Produto vencido' },
  { value: 'perda', label: 'Perda' },
  { value: 'cortesia', label: 'Cortesia' },
] as const

export function PerdasClient({ produtos, historico }: { produtos: Produto[]; historico: Descarte[] }) {
  const router = useRouter()
  const [produtoId, setProdutoId] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [motivo, setMotivo] = useState<'quebra' | 'vencimento' | 'perda' | 'cortesia'>('quebra')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (!produtoId || !quantidade) { toast.error('Selecione o produto e a quantidade'); return }
    setSalvando(true)
    const res = await ajustarEstoque({
      produto_id: produtoId,
      tipo: motivo,
      quantidade: Number(quantidade),
    })
    setSalvando(false)
    if (res.error) { toast.error(res.error); return }
    toast.success('Perda registrada')
    router.refresh()
    setProdutoId('')
    setQuantidade('')
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-text">Registrar perda</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo label="Produto" full>
            <Select value={produtoId} onValueChange={(v) => setProdutoId(v ?? '')}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {produtos.map((p) => (
                  <SelectItem key={p.produto_id} value={p.produto_id}>
                    {p.nome} (saldo: {p.saldo_atual ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo label="Quantidade perdida">
            <Input type="number" min="1" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="Ex: 6" />
          </Campo>
          <Campo label="Motivo" full>
            <Select value={motivo} onValueChange={(v) => { if (v) setMotivo(v as typeof motivo) }}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MOTIVOS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Campo>
        </div>
        <div className="mt-3">
          <button type="button" onClick={salvar} disabled={salvando} className={btnClass('primary')}>
            {salvando ? 'Registrando...' : 'Registrar perda'}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-text">Historico de perdas</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2">
              <th className="px-4 py-2.5 text-left font-medium text-text-muted">Produto</th>
              <th className="px-4 py-2.5 text-left font-medium text-text-muted hidden sm:table-cell">Data</th>
              <th className="px-4 py-2.5 text-right font-medium text-text-muted">Qtd</th>
              <th className="px-4 py-2.5 text-right font-medium text-text-muted hidden sm:table-cell">Custo</th>
            </tr>
          </thead>
          <tbody>
            {historico.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-text-muted">Nenhuma perda registrada ainda.</td></tr>
            )}
            {historico.map((d) => {
              const custo = Math.abs(d.quantidade) * (d.custo_unitario ?? 0)
              return (
                <tr key={d.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 text-text">{d.produtos?.nome ?? '-'}</td>
                  <td className="px-4 py-2.5 text-text-muted hidden sm:table-cell">{formatarData(d.created_at)}</td>
                  <td className="px-4 py-2.5 text-right text-err">{Math.abs(d.quantidade)}</td>
                  <td className="px-4 py-2.5 text-right text-text-muted hidden sm:table-cell">{formatarReal(custo)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
