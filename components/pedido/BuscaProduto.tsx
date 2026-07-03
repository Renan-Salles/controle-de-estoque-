'use client'
import { useState, useTransition, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Campo } from '@/components/ui-kit/FormKit'
import { btnClass } from '@/components/ui-kit/Button'
import { Search, Plus, PackagePlus } from 'lucide-react'
import { buscarProdutos, criarProduto, listarCategorias } from '@/lib/actions/produtos'
import { formatarReal } from '@/lib/formatos'
import { cn } from '@/lib/utils'
import type { FormaVenda } from '@/types'

type Rel<T> = T | T[] | null

interface ProdutoBusca {
  id: string
  nome: string
  marca: string | null
  preco_venda_padrao: number
  embalagem: string
  fator_conversao: number
  codigo_barras: string | null
  categorias: Rel<{ nome: string }>
  estoque: Rel<{ saldo_atual: number }>
  produto_embalagens?: FormaVenda[] | null
}

// O que a busca entrega pro form (venda ou entrada). 'formas' sao as
// embalagens cadastradas; 'embalagem'/'fator_conversao' legados continuam
// pro FormEntrada, que ainda usa o modelo antigo.
export interface ProdutoParaAdicionar {
  produto_id: string
  nome: string
  categoria: string
  preco_unitario: number
  saldo_atual: number
  formas: FormaVenda[]
  embalagem: string
  fator_conversao: number
}

const EMBALAGENS = ['unidade', 'fardo', 'caixa', 'grade', 'pack'] as const

interface Props {
  onAdicionar: (item: ProdutoParaAdicionar) => void
  // Mostra "Cadastrar produto novo" quando a busca não acha nada. Só faz
  // sentido na ENTRADA (comprar algo que ainda não existe no catálogo) —
  // na venda não tem porque cadastrar produto sem estoque.
  permitirCriar?: boolean
}

// A relação 1:1 do Supabase pode chegar como objeto ou array; normaliza os dois.
function umaRel<T>(rel: Rel<T>): T | null {
  if (!rel) return null
  return Array.isArray(rel) ? (rel[0] ?? null) : rel
}

function saldoDe(p: ProdutoBusca): number {
  return umaRel(p.estoque)?.saldo_atual ?? 0
}

export function BuscaProduto({ onAdicionar, permitirCriar = false }: Props) {
  const [open, setOpen] = useState(false)
  const [termo, setTermo] = useState('')
  const [produtos, setProdutos] = useState<ProdutoBusca[]>([])
  const [pendente, startTransition] = useTransition()
  const [criando, setCriando] = useState(false)

  function abrirPopover(v: boolean) {
    setOpen(v)
    if (v && produtos.length === 0) {
      startTransition(async () => {
        const resultado = await buscarProdutos('')
        setProdutos(resultado as unknown as ProdutoBusca[])
      })
    }
  }

  function pesquisar(valor: string) {
    setTermo(valor)
    startTransition(async () => {
      const resultado = await buscarProdutos(valor)
      setProdutos(resultado as unknown as ProdutoBusca[])
    })
  }

  function selecionar(produto: ProdutoBusca) {
    // Fallback pra produto sem embalagens cadastradas (nao deveria existir
    // apos a migration, mas nao quebra a venda se acontecer): "Unidade" avulsa.
    const formas: FormaVenda[] =
      produto.produto_embalagens && produto.produto_embalagens.length > 0
        ? [...produto.produto_embalagens].sort(
            (a, b) => Number(b.padrao) - Number(a.padrao) || a.unidades - b.unidades,
          )
        : [
            {
              id: `fallback-${produto.id}`,
              nome: 'Unidade',
              unidades: 1,
              preco: produto.preco_venda_padrao,
              padrao: true,
            },
          ]
    onAdicionar({
      produto_id: produto.id,
      nome: produto.nome,
      categoria: umaRel(produto.categorias)?.nome ?? '',
      preco_unitario: produto.preco_venda_padrao,
      saldo_atual: saldoDe(produto),
      formas,
      embalagem: produto.embalagem,
      fator_conversao: produto.fator_conversao,
    })
    setTermo('')
    // Recarrega a lista para o operador continuar lançando itens em sequência
    startTransition(async () => {
      const resultado = await buscarProdutos('')
      setProdutos(resultado as unknown as ProdutoBusca[])
    })
  }

  const nomeExiste = produtos.some(
    (p) => p.nome.toLowerCase() === termo.trim().toLowerCase(),
  )

  const [sheetAberto, setSheetAberto] = useState(false)

  return (
    <Popover open={open} onOpenChange={abrirPopover}>
      <PopoverTrigger
        className="u-motion u-press-sm group flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-4 py-4 text-left hover:border-brand/50 hover:bg-surface-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none aria-expanded:border-brand/60"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand text-primary-foreground">
          <Search className="size-5" strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-medium text-text">
            Buscar produto
          </span>
          <span className="mt-0.5 block text-sm text-text-muted">
            Nome ou código, clique para abrir
          </span>
        </span>
        <kbd className="hidden shrink-0 items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1 font-mono text-[11px] text-text-muted sm:inline-flex">
          Ctrl Space
        </kbd>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--anchor-width) min-w-[var(--anchor-width)] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Brahma Duplo Malte, Coca 2L, água..."
            value={termo}
            onValueChange={pesquisar}
            autoFocus
          />
          <CommandList className="max-h-80">
            <CommandEmpty>
              {pendente
                ? 'Carregando...'
                : termo
                  ? 'Nenhum produto encontrado'
                  : 'Nenhum produto cadastrado'}
            </CommandEmpty>
            {produtos.map((p) => {
              const saldo = saldoDe(p)
              const semEstoque = saldo <= 0
              return (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  onSelect={() => selecionar(p)}
                  className="group/item flex items-center justify-between gap-4 py-2.5"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-surface-2 text-text-muted opacity-0 transition-opacity group-data-selected/item:opacity-100">
                      <Plus className="size-3.5" strokeWidth={2} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-text">
                        {p.nome}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-text-muted">
                        {p.marca && <span className="truncate">{p.marca}</span>}
                        {p.codigo_barras && (
                          <span className="shrink-0 rounded bg-surface-2 px-1 font-mono text-[10px] text-text-muted">
                            {p.codigo_barras}
                          </span>
                        )}
                      </span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-4">
                    <span
                      className={cn(
                        'font-mono text-xs tabular-nums',
                        semEstoque ? 'font-medium text-err' : 'text-text-muted',
                      )}
                    >
                      {saldo} un
                    </span>
                    <span className="w-20 text-right font-mono text-sm tabular-nums text-text">
                      {formatarReal(p.preco_venda_padrao)}
                    </span>
                  </span>
                </CommandItem>
              )
            })}
            {permitirCriar && termo.trim().length >= 2 && !nomeExiste && (
              <CommandItem
                value="__cadastrar_produto__"
                onSelect={() => setSheetAberto(true)}
                className="flex items-center gap-2 font-medium text-brand"
              >
                <PackagePlus className="size-4" strokeWidth={1.5} />
                Cadastrar produto &quot;{termo.trim()}&quot;
              </CommandItem>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
      {permitirCriar && (
        <CriarProdutoRapido
          aberto={sheetAberto}
          onOpenChange={setSheetAberto}
          nomeInicial={termo.trim()}
          criando={criando}
          setCriando={setCriando}
          onCriado={(produto) => {
            setProdutos((prev) => [...prev, {
              id: produto.id,
              nome: produto.nome,
              marca: produto.marca,
              preco_venda_padrao: produto.preco_venda_padrao,
              embalagem: produto.embalagem,
              fator_conversao: produto.fator_conversao,
              codigo_barras: produto.codigo_barras,
              categorias: null,
              estoque: { saldo_atual: 0 },
            }])
            selecionar({
              id: produto.id,
              nome: produto.nome,
              marca: produto.marca,
              preco_venda_padrao: produto.preco_venda_padrao,
              embalagem: produto.embalagem,
              fator_conversao: produto.fator_conversao,
              codigo_barras: produto.codigo_barras,
              categorias: null,
              estoque: { saldo_atual: 0 },
            })
            setSheetAberto(false)
            setOpen(false)
          }}
        />
      )}
    </Popover>
  )
}

type CategoriaOpcao = { id: string; nome: string }

function CriarProdutoRapido({
  aberto,
  onOpenChange,
  nomeInicial,
  criando,
  setCriando,
  onCriado,
}: {
  aberto: boolean
  onOpenChange: (v: boolean) => void
  nomeInicial: string
  criando: boolean
  setCriando: (v: boolean) => void
  onCriado: (produto: {
    id: string; nome: string; marca: string | null
    preco_venda_padrao: number; embalagem: string; fator_conversao: number
    codigo_barras: string | null
  }) => void
}) {
  const [categorias, setCategorias] = useState<CategoriaOpcao[]>([])
  const [form, setForm] = useState({
    nome: nomeInicial,
    categoria_id: '',
    embalagem: 'unidade' as (typeof EMBALAGENS)[number],
    fator_conversao: '1',
    preco_venda_padrao: '',
    margem_alvo_pct: '',
  })

  useEffect(() => {
    if (aberto) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm((f) => ({ ...f, nome: nomeInicial }))
      if (categorias.length === 0) listarCategorias().then(setCategorias)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])

  function set<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  async function salvar() {
    if (form.nome.trim().length < 2) { toast.error('Informe o nome do produto'); return }
    if (!form.categoria_id) { toast.error('Selecione a categoria'); return }
    setCriando(true)
    const resultado = await criarProduto({
      nome: form.nome.trim(),
      categoria_id: form.categoria_id,
      embalagem: form.embalagem,
      fator_conversao: form.embalagem === 'unidade' ? 1 : Number(form.fator_conversao || 1),
      // Preço fica a seu critério: pode deixar em branco agora e definir depois
      // (em Produtos), ou já informar a margem pra sugerir o preço quando o
      // custo real entrar na entrada de estoque.
      preco_venda_padrao: Number(form.preco_venda_padrao || 0),
      custo_atual: 0,
      margem_alvo_pct: form.margem_alvo_pct ? Number(form.margem_alvo_pct) : undefined,
      estoque_minimo: 0,
    })
    setCriando(false)
    if (resultado.error || !resultado.produto) {
      toast.error(resultado.error ?? 'Erro ao cadastrar produto')
      return
    }
    toast.success(`Produto "${resultado.produto.nome}" cadastrado (código ${resultado.produto.codigo_barras})`)
    onCriado(resultado.produto)
  }

  return (
    <Sheet open={aberto} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Cadastrar produto</SheetTitle>
          <SheetDescription>
            Só o essencial pra já lançar a entrada. Ajuste o resto depois em Produtos.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          <Campo label="Nome" obrigatorio full>
            <Input value={form.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Brahma Duplo Malte 350ml" />
          </Campo>
          <Campo label="Categoria" obrigatorio full>
            <Select value={form.categoria_id} onValueChange={(v) => set('categoria_id', v ?? '')}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Selecione a categoria">
                {categorias.find((c) => c.id === form.categoria_id)?.nome ?? 'Selecione a categoria'}
              </SelectValue></SelectTrigger>
              <SelectContent>
                {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Embalagem">
              <Select
                value={form.embalagem}
                onValueChange={(v) => {
                  set('embalagem', (v ?? 'unidade') as (typeof EMBALAGENS)[number])
                  if (v === 'unidade') set('fator_conversao', '1')
                }}
              >
                <SelectTrigger className="w-full"><SelectValue className="capitalize" /></SelectTrigger>
                <SelectContent>
                  {EMBALAGENS.map((e) => <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </Campo>
            {form.embalagem !== 'unidade' && (
              <Campo label={`Unidades por ${form.embalagem}`}>
                <Input type="number" min={1} value={form.fator_conversao} onChange={(e) => set('fator_conversao', e.target.value)} placeholder="24" />
              </Campo>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo
              label="Preço de venda (R$)"
              ajuda="Deixe em branco se ainda não decidiu."
            >
              <Input type="number" step="0.01" value={form.preco_venda_padrao} onChange={(e) => set('preco_venda_padrao', e.target.value)} placeholder="0,00" />
            </Campo>
            <Campo
              label="Margem desejada (%)"
              ajuda="Sugere o preço quando o custo real entrar."
            >
              <Input type="number" step="1" value={form.margem_alvo_pct} onChange={(e) => set('margem_alvo_pct', e.target.value)} placeholder="30" />
            </Campo>
          </div>
        </div>

        <div className="mt-auto flex gap-2 border-t border-border p-4">
          <button type="button" onClick={() => onOpenChange(false)} disabled={criando} className={cn(btnClass('outline'), 'flex-1')}>
            Cancelar
          </button>
          <button type="button" onClick={salvar} disabled={criando} className={cn(btnClass('primary'), 'flex-1')}>
            {criando ? 'Salvando...' : 'Cadastrar e usar'}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
