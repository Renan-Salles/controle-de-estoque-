'use client'
import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PackagePlus, Truck, Loader2 } from 'lucide-react'
import { BuscaProduto, type ProdutoParaAdicionar } from '@/components/pedido/BuscaProduto'
import { BuscaFornecedor } from '@/components/movimentacao/BuscaFornecedor'
import {
  ListaItensEntrada,
  unidadesDoItem,
  custoUnitarioDoItem,
  type ItemEntrada,
} from '@/components/movimentacao/ListaItensEntrada'
import { registrarEntrada } from '@/lib/actions/movimentacoes'
import { Money } from '@/components/ui-kit/Money'
import { Textarea } from '@/components/ui/textarea'

// ENTRADA (compra de estoque). Aumenta saldo + custo medio.
// Fornecedor por texto livre (simples). Cada item pede quantas embalagens
// (caixa/fardo/un) e quanto foi pago por ela — a conversao pra unidade base
// de estoque acontece aqui (fatorConversao), o backend so recebe unidades.
export function FormEntrada() {
  const router = useRouter()
  const [fornecedor, setFornecedor] = useState('')
  const [itens, setItens] = useState<ItemEntrada[]>([])
  const [observacoes, setObservacoes] = useState('')
  const [registrando, setRegistrando] = useState(false)

  const total = useMemo(
    () => itens.reduce((acc, i) => acc + i.qtdEmbalagens * i.custoEmbalagem, 0),
    [itens],
  )
  const totalItens = useMemo(
    () => itens.reduce((acc, i) => acc + unidadesDoItem(i), 0),
    [itens],
  )

  const adicionarItem = useCallback(
    (produto: ProdutoParaAdicionar) => {
      setItens((prev) => {
        const existe = prev.find((i) => i.produto_id === produto.produto_id)
        if (existe) {
          return prev.map((i) =>
            i.produto_id === produto.produto_id
              ? { ...i, qtdEmbalagens: i.qtdEmbalagens + 1 }
              : i,
          )
        }
        return [
          ...prev,
          {
            produto_id: produto.produto_id,
            nome: produto.nome,
            marca: produto.categoria || null,
            embalagem: produto.embalagem,
            fatorConversao: produto.fator_conversao || 1,
            qtdEmbalagens: 1,
            // Custo de compra parte de zero: o operador digita o valor real.
            custoEmbalagem: 0,
            validade: '',
          },
        ]
      })
    },
    [],
  )

  const alterarValidade = useCallback((produtoId: string, validade: string) => {
    setItens((prev) =>
      prev.map((i) =>
        i.produto_id === produtoId ? { ...i, validade } : i,
      ),
    )
  }, [])

  const alterarQtde = useCallback((produtoId: string, qtdEmbalagens: number) => {
    setItens((prev) =>
      prev.map((i) =>
        i.produto_id === produtoId ? { ...i, qtdEmbalagens } : i,
      ),
    )
  }, [])

  const alterarCusto = useCallback((produtoId: string, custoEmbalagem: number) => {
    setItens((prev) =>
      prev.map((i) =>
        i.produto_id === produtoId ? { ...i, custoEmbalagem } : i,
      ),
    )
  }, [])

  const remover = useCallback((produtoId: string) => {
    setItens((prev) => prev.filter((i) => i.produto_id !== produtoId))
  }, [])

  const registrar = useCallback(async () => {
    if (!itens.length) {
      toast.error('Adicione pelo menos 1 produto')
      return
    }
    setRegistrando(true)
    const resultado = await registrarEntrada({
      fornecedor_nome: fornecedor.trim() || undefined,
      observacoes: observacoes.trim() || undefined,
      itens: itens.map((i) => ({
        produto_id: i.produto_id,
        quantidade: unidadesDoItem(i),
        custo_unitario: Math.round(custoUnitarioDoItem(i) * 100) / 100,
        validade: i.validade || undefined,
      })),
    })
    setRegistrando(false)
    if (resultado.error) {
      toast.error(resultado.error)
      return
    }
    toast.success('Entrada registrada no estoque')
    router.push('/movimentacoes')
  }, [itens, fornecedor, observacoes, router])

  const podeRegistrar = itens.length > 0 && !registrando

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[1fr_420px]">
      {/* ESQUERDA — area de trabalho */}
      <section className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Fornecedor (opcional)
          </label>
          <BuscaFornecedor selecionado={fornecedor} onSelecionar={setFornecedor} />
          <p className="text-xs text-text-muted">
            Não está na lista? Digite o nome e clique em &quot;Cadastrar&quot;.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Produtos
          </label>
          <BuscaProduto onAdicionar={adicionarItem} permitirCriar />
          <p className="text-xs text-text-muted">
            Busque o produto (ou cadastre um novo) e informe quanto pagou na
            lista à direita.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Observações
          </label>
          <Textarea
            placeholder="Ex.: nota fiscal 4821, conferir validade..."
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={3}
          />
        </div>
      </section>

      {/* DIREITA — lista da compra */}
      <aside className="flex min-h-0 flex-col rounded-xl border border-border bg-surface lg:sticky lg:top-2 lg:max-h-[calc(100dvh-8rem)]">
        <header className="flex items-center justify-between border-b border-border px-4 py-3.5">
          <div className="flex items-center gap-2">
            <PackagePlus className="size-4 text-ok" strokeWidth={1.5} />
            <h2 className="text-sm font-semibold tracking-tight text-text">
              Itens da entrada
            </h2>
          </div>
          {itens.length > 0 && (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[11px] tabular-nums text-text-muted">
              {totalItens} {totalItens === 1 ? 'item' : 'itens'}
            </span>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {itens.length === 0 ? (
            <div className="flex h-full min-h-48 flex-col items-center justify-center px-6 py-12 text-center">
              <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-surface-2 text-text-muted">
                <Truck className="size-5" strokeWidth={1.5} />
              </span>
              <p className="text-sm font-medium text-text">Nenhum item</p>
              <p className="mt-1 max-w-[16rem] text-[13px] leading-relaxed text-text-muted">
                Busque um produto para registrar a compra.
              </p>
            </div>
          ) : (
            <ListaItensEntrada
              itens={itens}
              onAlterarQtde={alterarQtde}
              onAlterarCusto={alterarCusto}
              onAlterarValidade={alterarValidade}
              onRemover={remover}
            />
          )}
        </div>

        <div className="border-t border-border bg-surface px-4 pb-4 pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-base font-semibold text-text">
              Total da compra
            </span>
            <Money valor={total} destaque className="text-2xl font-semibold" />
          </div>

          <button
            type="button"
            onClick={registrar}
            disabled={!podeRegistrar}
            className="u-motion mt-4 flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-base font-semibold text-primary-foreground hover:bg-brand-strong focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
          >
            {registrando ? (
              <>
                <Loader2 className="size-5 animate-spin" strokeWidth={2} />
                Registrando...
              </>
            ) : (
              'Registrar entrada'
            )}
          </button>
        </div>
      </aside>
    </div>
  )
}
