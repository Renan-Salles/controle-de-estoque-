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
import { Truck, ChevronsUpDown, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  buscarFornecedores,
  cadastrarFornecedorRapido,
} from '@/lib/actions/fornecedores'

interface FornecedorResumo {
  id: string
  nome: string
  contato_nome: string | null
}

interface Props {
  // Fornecedor é só o nome (a entrada grava o nome; o cadastro vai pra Fornecedores).
  selecionado: string
  onSelecionar: (nome: string) => void
}

export function BuscaFornecedor({ selecionado, onSelecionar }: Props) {
  const [open, setOpen] = useState(false)
  const [termo, setTermo] = useState('')
  const [fornecedores, setFornecedores] = useState<FornecedorResumo[]>([])
  const [pendente, startTransition] = useTransition()
  const [criando, setCriando] = useState(false)

  function pesquisar(valor: string) {
    setTermo(valor)
    startTransition(async () => {
      const r = await buscarFornecedores(valor)
      setFornecedores(r as unknown as FornecedorResumo[])
    })
  }

  function selecionar(nome: string) {
    onSelecionar(nome)
    setOpen(false)
    setTermo('')
  }

  // Cadastra na hora o fornecedor digitado (só o nome) e já seleciona.
  async function cadastrar() {
    const nome = termo.trim()
    if (nome.length < 2 || criando) return
    setCriando(true)
    const r = await cadastrarFornecedorRapido(nome)
    setCriando(false)
    if ('error' in r) {
      toast.error(r.error)
      return
    }
    toast.success(`Fornecedor "${r.fornecedor.nome}" cadastrado`)
    selecionar(r.fornecedor.nome)
  }

  const nomeExiste = fornecedores.some(
    (f) => f.nome.toLowerCase() === termo.trim().toLowerCase(),
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="u-motion u-press-sm group flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-3.5 py-3 text-left hover:border-brand/50 hover:bg-surface-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none aria-expanded:border-brand/60">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
          <Truck className="size-4" strokeWidth={1.5} />
        </span>
        <span className="min-w-0 flex-1">
          {selecionado ? (
            <span className="block truncate text-sm font-medium text-text">
              {selecionado}
            </span>
          ) : (
            <>
              <span className="block text-sm font-medium text-text">
                Fornecedor (opcional)
              </span>
              <span className="mt-0.5 block text-xs text-text-muted">
                Busque ou cadastre na hora
              </span>
            </>
          )}
        </span>
        {selecionado ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Remover fornecedor"
            onClick={(e) => {
              e.stopPropagation()
              onSelecionar('')
            }}
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text"
          >
            <X className="size-4" strokeWidth={1.5} />
          </span>
        ) : (
          <ChevronsUpDown
            className="size-4 shrink-0 text-text-muted transition-colors group-hover:text-text"
            strokeWidth={1.5}
          />
        )}
      </PopoverTrigger>
      <PopoverContent
        className="w-(--anchor-width) min-w-[var(--anchor-width)] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Nome do fornecedor..."
            value={termo}
            onValueChange={pesquisar}
            autoFocus
          />
          <CommandList>
            <CommandEmpty>
              {pendente
                ? 'Buscando...'
                : termo
                  ? 'Nenhum fornecedor encontrado'
                  : 'Digite para buscar ou cadastrar'}
            </CommandEmpty>
            {fornecedores.map((f) => (
              <CommandItem
                key={f.id}
                value={f.id}
                onSelect={() => selecionar(f.nome)}
                className="flex items-center justify-between gap-3"
              >
                <span className="min-w-0 truncate font-medium">{f.nome}</span>
                {f.contato_nome && (
                  <span className="shrink-0 text-xs text-text-muted">
                    {f.contato_nome}
                  </span>
                )}
              </CommandItem>
            ))}
            {termo.trim().length >= 2 && !nomeExiste && (
              <CommandItem
                value="__cadastrar_fornecedor__"
                onSelect={cadastrar}
                disabled={criando}
                className="flex items-center gap-2 font-medium text-brand"
              >
                <Plus className="size-4" strokeWidth={2} />
                {criando ? 'Cadastrando...' : `Cadastrar "${termo.trim()}"`}
              </CommandItem>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
