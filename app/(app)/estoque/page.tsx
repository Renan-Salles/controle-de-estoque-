'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { buscarPosicaoEstoque, darEntrada } from '@/lib/actions/estoque'
import type { PosicaoEstoque } from '@/types'

const statusBadge: Record<string, 'default' | 'secondary' | 'destructive'> = {
  ok: 'default',
  alerta: 'secondary',
  critico: 'destructive',
  ruptura: 'destructive',
}

export default function EstoquePage() {
  const [estoque, setEstoque] = useState<PosicaoEstoque[]>([])
  const [filtro, setFiltro] = useState<'todos' | 'critico' | 'ruptura'>('todos')
  const [loading, setLoading] = useState(true)
  const [produtoSelecionado, setProdutoSelecionado] = useState<PosicaoEstoque | null>(null)
  const [quantidade, setQuantidade] = useState('')
  const [custo, setCusto] = useState('')
  const [saving, setSaving] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  async function carregar(f = filtro) {
    setLoading(true)
    const dados = await buscarPosicaoEstoque(f)
    setEstoque(dados as PosicaoEstoque[])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  async function handleEntrada() {
    if (!produtoSelecionado || !quantidade) return
    setSaving(true)
    const resultado = await darEntrada({
      produto_id: produtoSelecionado.id,
      quantidade: Number(quantidade),
      custo_unitario: Number(custo),
    })
    setSaving(false)
    if (resultado.error) { toast.error(resultado.error); return }
    toast.success('Entrada registrada')
    setSheetOpen(false)
    setQuantidade('')
    setCusto('')
    carregar()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Estoque</h1>
        <div className="flex gap-2">
          {(['todos', 'critico', 'ruptura'] as const).map(f => (
            <Button key={f} size="sm" variant={filtro === f ? 'default' : 'outline'}
              onClick={() => { setFiltro(f); carregar(f) }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-card border-b border-border">
            <tr>
              <th className="text-left p-3 font-medium">Produto</th>
              <th className="text-left p-3 font-medium">Categoria</th>
              <th className="text-right p-3 font-medium">Saldo</th>
              <th className="text-right p-3 font-medium">Minimo</th>
              <th className="text-right p-3 font-medium">Custo Medio</th>
              <th className="text-right p-3 font-medium">Valor Total</th>
              <th className="text-center p-3 font-medium">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {estoque.map((p) => (
              <tr key={p.id} className="border-b border-border hover:bg-card transition-colors">
                <td className="p-3">
                  <p className="font-medium">{p.nome}</p>
                  {p.marca && <p className="text-xs text-muted-foreground">{p.marca}</p>}
                </td>
                <td className="p-3 text-muted-foreground">{p.categoria}</td>
                <td className="p-3 text-right font-mono">{p.saldo_atual}</td>
                <td className="p-3 text-right font-mono text-muted-foreground">{p.estoque_minimo}</td>
                <td className="p-3 text-right font-mono">R$ {p.custo_medio.toFixed(2)}</td>
                <td className="p-3 text-right font-mono">R$ {p.valor_total.toFixed(2)}</td>
                <td className="p-3 text-center">
                  <Badge variant={statusBadge[p.status_estoque] ?? 'default'}>{p.status_estoque}</Badge>
                </td>
                <td className="p-3">
                  <Sheet open={sheetOpen && produtoSelecionado?.id === p.id}
                    onOpenChange={open => { setSheetOpen(open); if (!open) setProdutoSelecionado(null) }}>
                    <SheetTrigger>
                      <Button size="sm" variant="outline" onClick={() => { setProdutoSelecionado(p); setSheetOpen(true) }}>
                        <Plus size={12} className="mr-1" />Entrada
                      </Button>
                    </SheetTrigger>
                    <SheetContent>
                      <SheetHeader>
                        <SheetTitle>Dar Entrada</SheetTitle>
                      </SheetHeader>
                      <div className="space-y-4 mt-6">
                        <p className="text-sm"><strong>{produtoSelecionado?.nome}</strong></p>
                        <p className="text-sm text-muted-foreground">Saldo atual: {produtoSelecionado?.saldo_atual}</p>
                        <div className="space-y-2">
                          <Label>Quantidade</Label>
                          <Input type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="24" />
                        </div>
                        <div className="space-y-2">
                          <Label>Custo unitario (R$)</Label>
                          <Input type="number" step="0.01" value={custo} onChange={e => setCusto(e.target.value)} placeholder="3.20" />
                        </div>
                        <Button className="w-full bg-[#2B7A78] hover:bg-[#1e5654]" onClick={handleEntrada} disabled={saving}>
                          {saving ? 'Salvando...' : 'Confirmar Entrada'}
                        </Button>
                      </div>
                    </SheetContent>
                  </Sheet>
                </td>
              </tr>
            ))}
            {!loading && !estoque.length && (
              <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Nenhum produto cadastrado</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
