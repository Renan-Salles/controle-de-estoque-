'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { btnClass } from '@/components/ui-kit/Button'
import { FormSection, Campo } from '@/components/ui-kit/FormKit'
import {
  listarCategorias,
  criarProduto,
  atualizarProduto,
  salvarEmbalagens,
} from '@/lib/actions/produtos'

// Uma forma de venda do produto na UI do form. A "Unidade" (unidades=1) e
// fixa: sempre existe, so o preco muda. As demais sao livres (fardo, caixa...).
export type EmbalagemForm = {
  nome: string
  unidades: string
  preco: string
}

export type ProdutoFormValores = {
  nome: string
  marca: string
  codigo_barras: string
  categoria_id: string
  volume_ml: string
  preco_venda_padrao: string
  custo_atual: string
  margem_alvo_pct: string
  estoque_minimo: string
  embalagens: EmbalagemForm[]
}

const VAZIO: ProdutoFormValores = {
  nome: '',
  marca: '',
  codigo_barras: '',
  categoria_id: '',
  volume_ml: '',
  preco_venda_padrao: '',
  custo_atual: '0',
  margem_alvo_pct: '',
  estoque_minimo: '0',
  embalagens: [],
}

export function ProdutoForm({
  modo,
  produtoId,
  inicial,
  categoriasIniciais,
}: {
  modo: 'novo' | 'editar'
  produtoId?: string
  inicial?: Partial<ProdutoFormValores>
  categoriasIniciais?: { id: string; nome: string }[]
}) {
  const router = useRouter()
  const [categorias, setCategorias] = useState<{ id: string; nome: string }[]>(
    categoriasIniciais ?? [],
  )
  const [form, setForm] = useState<ProdutoFormValores>({
    ...VAZIO,
    ...inicial,
  })
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (categoriasIniciais && categoriasIniciais.length > 0) return
    listarCategorias().then(setCategorias)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const set = (k: keyof ProdutoFormValores, v: string | null) => {
    setForm((p) => ({ ...p, [k]: v ?? '' }))
    if (erros[k]) setErros((e) => ({ ...e, [k]: '' }))
  }

  // --- Formas de venda extras (alem da Unidade, que e fixa) ---

  function addEmbalagem() {
    setForm((p) => ({
      ...p,
      embalagens: [...p.embalagens, { nome: '', unidades: '', preco: '' }],
    }))
  }

  function setEmbalagem(i: number, campo: keyof EmbalagemForm, v: string) {
    setForm((p) => ({
      ...p,
      embalagens: p.embalagens.map((e, idx) =>
        idx === i ? { ...e, [campo]: v } : e,
      ),
    }))
    if (erros.embalagens) setErros((e) => ({ ...e, embalagens: '' }))
  }

  function removerEmbalagem(i: number) {
    setForm((p) => ({
      ...p,
      embalagens: p.embalagens.filter((_, idx) => idx !== i),
    }))
  }

  function validar() {
    const e: Record<string, string> = {}
    if (form.nome.trim().length < 2) e.nome = 'Informe o nome do produto'
    if (!form.categoria_id) e.categoria_id = 'Selecione uma categoria'
    if (Number(form.preco_venda_padrao || 0) < 0)
      e.preco_venda_padrao = 'Preço não pode ser negativo'
    for (const emb of form.embalagens) {
      if (!emb.nome.trim()) {
        e.embalagens = 'Toda forma de venda precisa de um nome (ex: Fardo 12)'
        break
      }
      if (!emb.unidades || Number(emb.unidades) < 2) {
        e.embalagens = `"${emb.nome}": informe quantas unidades tem dentro (2 ou mais)`
        break
      }
      if (emb.preco === '' || Number(emb.preco) < 0) {
        e.embalagens = `"${emb.nome}": informe o preço da embalagem fechada`
        break
      }
    }
    setErros(e)
    return Object.keys(e).length === 0
  }

  function usarSugestaoPreco() {
    const custo = Number(form.custo_atual || 0)
    const margem = Number(form.margem_alvo_pct || 0)
    if (!custo || !margem) {
      toast.error('Informe custo e margem pra calcular a sugestão')
      return
    }
    set('preco_venda_padrao', (custo * (1 + margem / 100)).toFixed(2))
  }

  // Lista completa de formas pro backend: Unidade (preco padrao) + extras.
  function montarEmbalagens() {
    return [
      {
        nome: 'Unidade',
        unidades: 1,
        preco: Number(form.preco_venda_padrao || 0),
        padrao: true,
      },
      ...form.embalagens.map((e) => ({
        nome: e.nome.trim(),
        unidades: Number(e.unidades),
        preco: Number(e.preco),
        padrao: false,
      })),
    ]
  }

  async function salvar() {
    if (!validar()) return
    setSalvando(true)
    const embalagens = montarEmbalagens()
    // Campos legados embalagem/fator_conversao: espelham a maior forma
    // cadastrada (compatibilidade com o que ainda le esses campos).
    const maior = embalagens.reduce((a, b) => (b.unidades > a.unidades ? b : a))
    const payload = {
      nome: form.nome,
      marca: form.marca,
      codigo_barras: form.codigo_barras,
      categoria_id: form.categoria_id,
      embalagem: maior.unidades > 1 ? 'caixa' : 'unidade',
      fator_conversao: maior.unidades,
      preco_venda_padrao: Number(form.preco_venda_padrao || 0),
      custo_atual: Number(form.custo_atual || 0),
      margem_alvo_pct: form.margem_alvo_pct ? Number(form.margem_alvo_pct) : undefined,
      estoque_minimo: Number(form.estoque_minimo || 0),
      volume_ml: form.volume_ml ? Number(form.volume_ml) : undefined,
      embalagens,
    }
    const resultado =
      modo === 'editar' && produtoId
        ? await atualizarProduto(produtoId, payload)
        : await criarProduto(payload)
    if (resultado.error) {
      setSalvando(false)
      toast.error(resultado.error)
      return
    }
    // Na edicao, as embalagens sao salvas a parte (replace total).
    if (modo === 'editar' && produtoId) {
      const rEmb = await salvarEmbalagens(produtoId, embalagens)
      if (rEmb.error) {
        setSalvando(false)
        toast.error(rEmb.error)
        return
      }
    }
    setSalvando(false)
    toast.success(modo === 'editar' ? 'Produto atualizado' : 'Produto cadastrado')
    router.push('/produtos')
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-lg border border-border bg-surface px-6 py-6 sm:px-8">
        <FormSection
          titulo="Identificação"
          descricao="Como o produto aparece no catálogo e no balcão."
        >
          <Campo label="Nome" obrigatorio erro={erros.nome} full>
            <Input
              value={form.nome}
              onChange={(e) => set('nome', e.target.value)}
              placeholder="Brahma Duplo Malte 350ml"
              aria-invalid={!!erros.nome}
            />
          </Campo>
          <Campo label="Marca">
            <Input
              value={form.marca}
              onChange={(e) => set('marca', e.target.value)}
              placeholder="Brahma"
            />
          </Campo>
          <Campo
            label="Código do produto"
            ajuda={
              modo === 'novo'
                ? 'Deixe em branco pra gerar automático (ex: CER-0001, pelo padrão da categoria).'
                : undefined
            }
          >
            <Input
              value={form.codigo_barras}
              onChange={(e) => set('codigo_barras', e.target.value)}
              placeholder="CER-0001"
              className="font-mono"
            />
          </Campo>
          <Campo label="Categoria" obrigatorio erro={erros.categoria_id} full>
            <Select
              value={form.categoria_id}
              onValueChange={(v) => set('categoria_id', v)}
            >
              <SelectTrigger className="w-full" aria-invalid={!!erros.categoria_id}>
                <SelectValue placeholder="Selecione a categoria">
                  {categorias.find((c) => c.id === form.categoria_id)?.nome ?? 'Selecione a categoria'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo
            label="Volume (ml)"
            ajuda="Da unidade individual (garrafa/lata), não da caixa."
          >
            <Input
              type="number"
              inputMode="numeric"
              value={form.volume_ml}
              onChange={(e) => set('volume_ml', e.target.value)}
              placeholder="350"
            />
          </Campo>
        </FormSection>

        <FormSection
          titulo="Preços e estoque"
          descricao="Você decide o preço. Custo + margem é só uma sugestão pra ajudar a calcular."
        >
          <Campo label="Custo atual (R$)">
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={form.custo_atual}
              onChange={(e) => set('custo_atual', e.target.value)}
              placeholder="3,20"
            />
          </Campo>
          <Campo
            label="Margem alvo (%)"
            ajuda="Usada pra sugerir o preço de venda a partir do custo."
          >
            <Input
              type="number"
              step="1"
              inputMode="decimal"
              value={form.margem_alvo_pct}
              onChange={(e) => set('margem_alvo_pct', e.target.value)}
              placeholder="30"
            />
          </Campo>
          <Campo
            label="Preço da unidade (R$)"
            erro={erros.preco_venda_padrao}
            ajuda="Preço de venda da unidade solta. Caixas e fardos têm preço próprio abaixo."
          >
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={form.preco_venda_padrao}
                onChange={(e) => set('preco_venda_padrao', e.target.value)}
                placeholder="0,00"
                aria-invalid={!!erros.preco_venda_padrao}
              />
              <button
                type="button"
                onClick={usarSugestaoPreco}
                className={btnClass('outline')}
                title="Calcular a partir do custo e da margem"
              >
                Sugerir
              </button>
            </div>
          </Campo>
          <Campo
            label="Estoque mínimo"
            ajuda="Abaixo disso o produto entra em alerta. Sempre em unidades."
          >
            <Input
              type="number"
              inputMode="numeric"
              value={form.estoque_minimo}
              onChange={(e) => set('estoque_minimo', e.target.value)}
              placeholder="24"
            />
          </Campo>
        </FormSection>

        <FormSection
          titulo="Formas de venda"
          descricao="Além da unidade solta, o produto pode ser vendido em caixa, fardo ou pack fechado, cada um com seu preço. O estoque é sempre contado em unidades."
          className="sm:grid-cols-1"
        >
          {/* Unidade: fixa, o preco vem do campo acima */}
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/50 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text">Unidade</p>
              <p className="text-xs text-text-muted">1 unidade · sempre disponível</p>
            </div>
            <p className="font-mono text-sm tabular-nums text-text">
              {form.preco_venda_padrao
                ? `R$ ${Number(form.preco_venda_padrao).toFixed(2).replace('.', ',')}`
                : 'defina o preço acima'}
            </p>
          </div>

          {form.embalagens.map((emb, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_90px_110px_36px] items-end gap-2 rounded-lg border border-border px-3 py-2.5"
            >
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-text-muted">Nome</label>
                <Input
                  value={emb.nome}
                  onChange={(e) => setEmbalagem(i, 'nome', e.target.value)}
                  placeholder="Fardo 12"
                  className="h-9"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-text-muted">Unidades</label>
                <Input
                  type="number"
                  min={2}
                  inputMode="numeric"
                  value={emb.unidades}
                  onChange={(e) => setEmbalagem(i, 'unidades', e.target.value)}
                  placeholder="12"
                  className="h-9 font-mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-text-muted">Preço (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  inputMode="decimal"
                  value={emb.preco}
                  onChange={(e) => setEmbalagem(i, 'preco', e.target.value)}
                  placeholder="50,00"
                  className="h-9 font-mono"
                />
              </div>
              <button
                type="button"
                onClick={() => removerEmbalagem(i)}
                title="Remover forma de venda"
                className="flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-err/10 hover:text-err"
              >
                <Trash2 className="size-4" strokeWidth={1.5} />
              </button>
            </div>
          ))}

          {erros.embalagens && (
            <p className="text-xs text-err">{erros.embalagens}</p>
          )}

          <button
            type="button"
            onClick={addEmbalagem}
            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-dashed border-border text-sm font-medium text-text-muted hover:border-brand/50 hover:text-brand"
          >
            <Plus className="size-4" strokeWidth={1.5} />
            Adicionar caixa, fardo ou pack
          </button>
        </FormSection>

        <div className="mt-7 flex items-center justify-end gap-2 border-t border-border pt-6">
          <Link href="/produtos" className={btnClass('outline')}>
            Cancelar
          </Link>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className={btnClass('primary')}
          >
            {salvando
              ? 'Salvando...'
              : modo === 'editar'
                ? 'Salvar alterações'
                : 'Salvar produto'}
          </button>
        </div>
      </div>
    </div>
  )
}
