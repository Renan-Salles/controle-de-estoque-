'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Trash2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { btnClass } from '@/components/ui-kit/Button'
import { Campo } from '@/components/ui-kit/FormKit'
import { formatarReal } from '@/lib/formatos'
import { criarCustoFixo, atualizarCustoFixo, deletarCustoFixo, type CustoFixo } from '@/lib/actions/custos-fixos'
import { CATEGORIAS, RECORRENCIAS, LABEL_CAT, LABEL_REC } from '@/lib/constants/custos-fixos'

type Form = { nome: string; categoria: string; valor: string; recorrencia: string; ativo: boolean }
const VAZIO: Form = { nome: '', categoria: 'aluguel', valor: '', recorrencia: 'mensal', ativo: true }

export function CustosFixosClient({ inicial }: { inicial: CustoFixo[] }) {
  const [lista, setLista] = useState<CustoFixo[]>(inicial)
  const [form, setForm] = useState<Form>(VAZIO)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const set = (k: keyof Form, v: string | boolean | null) => setForm((p) => ({ ...p, [k]: v ?? '' }))

  const totalMes = lista.filter((c) => c.ativo).reduce((a, c) => {
    if (c.recorrencia === 'mensal') return a + c.valor
    if (c.recorrencia === 'anual') return a + c.valor / 12
    return a
  }, 0)

  async function salvar() {
    if (!form.nome.trim() || !form.valor) { toast.error('Preencha nome e valor'); return }
    setSalvando(true)
    const payload = {
      nome: form.nome.trim(), categoria: form.categoria,
      valor: Number(form.valor), recorrencia: form.recorrencia, ativo: form.ativo,
    }
    const res = editandoId
      ? await atualizarCustoFixo(editandoId, payload)
      : await criarCustoFixo(payload)
    setSalvando(false)
    if (res.error) { toast.error(res.error); return }
    toast.success(editandoId ? 'Custo atualizado' : 'Custo adicionado')
    if (editandoId) {
      setLista((l) => l.map((c) => c.id === editandoId ? { ...c, ...payload } : c))
    } else {
      setLista((l) => [...l, { id: crypto.randomUUID(), ...payload }])
    }
    setForm(VAZIO)
    setEditandoId(null)
  }

  function editar(c: CustoFixo) {
    setEditandoId(c.id)
    setForm({ nome: c.nome, categoria: c.categoria, valor: String(c.valor), recorrencia: c.recorrencia, ativo: c.ativo })
  }

  async function deletar(id: string) {
    if (!confirm('Remover este custo?')) return
    const res = await deletarCustoFixo(id)
    if (res.error) { toast.error(res.error); return }
    setLista((l) => l.filter((c) => c.id !== id))
    toast.success('Removido')
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-text">
          {editandoId ? 'Editar custo' : 'Adicionar custo fixo'}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo label="Nome" full>
            <Input value={form.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Aluguel do galpão" />
          </Campo>
          <Campo label="Categoria">
            <Select value={form.categoria} onValueChange={(v) => set('categoria', v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{LABEL_CAT[c]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Campo>
          <Campo label="Valor (R$)">
            <Input type="number" step="0.01" value={form.valor} onChange={(e) => set('valor', e.target.value)} placeholder="1500,00" />
          </Campo>
          <Campo label="Recorrência">
            <Select value={form.recorrencia} onValueChange={(v) => set('recorrencia', v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RECORRENCIAS.map((r) => <SelectItem key={r} value={r}>{LABEL_REC[r]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Campo>
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={salvar} disabled={salvando} className={btnClass('primary')}>
            {salvando ? 'Salvando...' : editandoId ? 'Salvar' : 'Adicionar'}
          </button>
          {editandoId && (
            <button type="button" onClick={() => { setForm(VAZIO); setEditandoId(null) }} className={btnClass('outline')}>
              <X className="size-4" /> Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2">
              <th className="px-4 py-2.5 text-left font-medium text-text-muted">Nome</th>
              <th className="px-4 py-2.5 text-left font-medium text-text-muted hidden sm:table-cell">Categoria</th>
              <th className="px-4 py-2.5 text-left font-medium text-text-muted hidden sm:table-cell">Recorrência</th>
              <th className="px-4 py-2.5 text-right font-medium text-text-muted">Valor/mês</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="u-rows">
            {lista.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-text-muted">
                  Nenhum custo cadastrado ainda. Adicione aluguel, salários, energia...
                </td>
              </tr>
            )}
            {lista.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 text-text">{c.nome}</td>
                <td className="px-4 py-2.5 text-text-muted hidden sm:table-cell">{LABEL_CAT[c.categoria]}</td>
                <td className="px-4 py-2.5 text-text-muted hidden sm:table-cell">{LABEL_REC[c.recorrencia]}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-text">
                  {formatarReal(c.recorrencia === 'anual' ? c.valor / 12 : c.recorrencia === 'mensal' ? c.valor : 0)}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => editar(c)} className="rounded p-1 text-text-muted hover:bg-surface-2 hover:text-text">
                      <Pencil className="size-3.5" />
                    </button>
                    <button onClick={() => deletar(c.id)} className="rounded p-1 text-text-muted hover:bg-surface-2 hover:text-err">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-surface-2">
              <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-text">Total mensal</td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums text-text">{formatarReal(totalMes)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
