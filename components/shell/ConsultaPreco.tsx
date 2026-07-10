'use client'
import { useState, useTransition } from 'react'
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
import { Search } from 'lucide-react'
import { buscarProdutos } from '@/lib/actions/produtos'
import { formatarReal } from '@/lib/formatos'
import type { FormaVenda } from '@/types'

type Rel<T> = T | T[] | null

interface ProdutoBusca {
  id: string
  nome: string
  marca: string | null
  preco_venda_padrao: number
  categorias: Rel<{ nome: string }>
  estoque: Rel<{ saldo_atual: number }>
  produto_embalagens?: FormaVenda[] | null
}

function umaRel<T>(rel: Rel<T>): T | null {
  if (!rel) return null
  return Array.isArray(rel) ? (rel[0] ?? null) : rel
}

// Formas de venda ordenadas (padrao primeiro, depois por unidades) prontas
// pra exibir "Unidade R$ 4,50 · Fardo 12 R$ 54,00" na consulta.
function formasDe(p: ProdutoBusca): FormaVenda[] {
  if (p.produto_embalagens && p.produto_embalagens.length > 0) {
    return [...p.produto_embalagens].sort(
      (a, b) => Number(b.padrao) - Number(a.padrao) || a.unidades - b.unidades,
    )
  }
  return [{ id: `fallback-${p.id}`, nome: 'Unidade', unidades: 1, preco: p.preco_venda_padrao, padrao: true }]
}

// Botao global na Topbar: consulta rapida de "quanto custa X", so leitura --
// sem editar nada, sem adicionar a comanda. Pensado pro balcao responder um
// cliente na hora sem precisar abrir Produtos > editar.
export function ConsultaPreco() {
  const [open, setOpen] = useState(false)
  const [termo, setTermo] = useState('')
  const [produtos, setProdutos] = useState<ProdutoBusca[]>([])
  const [pendente, startTransition] = useTransition()

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

  return (
    <Popover open={open} onOpenChange={abrirPopover}>
      <PopoverTrigger
        className="u-motion u-press-sm flex items-center gap-2 rounded-md py-1.5 px-2.5 text-sm text-text-muted hover:bg-surface-2 hover:text-text"
        title="Consultar preço de um produto"
      >
        <Search className="size-4" strokeWidth={1.75} />
        <span className="hidden sm:inline">Consultar preço</span>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Água, Brahma, Coca 2L..."
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
              const formas = formasDe(p)
              const saldo = umaRel(p.estoque)?.saldo_atual ?? 0
              return (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  className="flex flex-col items-start gap-1 py-2.5"
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-text">{p.nome}</span>
                    <span
                      className={
                        saldo <= 0
                          ? 'shrink-0 font-mono text-xs font-medium text-err'
                          : 'shrink-0 font-mono text-xs text-text-muted'
                      }
                    >
                      {saldo} un
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-sm tabular-nums text-brand">
                    {formas.map((f) => (
                      <span key={f.id}>
                        {f.nome} {formatarReal(f.preco)}
                      </span>
                    ))}
                  </span>
                </CommandItem>
              )
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
