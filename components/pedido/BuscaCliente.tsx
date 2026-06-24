'use client'
import { useState, useTransition } from 'react'
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { User } from 'lucide-react'
import { buscarClientes } from '@/lib/actions/clientes'

interface Props {
  onSelecionar: (clienteId: string) => void
}

export function BuscaCliente({ onSelecionar }: Props) {
  const [open, setOpen] = useState(false)
  const [termo, setTermo] = useState('')
  const [clientes, setClientes] = useState<{ id: string; nome: string; telefone: string | null; forma_pagamento_padrao: string }[]>([])
  const [selecionado, setSelecionado] = useState('')
  const [, startTransition] = useTransition()

  function pesquisar(valor: string) {
    setTermo(valor)
    startTransition(async () => {
      const resultado = await buscarClientes(valor)
      setClientes(resultado as typeof clientes)
    })
  }

  function selecionar(cliente: typeof clientes[0]) {
    setSelecionado(cliente.nome)
    onSelecionar(cliente.id)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2 text-muted-foreground">
          <User size={14} />
          {selecionado || 'Selecionar cliente...'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Nome do cliente..." value={termo} onValueChange={pesquisar} />
          <CommandList>
            <CommandEmpty>Nenhum cliente encontrado</CommandEmpty>
            {clientes.map(c => (
              <CommandItem key={c.id} onSelect={() => selecionar(c)} className="flex justify-between">
                <span>{c.nome}</span>
                <span className="text-xs text-muted-foreground">{c.telefone} | {c.forma_pagamento_padrao}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
