'use client'
import { useState, useTransition } from 'react'
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Search } from 'lucide-react'
import { buscarProdutos } from '@/lib/actions/produtos'
import type { ItemPedido } from '@/types'

interface Props {
  onAdicionar: (item: Omit<ItemPedido, 'quantidade' | 'total'>) => void
}

export function BuscaProduto({ onAdicionar }: Props) {
  const [open, setOpen] = useState(false)
  const [termo, setTermo] = useState('')
  const [produtos, setProdutos] = useState<{ id: string; nome: string; marca: string | null; preco_venda_padrao: number; categorias: { nome: string } | null; estoque: { saldo_atual: number }[] }[]>([])
  const [, startTransition] = useTransition()

  function pesquisar(valor: string) {
    setTermo(valor)
    startTransition(async () => {
      const resultado = await buscarProdutos(valor)
      setProdutos(resultado as typeof produtos)
    })
  }

  function selecionar(produto: typeof produtos[0]) {
    onAdicionar({
      produto_id: produto.id,
      nome: produto.nome,
      categoria: (produto.categorias as { nome: string } | null)?.nome ?? '',
      preco_unitario: produto.preco_venda_padrao,
      saldo_atual: (produto.estoque as { saldo_atual: number }[])?.[0]?.saldo_atual ?? 0,
    })
    setOpen(false)
    setTermo('')
    setProdutos([])
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2 text-muted-foreground">
          <Search size={14} />
          Buscar produto (nome ou codigo)...
          <span className="ml-auto text-xs opacity-50">Ctrl+Space</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Cerveja Brahma, refrigerante, agua..."
            value={termo}
            onValueChange={pesquisar}
          />
          <CommandList>
            <CommandEmpty>Nenhum produto encontrado</CommandEmpty>
            {produtos.map(p => (
              <CommandItem key={p.id} onSelect={() => selecionar(p)} className="flex justify-between">
                <span>{p.nome} {p.marca ? `(${p.marca})` : ''}</span>
                <span className="flex gap-4 text-xs text-muted-foreground">
                  <span className={(p.estoque as { saldo_atual: number }[])?.[0]?.saldo_atual <= 0 ? 'text-red-400' : ''}>
                    {(p.estoque as { saldo_atual: number }[])?.[0]?.saldo_atual ?? 0} em estoque
                  </span>
                  <span className="font-medium text-foreground">R$ {p.preco_venda_padrao.toFixed(2)}</span>
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
