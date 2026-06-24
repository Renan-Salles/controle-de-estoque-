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
import { Search, Plus } from 'lucide-react'
import { buscarProdutos } from '@/lib/actions/produtos'
import { formatarReal } from '@/lib/formatos'
import { cn } from '@/lib/utils'
import type { ItemPedido } from '@/types'

interface ProdutoBusca {
  id: string
  nome: string
  marca: string | null
  preco_venda_padrao: number
  categorias: { nome: string } | null
  estoque: { saldo_atual: number }[]
}

interface Props {
  onAdicionar: (item: Omit<ItemPedido, 'quantidade' | 'total'>) => void
}

function saldoDe(p: ProdutoBusca): number {
  return p.estoque?.[0]?.saldo_atual ?? 0
}

export function BuscaProduto({ onAdicionar }: Props) {
  const [open, setOpen] = useState(false)
  const [termo, setTermo] = useState('')
  const [produtos, setProdutos] = useState<ProdutoBusca[]>([])
  const [pendente, startTransition] = useTransition()

  function pesquisar(valor: string) {
    setTermo(valor)
    startTransition(async () => {
      const resultado = await buscarProdutos(valor)
      setProdutos(resultado as unknown as ProdutoBusca[])
    })
  }

  function selecionar(produto: ProdutoBusca) {
    onAdicionar({
      produto_id: produto.id,
      nome: produto.nome,
      categoria: produto.categorias?.nome ?? '',
      preco_unitario: produto.preco_venda_padrao,
      saldo_atual: saldoDe(produto),
    })
    setTermo('')
    setProdutos([])
    // mantém aberto para o operador continuar lançando itens em sequência
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
            Nome ou código — clique para abrir
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
                ? 'Buscando...'
                : termo
                  ? 'Nenhum produto encontrado'
                  : 'Digite para buscar produtos'}
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
                      {p.marca && (
                        <span className="block truncate text-xs text-text-muted">
                          {p.marca}
                        </span>
                      )}
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
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
