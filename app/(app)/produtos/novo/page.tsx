'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { criarProduto, listarCategorias } from '@/lib/actions/produtos'

export default function NovoProdutoPage() {
  const router = useRouter()
  const [categorias, setCategorias] = useState<{id: string; nome: string}[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nome: '', marca: '', categoria_id: '', embalagem: 'unidade',
    volume_ml: '', preco_venda_padrao: '', custo_atual: '0', estoque_minimo: '0', codigo_barras: ''
  })

  useEffect(() => {
    listarCategorias().then(setCategorias)
  }, [])

  const set = (k: string, v: string | null) => setForm(prev => ({ ...prev, [k]: v ?? '' }))

  async function salvar() {
    setSaving(true)
    const resultado = await criarProduto({
      ...form,
      preco_venda_padrao: Number(form.preco_venda_padrao),
      custo_atual: Number(form.custo_atual),
      estoque_minimo: Number(form.estoque_minimo),
      volume_ml: form.volume_ml ? Number(form.volume_ml) : undefined,
    })
    setSaving(false)
    if (resultado.error) { toast.error(resultado.error); return }
    toast.success('Produto cadastrado')
    router.push('/produtos')
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Novo Produto</h1>
      <div className="space-y-4 bg-card border border-border rounded-lg p-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-2">
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Cerveja Brahma 600ml" />
          </div>
          <div className="space-y-2">
            <Label>Marca</Label>
            <Input value={form.marca} onChange={e => set('marca', e.target.value)} placeholder="Brahma" />
          </div>
          <div className="space-y-2">
            <Label>Codigo de barras</Label>
            <Input value={form.codigo_barras} onChange={e => set('codigo_barras', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Categoria *</Label>
            <Select value={form.categoria_id} onValueChange={v => set('categoria_id', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Embalagem</Label>
            <Select value={form.embalagem} onValueChange={v => set('embalagem', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['unidade', 'fardo', 'caixa', 'grade', 'pack'].map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Volume (ml)</Label>
            <Input type="number" value={form.volume_ml} onChange={e => set('volume_ml', e.target.value)} placeholder="600" />
          </div>
          <div className="space-y-2">
            <Label>Preco de venda (R$) *</Label>
            <Input type="number" step="0.01" value={form.preco_venda_padrao} onChange={e => set('preco_venda_padrao', e.target.value)} placeholder="5.50" />
          </div>
          <div className="space-y-2">
            <Label>Custo atual (R$)</Label>
            <Input type="number" step="0.01" value={form.custo_atual} onChange={e => set('custo_atual', e.target.value)} placeholder="3.20" />
          </div>
          <div className="space-y-2">
            <Label>Estoque minimo</Label>
            <Input type="number" value={form.estoque_minimo} onChange={e => set('estoque_minimo', e.target.value)} placeholder="10" />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <Button className="bg-[#2B7A78] hover:bg-[#1e5654]" onClick={salvar} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Produto'}
          </Button>
          <Button variant="outline" onClick={() => router.push('/produtos')}>Cancelar</Button>
        </div>
      </div>
    </div>
  )
}
