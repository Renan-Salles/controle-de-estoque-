'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { buscarContasReceber, registrarPagamento, buscarResumoFinanceiro } from '@/lib/actions/financeiro'

type ContaReceber = {
  id: string
  valor: number
  valor_pago: number
  status: string
  data_vencimento: string
  descricao: string | null
  clientes: { nome: string; telefone: string | null } | null
}

const statusCor: Record<string, 'default' | 'secondary' | 'destructive'> = {
  aberto: 'secondary',
  pago: 'default',
  parcial: 'secondary',
  vencido: 'destructive',
  cancelado: 'secondary',
}

export default function ContasReceberPage() {
  const [contas, setContas] = useState<ContaReceber[]>([])
  const [filtroStatus, setFiltroStatus] = useState('todas')
  const [resumo, setResumo] = useState({ totalReceber: 0, totalRecebido: 0, inadimplente: 0 })
  const [contaPagar, setContaPagar] = useState<ContaReceber | null>(null)
  const [valorPagamento, setValorPagamento] = useState('')
  const [formaPag, setFormaPag] = useState('dinheiro')
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  async function carregar() {
    const [dados, res] = await Promise.all([
      buscarContasReceber(filtroStatus),
      buscarResumoFinanceiro(),
    ])
    setContas(dados as ContaReceber[])
    setResumo(res)
  }

  useEffect(() => { carregar() }, [filtroStatus])

  async function handlePagamento() {
    if (!contaPagar || !valorPagamento) return
    setSaving(true)
    const resultado = await registrarPagamento(contaPagar.id, Number(valorPagamento), formaPag)
    setSaving(false)
    if (resultado.error) { toast.error(resultado.error); return }
    toast.success('Pagamento registrado')
    setDialogOpen(false)
    setContaPagar(null)
    setValorPagamento('')
    carregar()
  }

  const hoje = new Date().toISOString().split('T')[0]

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Contas a Receber</h1>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total a receber (mes)', valor: resumo.totalReceber },
          { label: 'Total recebido (mes)', valor: resumo.totalRecebido },
          { label: 'Inadimplente', valor: resumo.inadimplente, destaque: resumo.inadimplente > 0 },
        ].map(c => (
          <div key={c.label} className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{c.label}</p>
            <p className={`text-2xl font-bold mt-1 ${c.destaque ? 'text-red-400' : ''}`}>R$ {c.valor.toFixed(2)}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {['todas', 'aberto', 'vencido', 'parcial', 'pago'].map(s => (
          <Button key={s} size="sm" variant={filtroStatus === s ? 'default' : 'outline'}
            onClick={() => setFiltroStatus(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-card border-b border-border">
            <tr>
              <th className="text-left p-3 font-medium">Cliente</th>
              <th className="text-left p-3 font-medium">Descricao</th>
              <th className="text-right p-3 font-medium">Valor</th>
              <th className="text-right p-3 font-medium">Pago</th>
              <th className="text-left p-3 font-medium">Vencimento</th>
              <th className="text-center p-3 font-medium">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {contas.map((c) => (
              <tr key={c.id} className={`border-b border-border hover:bg-card transition-colors ${c.data_vencimento < hoje && c.status === 'aberto' ? 'bg-red-500/5' : ''}`}>
                <td className="p-3 font-medium">{c.clientes?.nome ?? '-'}</td>
                <td className="p-3 text-muted-foreground">{c.descricao ?? '-'}</td>
                <td className="p-3 text-right font-mono">R$ {c.valor.toFixed(2)}</td>
                <td className="p-3 text-right font-mono text-muted-foreground">R$ {(c.valor_pago ?? 0).toFixed(2)}</td>
                <td className="p-3 text-muted-foreground">{new Date(c.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                <td className="p-3 text-center">
                  <Badge variant={statusCor[c.status] ?? 'default'}>{c.status}</Badge>
                </td>
                <td className="p-3">
                  {c.status !== 'pago' && c.status !== 'cancelado' && (
                    <Dialog open={dialogOpen && contaPagar?.id === c.id}
                      onOpenChange={open => { setDialogOpen(open); if (!open) setContaPagar(null) }}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" onClick={() => { setContaPagar(c); setValorPagamento(String((c.valor - (c.valor_pago ?? 0)).toFixed(2))); setDialogOpen(true) }}>
                          Receber
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
                        <div className="space-y-4">
                          <p className="text-sm"><strong>{contaPagar?.clientes?.nome}</strong> - Saldo: R$ {((contaPagar?.valor ?? 0) - (contaPagar?.valor_pago ?? 0)).toFixed(2)}</p>
                          <div className="space-y-2">
                            <Label>Valor recebido</Label>
                            <Input type="number" step="0.01" value={valorPagamento} onChange={e => setValorPagamento(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>Forma de pagamento</Label>
                            <Select value={formaPag} onValueChange={setFormaPag}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                <SelectItem value="pix">Pix</SelectItem>
                                <SelectItem value="cartao_debito">Cartao Debito</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button className="w-full bg-[#2B7A78] hover:bg-[#1e5654]" onClick={handlePagamento} disabled={saving}>
                            {saving ? 'Salvando...' : 'Confirmar Pagamento'}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </td>
              </tr>
            ))}
            {!contas.length && (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhuma conta encontrada</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
