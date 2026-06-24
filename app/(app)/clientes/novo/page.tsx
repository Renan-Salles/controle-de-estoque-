'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { criarCliente } from '@/lib/actions/clientes'

export default function NovoClientePage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nome: '', tipo: 'bar', telefone: '', whatsapp: '', cpf_cnpj: '',
    endereco_rua: '', endereco_numero: '', endereco_bairro: '', endereco_cidade: '',
    forma_pagamento_padrao: 'dinheiro', prazo_pagamento_dias: '0', limite_credito: '0', observacoes: ''
  })

  const set = (k: string, v: string | null) => setForm(prev => ({ ...prev, [k]: v ?? '' }))

  async function salvar() {
    setSaving(true)
    const resultado = await criarCliente({
      ...form,
      prazo_pagamento_dias: Number(form.prazo_pagamento_dias),
      limite_credito: Number(form.limite_credito),
    })
    setSaving(false)
    if (resultado.error) { toast.error(resultado.error); return }
    toast.success('Cliente cadastrado')
    router.push('/clientes')
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Novo Cliente</h1>
      <div className="space-y-4 bg-card border border-border rounded-lg p-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-2">
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Bar do Ze" />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={v => set('tipo', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Bar</SelectItem>
                <SelectItem value="comercio">Comercio</SelectItem>
                <SelectItem value="consumidor_final">Consumidor Final</SelectItem>
                <SelectItem value="revendedor">Revendedor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>CPF/CNPJ</Label>
            <Input value={form.cpf_cnpj} onChange={e => set('cpf_cnpj', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input value={form.telefone} onChange={e => set('telefone', e.target.value)} placeholder="(71) 99999-9999" />
          </div>
          <div className="space-y-2">
            <Label>WhatsApp</Label>
            <Input value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} placeholder="(71) 99999-9999" />
          </div>
          <div className="space-y-2">
            <Label>Rua</Label>
            <Input value={form.endereco_rua} onChange={e => set('endereco_rua', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Numero</Label>
            <Input value={form.endereco_numero} onChange={e => set('endereco_numero', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Bairro</Label>
            <Input value={form.endereco_bairro} onChange={e => set('endereco_bairro', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input value={form.endereco_cidade} onChange={e => set('endereco_cidade', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Forma de pagamento padrao</Label>
            <Select value={form.forma_pagamento_padrao} onValueChange={v => set('forma_pagamento_padrao', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="fiado">Fiado</SelectItem>
                <SelectItem value="cartao_debito">Cartao Debito</SelectItem>
                <SelectItem value="cartao_credito">Cartao Credito</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Prazo (dias)</Label>
            <Input type="number" value={form.prazo_pagamento_dias} onChange={e => set('prazo_pagamento_dias', e.target.value)} />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Observacoes</Label>
            <Textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} rows={2} />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <Button className="bg-[#2B7A78] hover:bg-[#1e5654]" onClick={salvar} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Cliente'}
          </Button>
          <Button variant="outline" onClick={() => router.push('/clientes')}>Cancelar</Button>
        </div>
      </div>
    </div>
  )
}
