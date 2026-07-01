'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
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
} from '@/lib/actions/produtos'

const EMBALAGENS = ['unidade', 'fardo', 'caixa', 'grade', 'pack'] as const

export type ProdutoFormValores = {
  nome: string
  marca: string
  codigo_barras: string
  categoria_id: string
  embalagem: string
  fator_conversao: string
  volume_ml: string
  preco_venda_padrao: string
  custo_atual: string
  estoque_minimo: string
}

const VAZIO: ProdutoFormValores = {
  nome: '',
  marca: '',
  codigo_barras: '',
  categoria_id: '',
  embalagem: 'unidade',
  fator_conversao: '1',
  volume_ml: '',
  preco_venda_padrao: '',
  custo_atual: '0',
  estoque_minimo: '0',
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

  function validar() {
    const e: Record<string, string> = {}
    if (form.nome.trim().length < 2) e.nome = 'Informe o nome do produto'
    if (!form.categoria_id) e.categoria_id = 'Selecione uma categoria'
    if (form.preco_venda_padrao === '' || Number(form.preco_venda_padrao) < 0)
      e.preco_venda_padrao = 'Informe o preço de venda'
    setErros(e)
    return Object.keys(e).length === 0
  }

  async function salvar() {
    if (!validar()) return
    setSalvando(true)
    const payload = {
      nome: form.nome,
      marca: form.marca,
      codigo_barras: form.codigo_barras,
      categoria_id: form.categoria_id,
      embalagem: form.embalagem,
      fator_conversao: form.embalagem === 'unidade' ? 1 : Number(form.fator_conversao || 1),
      preco_venda_padrao: Number(form.preco_venda_padrao),
      custo_atual: Number(form.custo_atual || 0),
      estoque_minimo: Number(form.estoque_minimo || 0),
      volume_ml: form.volume_ml ? Number(form.volume_ml) : undefined,
    }
    const resultado =
      modo === 'editar' && produtoId
        ? await atualizarProduto(produtoId, payload)
        : await criarProduto(payload)
    setSalvando(false)
    if (resultado.error) {
      toast.error(resultado.error)
      return
    }
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
          <Campo label="Código de barras">
            <Input
              value={form.codigo_barras}
              onChange={(e) => set('codigo_barras', e.target.value)}
              placeholder="7891149101023"
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
        </FormSection>

        <FormSection
          titulo="Embalagem"
          descricao="Unidade de venda e volume da bebida."
        >
          <Campo label="Tipo de embalagem">
            <Select
              value={form.embalagem}
              onValueChange={(v) => {
                set('embalagem', v)
                if (v === 'unidade') set('fator_conversao', '1')
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue className="capitalize" />
              </SelectTrigger>
              <SelectContent>
                {EMBALAGENS.map((e) => (
                  <SelectItem key={e} value={e} className="capitalize">
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          {form.embalagem !== 'unidade' && (
            <Campo
              label={`Unidades por ${form.embalagem}`}
              ajuda="Quantas garrafas/latas tem dentro de 1 desses. Usado pra converter o preço quando você compra em caixa/fardo."
            >
              <Input
                type="number"
                min={1}
                inputMode="numeric"
                value={form.fator_conversao}
                onChange={(e) => set('fator_conversao', e.target.value)}
                placeholder="24"
              />
            </Campo>
          )}
          <Campo label="Volume (ml)">
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
          descricao="Valores em reais e ponto de alerta de reposição."
        >
          <Campo
            label="Preço de venda (R$)"
            obrigatorio
            erro={erros.preco_venda_padrao}
          >
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={form.preco_venda_padrao}
              onChange={(e) => set('preco_venda_padrao', e.target.value)}
              placeholder="4,75"
              aria-invalid={!!erros.preco_venda_padrao}
            />
          </Campo>
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
            label="Estoque mínimo"
            ajuda="Abaixo disso o produto entra em alerta."
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
