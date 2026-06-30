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
import { User, ChevronsUpDown, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { buscarClientes, cadastrarClienteRapido } from '@/lib/actions/clientes'
import { rotuloPagamento } from '@/lib/pedido-labels'

export interface ClienteResumo {
  id: string
  nome: string
  telefone: string | null
  forma_pagamento_padrao: string
  prazo_pagamento_dias?: number
}

interface Props {
  selecionado: ClienteResumo | null
  onSelecionar: (cliente: ClienteResumo) => void
}

export function BuscaCliente({ selecionado, onSelecionar }: Props) {
  const [open, setOpen] = useState(false)
  const [termo, setTermo] = useState('')
  const [clientes, setClientes] = useState<ClienteResumo[]>([])
  const [pendente, startTransition] = useTransition()

  function abrirPopover(v: boolean) {
    setOpen(v)
    if (v && clientes.length === 0) {
      startTransition(async () => {
        const resultado = await buscarClientes('')
        setClientes(resultado as unknown as ClienteResumo[])
      })
    }
  }

  function pesquisar(valor: string) {
    setTermo(valor)
    startTransition(async () => {
      const resultado = await buscarClientes(valor)
      setClientes(resultado as unknown as ClienteResumo[])
    })
  }

  function selecionar(cliente: ClienteResumo) {
    onSelecionar(cliente)
    setOpen(false)
    setTermo('')
  }

  const [criando, setCriando] = useState(false)

  // Cadastra na hora o cliente digitado (só o nome) e já seleciona.
  async function cadastrar() {
    const nome = termo.trim()
    if (nome.length < 2 || criando) return
    setCriando(true)
    const r = await cadastrarClienteRapido(nome)
    setCriando(false)
    if ('error' in r) {
      toast.error(r.error)
      return
    }
    toast.success(`Cliente "${r.cliente.nome}" cadastrado`)
    selecionar({
      id: r.cliente.id,
      nome: r.cliente.nome,
      telefone: r.cliente.telefone,
      forma_pagamento_padrao: r.cliente.forma_pagamento_padrao,
    })
  }

  // Já existe um cliente com exatamente esse nome na lista?
  const nomeExiste = clientes.some(
    (c) => c.nome.toLowerCase() === termo.trim().toLowerCase(),
  )

  return (
    <Popover open={open} onOpenChange={abrirPopover}>
      <PopoverTrigger
        className="u-motion u-press-sm group flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-3.5 py-3 text-left hover:border-brand/50 hover:bg-surface-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none aria-expanded:border-brand/60"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
          <User className="size-4" strokeWidth={1.5} />
        </span>
        {selecionado ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-text">
              {selecionado.nome}
            </span>
            <span className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
              <span className="font-mono tabular-nums">
                {selecionado.telefone || 'sem telefone'}
              </span>
              <span className="size-0.5 rounded-full bg-text-muted/60" />
              <span>{rotuloPagamento(selecionado.forma_pagamento_padrao)}</span>
            </span>
          </span>
        ) : (
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-text">
              Selecionar cliente
            </span>
            <span className="mt-0.5 block text-xs text-text-muted">
              Busque pelo nome para começar
            </span>
          </span>
        )}
        <ChevronsUpDown
          className="size-4 shrink-0 text-text-muted transition-colors group-hover:text-text"
          strokeWidth={1.5}
        />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) min-w-[var(--anchor-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Nome do cliente..."
            value={termo}
            onValueChange={pesquisar}
            autoFocus
          />
          <CommandList>
            <CommandEmpty>
              {pendente
                ? 'Carregando...'
                : termo
                  ? 'Nenhum cliente encontrado'
                  : 'Nenhum cliente cadastrado'}
            </CommandEmpty>
            {clientes.map((c) => (
              <CommandItem
                key={c.id}
                value={c.id}
                onSelect={() => selecionar(c)}
                className="flex items-center justify-between gap-3"
              >
                <span className="min-w-0 truncate font-medium">{c.nome}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-text-muted">
                  <span className="font-mono tabular-nums">{c.telefone || '-'}</span>
                  <span className="rounded bg-surface-2 px-1.5 py-0.5">
                    {rotuloPagamento(c.forma_pagamento_padrao)}
                  </span>
                </span>
              </CommandItem>
            ))}
            {termo.trim().length >= 2 && !nomeExiste && (
              <CommandItem
                value="__cadastrar_cliente__"
                onSelect={cadastrar}
                disabled={criando}
                className="flex items-center gap-2 font-medium text-brand"
              >
                <UserPlus className="size-4" strokeWidth={1.5} />
                {criando ? 'Cadastrando...' : `Cadastrar "${termo.trim()}"`}
              </CommandItem>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
