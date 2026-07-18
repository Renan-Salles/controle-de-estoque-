# Editar venda + Pedidos recentes no Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dá pra editar os itens (adicionar/tirar/mudar quantidade) de uma venda concluída hoje, ainda não entregue/retirada e com o caixa do dia ainda aberto — recalculando estoque e, se for fiado, a conta a receber. Dashboard ganha uma seção com os 5 pedidos mais recentes, cada um com botão de reimprimir e (quando elegível) editar.

**Architecture:** Motor de edição (`editarVenda`) calcula o delta de estoque produto a produto e reusa a mesma função `ajustar_estoque` de venda/cancelamento. Tela de edição reaproveita `BuscaProduto`/`ListaItensPedido` (os mesmos componentes da comanda de venda) num formulário novo e isolado, sem tocar em `FormSaida.tsx`.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase Postgres, Zod.

## Global Constraints

- Português correto, com acentos — nunca simplificar pra ASCII.
- Sem travessão (—) em copy voltado pro usuário.
- Sem suite de testes automatizada — verificação sempre por `npx tsc --noEmit`, `npx eslint . --quiet`, `npx next build` e teste manual no browser.
- Todo server action que lê/grava dado operacional passa por `getLocalAtivoId()`.
- `movimentacoes_estoque.tipo` tem CHECK constraint fixo no banco:
  `['entrada_compra','saida_venda','ajuste_inventario','descarte','devolucao_cliente','devolucao_fornecedor']`
  — não inventar tipo novo sem migration.
- Commits pequenos, um por unidade de trabalho, sempre com `git push` no final.

---

### Task 1: Elegibilidade + motor de edição (server actions)

**Files:**
- Modify: `lib/actions/pedidos.ts` (adiciona `podeEditarPedido`, `caixaFechadoHoje`, `buscarItensParaEditar`, `editarVenda` no final do arquivo)

**Interfaces:**
- Consumes: `getLocalAtivoId()`, `createClient`/`createServiceClient`, `hojeBrasil()`, `revalidatePath` (já importados em `pedidos.ts`); `ItemPedido`/`FormaVenda` de `@/types`.
- Produces:
  - `podeEditarPedido(p: { status: string; data_pedido: string; concluido_em: string | null }, caixaFechado: boolean): boolean`
  - `caixaFechadoHoje(localId: string): Promise<boolean>`
  - `buscarItensParaEditar(pedidoId: string): Promise<import('@/types').ItemPedido[]>`
  - `editarVenda(pedidoId: string, itens: Array<{ produto_id: string; quantidade: number; preco_unitario: number; total: number; embalagem_nome?: string; embalagem_unidades?: number }>): Promise<{ error: string } | { success: true }>`

- [ ] **Step 1: Importar o tipo `ItemPedido`/`FormaVenda`**

No topo de `lib/actions/pedidos.ts`, adicione:

```ts
import type { ItemPedido, FormaVenda } from '@/types'
```

- [ ] **Step 2: `caixaFechadoHoje` e `podeEditarPedido`**

No final do arquivo, adicione:

```ts
export async function caixaFechadoHoje(localId: string): Promise<boolean> {
  const supabase = await createClient()
  const hoje = hojeBrasil()
  const { data } = await supabase
    .from('caixa_fechamentos')
    .select('id')
    .eq('local_id', localId)
    .eq('data', hoje)
    .maybeSingle()
  return !!data
}

// So edita venda concluida HOJE, ainda nao entregue/retirada, com o
// caixa do dia ainda aberto. Depois disso so cancelar (BotaoCancelar).
export function podeEditarPedido(
  p: { status: string; data_pedido: string; concluido_em: string | null },
  caixaFechado: boolean,
): boolean {
  const hoje = hojeBrasil()
  return (
    p.status === 'concluida' &&
    !p.concluido_em &&
    p.data_pedido.startsWith(hoje) &&
    !caixaFechado
  )
}
```

- [ ] **Step 3: `buscarItensParaEditar`**

Ainda no final do arquivo, adicione (mesma logica de reconstrucao de
formas que `BuscaProduto.tsx` usa em `selecionar()`, e o mesmo padrao de
forma "Outra"/`custom-` que `ListaItensPedido.tsx` ja trata):

```ts
export async function buscarItensParaEditar(pedidoId: string): Promise<ItemPedido[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedido_itens')
    .select(
      'produto_id, quantidade_pedida, preco_unitario, total, embalagem_nome, embalagem_unidades, produtos(nome, categorias(nome), preco_venda_padrao, produto_embalagens(id, nome, unidades, preco, padrao), estoque(saldo_atual))',
    )
    .eq('pedido_id', pedidoId)
  if (error) throw error

  type Rel<T> = T | T[] | null
  const umaRel = <T,>(rel: Rel<T>): T | null => (Array.isArray(rel) ? (rel[0] ?? null) : rel)

  type ItemRaw = {
    produto_id: string
    quantidade_pedida: number
    preco_unitario: number
    total: number
    embalagem_nome: string | null
    embalagem_unidades: number | null
    produtos: {
      nome: string
      categorias: Rel<{ nome: string }>
      preco_venda_padrao: number
      produto_embalagens: FormaVenda[] | null
      estoque: Rel<{ saldo_atual: number }>
    } | null
  }

  return ((data ?? []) as unknown as ItemRaw[]).map((item): ItemPedido => {
    const produto = item.produtos
    const formasCadastradas =
      produto?.produto_embalagens && produto.produto_embalagens.length > 0
        ? [...produto.produto_embalagens].sort(
            (a, b) => Number(b.padrao) - Number(a.padrao) || a.unidades - b.unidades,
          )
        : [
            {
              id: `fallback-${item.produto_id}`,
              nome: 'Unidade',
              unidades: 1,
              preco: produto?.preco_venda_padrao ?? item.preco_unitario,
              padrao: true,
            },
          ]

    const formaExistente = formasCadastradas.find(
      (f) => f.nome === item.embalagem_nome && f.unidades === (item.embalagem_unidades ?? 1),
    )
    const unidades = item.embalagem_unidades ?? 1
    const formas = formaExistente
      ? formasCadastradas
      : [
          ...formasCadastradas,
          {
            id: `custom-${item.produto_id}`,
            nome: item.embalagem_nome ?? 'Unidade',
            unidades,
            preco: +(item.preco_unitario * unidades).toFixed(2),
            padrao: false,
          },
        ]
    const formaId = formaExistente?.id ?? `custom-${item.produto_id}`

    return {
      produto_id: item.produto_id,
      nome: produto?.nome ?? 'Produto',
      categoria: umaRel(produto?.categorias ?? null)?.nome ?? '',
      preco_unitario: item.preco_unitario,
      quantidade: item.quantidade_pedida,
      total: item.total,
      saldo_atual: umaRel(produto?.estoque ?? null)?.saldo_atual ?? 0,
      formas,
      formaId,
      qtdFormas: item.quantidade_pedida / unidades,
      precoForma: +(item.preco_unitario * unidades).toFixed(2),
    }
  })
}
```

- [ ] **Step 4: `editarVenda`**

Ainda no final do arquivo, adicione:

```ts
export async function editarVenda(
  pedidoId: string,
  itens: Array<{
    produto_id: string
    quantidade: number
    preco_unitario: number
    total: number
    embalagem_nome?: string
    embalagem_unidades?: number
  }>,
) {
  if (itens.length === 0) return { error: 'A venda precisa ter pelo menos 1 item' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const serviceClient = await createServiceClient()

  const { data: pedidoRaw, error: errPedido } = await serviceClient
    .from('pedidos')
    .select('id, local_id, status, data_pedido, concluido_em, frete, desconto_total, forma_pagamento')
    .eq('id', pedidoId)
    .single()
  type PedidoRow = {
    id: string
    local_id: string
    status: string
    data_pedido: string
    concluido_em: string | null
    frete: number
    desconto_total: number
    forma_pagamento: string
  }
  const pedido = pedidoRaw as PedidoRow | null
  if (errPedido || !pedido) return { error: errPedido?.message ?? 'Venda não encontrada' }

  const fechado = await caixaFechadoHoje(pedido.local_id)
  if (!podeEditarPedido(pedido, fechado)) {
    return { error: 'Essa venda não pode mais ser editada (fora do dia, caixa fechado ou já concluída)' }
  }

  const { data: itensAntigosRaw, error: errItensAntigos } = await serviceClient
    .from('pedido_itens')
    .select('produto_id, quantidade_pedida')
    .eq('pedido_id', pedidoId)
  if (errItensAntigos) return { error: errItensAntigos.message }
  const itensAntigos = (itensAntigosRaw ?? []) as { produto_id: string; quantidade_pedida: number }[]

  const qtdAntiga = new Map<string, number>()
  for (const i of itensAntigos) qtdAntiga.set(i.produto_id, i.quantidade_pedida)
  const qtdNova = new Map<string, number>()
  for (const i of itens) qtdNova.set(i.produto_id, (qtdNova.get(i.produto_id) ?? 0) + i.quantidade)

  const produtoIds = new Set([...qtdAntiga.keys(), ...qtdNova.keys()])
  const deltas = new Map<string, number>()
  for (const produtoId of produtoIds) {
    const delta = (qtdNova.get(produtoId) ?? 0) - (qtdAntiga.get(produtoId) ?? 0)
    if (delta !== 0) deltas.set(produtoId, delta)
  }

  // Pre-checagem de estoque: todo produto que precisa de MAIS unidades
  // (delta > 0) tem que ter saldo suficiente antes de mexer em qualquer coisa.
  for (const [produtoId, delta] of deltas) {
    if (delta <= 0) continue
    const { data: est } = await serviceClient
      .from('estoque')
      .select('saldo_atual, produtos(nome)')
      .eq('produto_id', produtoId)
      .single()
    const saldo = (est as { saldo_atual: number } | null)?.saldo_atual ?? 0
    if (saldo < delta) {
      const rel = (est as { produtos: { nome: string } | { nome: string }[] | null } | null)?.produtos
      const nome = (Array.isArray(rel) ? rel[0] : rel)?.nome ?? 'produto'
      return { error: `Estoque insuficiente de ${nome}: tem ${saldo}, precisa de mais ${delta}.` }
    }
  }

  for (const [produtoId, delta] of deltas) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ajusteRaw, error: errAjuste } = await (serviceClient as any).rpc('ajustar_estoque', {
      p_produto_id: produtoId,
      p_delta: -delta,
    })
    if (errAjuste) return { error: `Falha ao ajustar estoque: ${errAjuste.message}` }
    const ajuste = (ajusteRaw as { saldo_novo: number; custo_medio: number }[] | null)?.[0]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (serviceClient.from('movimentacoes_estoque') as any).insert({
      produto_id: produtoId,
      tipo: delta > 0 ? 'saida_venda' : 'devolucao_cliente',
      quantidade: -delta,
      custo_unitario: ajuste?.custo_medio ?? 0,
      saldo_apos: ajuste?.saldo_novo ?? 0,
      referencia_tipo: 'pedido',
      referencia_id: pedidoId,
      usuario_id: user.id,
      observacao: 'Edição da venda',
    })
  }

  await serviceClient.from('pedido_itens').delete().eq('pedido_id', pedidoId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: errInsert } = await (serviceClient.from('pedido_itens') as any).insert(
    itens.map((i) => ({
      pedido_id: pedidoId,
      produto_id: i.produto_id,
      quantidade_pedida: i.quantidade,
      preco_unitario: i.preco_unitario,
      total: i.total,
      embalagem_nome: i.embalagem_nome ?? null,
      embalagem_unidades: i.embalagem_unidades ?? null,
    })),
  )
  if (errInsert) return { error: errInsert.message }

  const subtotal = +itens.reduce((acc, i) => acc + i.total, 0).toFixed(2)
  const novoTotal = +(subtotal + pedido.frete - pedido.desconto_total).toFixed(2)

  if (pedido.forma_pagamento === 'fiado') {
    const { data: contaRaw } = await serviceClient
      .from('contas_receber')
      .select('id, valor_pago')
      .eq('pedido_id', pedidoId)
      .maybeSingle()
    const conta = contaRaw as { id: string; valor_pago: number } | null
    if (conta) {
      if (novoTotal < conta.valor_pago) {
        return {
          error: `Não é possível reduzir o total abaixo do que já foi pago (R$ ${conta.valor_pago.toFixed(2).replace('.', ',')})`,
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (serviceClient.from('contas_receber') as any)
        .update({
          valor: novoTotal,
          status: conta.valor_pago >= novoTotal ? 'pago' : 'aberto',
        })
        .eq('id', conta.id)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: errTotal } = await (serviceClient.from('pedidos') as any)
    .update({ subtotal, total: novoTotal })
    .eq('id', pedidoId)
  if (errTotal) return { error: errTotal.message }

  revalidatePath(`/pedidos/${pedidoId}`)
  revalidatePath('/pedidos')
  revalidatePath('/dashboard')
  return { success: true as const }
}
```

- [ ] **Step 5: Verificar tipos e lint**

Run: `cd ~/Projects/Depsys && npx tsc --noEmit && npx eslint lib/actions/pedidos.ts --quiet`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
cd ~/Projects/Depsys
git add lib/actions/pedidos.ts
git commit -m "feat: motor de edicao de venda (itens, estoque, fiado)"
```

---

### Task 2: Tela `/pedidos/[id]/editar`

**Files:**
- Create: `app/(app)/pedidos/[id]/editar/page.tsx`
- Create: `components/pedido/EditarVendaForm.tsx`

**Interfaces:**
- Consumes: `podeEditarPedido`, `caixaFechadoHoje`, `buscarItensParaEditar`, `editarVenda` da Task 1; `BuscaProduto`/`ProdutoParaAdicionar` de `@/components/pedido/BuscaProduto`; `ListaItensPedido` de `@/components/pedido/ListaItensPedido`; `ItemPedido`/`FormaVenda` de `@/types`.
- Produces: rota `/pedidos/[id]/editar`.

- [ ] **Step 1: Criar a página**

Crie `app/(app)/pedidos/[id]/editar/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { podeEditarPedido, caixaFechadoHoje, buscarItensParaEditar } from '@/lib/actions/pedidos'
import { EditarVendaForm } from '@/components/pedido/EditarVendaForm'

export default async function EditarVendaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: pedidoRaw } = await supabase
    .from('pedidos')
    .select('id, numero_pedido, local_id, status, data_pedido, concluido_em')
    .eq('id', id)
    .single()

  type PedidoBasico = {
    id: string
    numero_pedido: number
    local_id: string
    status: string
    data_pedido: string
    concluido_em: string | null
  }
  const pedido = pedidoRaw as PedidoBasico | null
  if (!pedido) notFound()

  const fechado = await caixaFechadoHoje(pedido.local_id)
  if (!podeEditarPedido(pedido, fechado)) notFound()

  const itens = await buscarItensParaEditar(id)

  return (
    <div className="mx-auto max-w-3xl">
      <EditarVendaForm
        pedidoId={id}
        numeroPedido={pedido.numero_pedido}
        itensIniciais={itens}
      />
    </div>
  )
}
```

- [ ] **Step 2: Criar `EditarVendaForm.tsx`**

Crie `components/pedido/EditarVendaForm.tsx`. A função `aplicarForma` é uma
cópia da mesma função pura já usada em `FormSaida.tsx` (mantida separada
de propósito — ver nota no final do arquivo):

```tsx
'use client'
import { useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { BuscaProduto, type ProdutoParaAdicionar } from '@/components/pedido/BuscaProduto'
import { ListaItensPedido } from '@/components/pedido/ListaItensPedido'
import { editarVenda } from '@/lib/actions/pedidos'
import { formatarReal } from '@/lib/formatos'
import type { ItemPedido } from '@/types'

// Copia da mesma funcao pura de FormSaida.tsx: recalcula quantidade/preco/total
// a partir da forma de venda escolhida. Duplicada de proposito (arquivo isolado,
// nao mexe em FormSaida.tsx) -- e uma funcao pequena e estavel, sem estado.
function aplicarForma(
  item: ItemPedido,
  formaId: string,
  qtdFormas: number,
  precoForma?: number,
): ItemPedido {
  const forma = item.formas.find((f) => f.id === formaId) ?? item.formas[0]
  const preco = precoForma ?? forma.preco
  return {
    ...item,
    formaId: forma.id,
    qtdFormas,
    precoForma: preco,
    quantidade: qtdFormas * forma.unidades,
    total: +(qtdFormas * preco).toFixed(2),
    preco_unitario: forma.unidades > 0 ? +(preco / forma.unidades).toFixed(2) : preco,
  }
}

export function EditarVendaForm({
  pedidoId,
  numeroPedido,
  itensIniciais,
}: {
  pedidoId: string
  numeroPedido: number
  itensIniciais: ItemPedido[]
}) {
  const router = useRouter()
  const [itens, setItens] = useState<ItemPedido[]>(itensIniciais)
  const [salvando, startTransition] = useTransition()
  const numeroFmt = `#${String(numeroPedido).padStart(4, '0')}`

  const adicionarItem = useCallback((produto: ProdutoParaAdicionar) => {
    setItens((prev) => {
      const existe = prev.find((i) => i.produto_id === produto.produto_id)
      if (existe) {
        return prev.map((i) =>
          i.produto_id === produto.produto_id
            ? aplicarForma(i, i.formaId, i.qtdFormas + 1, i.precoForma)
            : i,
        )
      }
      const forma = produto.formas.find((f) => f.padrao) ?? produto.formas[0]
      const base: ItemPedido = {
        produto_id: produto.produto_id,
        nome: produto.nome,
        categoria: produto.categoria,
        saldo_atual: produto.saldo_atual,
        formas: produto.formas,
        formaId: forma.id,
        qtdFormas: 1,
        precoForma: forma.preco,
        preco_unitario: 0,
        quantidade: 0,
        total: 0,
      }
      return [...prev, aplicarForma(base, forma.id, 1)]
    })
  }, [])

  const alterarQtdFormas = useCallback((produtoId: string, qtd: number) => {
    setItens((prev) =>
      prev.map((i) => (i.produto_id === produtoId ? aplicarForma(i, i.formaId, qtd, i.precoForma) : i)),
    )
  }, [])

  const alterarForma = useCallback((produtoId: string, formaId: string) => {
    setItens((prev) =>
      prev.map((i) => (i.produto_id === produtoId ? aplicarForma(i, formaId, i.qtdFormas) : i)),
    )
  }, [])

  const alterarPrecoForma = useCallback((produtoId: string, preco: number) => {
    setItens((prev) =>
      prev.map((i) => (i.produto_id === produtoId ? aplicarForma(i, i.formaId, i.qtdFormas, preco) : i)),
    )
  }, [])

  const alterarFormaCustom = useCallback((produtoId: string, unidades: number) => {
    setItens((prev) =>
      prev.map((i) => {
        if (i.produto_id !== produtoId) return i
        const customId = `custom-${i.produto_id}`
        const unidadeBase = i.formas.find((f) => f.unidades === 1)
        const precoSugerido = +(unidades * (unidadeBase?.preco ?? i.preco_unitario)).toFixed(2)
        const jaCustom = i.formaId === customId
        const formaCustom = {
          id: customId,
          nome: `Pacote ${unidades}`,
          unidades,
          preco: jaCustom ? i.precoForma : precoSugerido,
          padrao: false,
        }
        const formas = [...i.formas.filter((f) => f.id !== customId), formaCustom]
        return aplicarForma({ ...i, formas }, customId, i.qtdFormas, formaCustom.preco)
      }),
    )
  }, [])

  const remover = useCallback((produtoId: string) => {
    setItens((prev) => prev.filter((i) => i.produto_id !== produtoId))
  }, [])

  const total = itens.reduce((acc, i) => acc + i.total, 0)

  function salvar() {
    if (itens.length === 0) {
      toast.error('A venda precisa ter pelo menos 1 item')
      return
    }
    startTransition(async () => {
      const resultado = await editarVenda(
        pedidoId,
        itens.map((i) => ({
          produto_id: i.produto_id,
          quantidade: i.quantidade,
          preco_unitario: i.preco_unitario,
          total: i.total,
          embalagem_nome: i.formas.find((f) => f.id === i.formaId)?.nome,
          embalagem_unidades: i.formas.find((f) => f.id === i.formaId)?.unidades,
        })),
      )
      if (resultado.error) {
        toast.error(resultado.error)
        return
      }
      toast.success(`Venda ${numeroFmt} atualizada.`)
      router.push(`/pedidos/${pedidoId}`)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-5 py-5">
      <div className="flex items-center gap-3">
        <Link
          href={`/pedidos/${pedidoId}`}
          className="u-motion flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text-muted hover:bg-surface-2 hover:text-text"
          aria-label="Voltar"
        >
          <ArrowLeft className="size-4" strokeWidth={1.5} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">
            Editar venda {numeroFmt}
          </h1>
          <p className="text-sm text-text-muted">
            Adicione, remova ou mude a quantidade dos itens.
          </p>
        </div>
      </div>

      <BuscaProduto onAdicionar={adicionarItem} />

      {itens.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text-muted">
          Nenhum item. Busque um produto acima pra adicionar.
        </p>
      ) : (
        <ListaItensPedido
          itens={itens}
          onAlterarQtdFormas={alterarQtdFormas}
          onAlterarForma={alterarForma}
          onAlterarPrecoForma={alterarPrecoForma}
          onAlterarFormaCustom={alterarFormaCustom}
          onRemover={remover}
        />
      )}

      <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
        <span className="text-sm font-semibold text-text">Total</span>
        <span className="text-lg font-bold text-text">{formatarReal(total)}</span>
      </div>

      <button
        type="button"
        onClick={salvar}
        disabled={salvando}
        className="u-motion inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-primary-foreground hover:bg-brand-strong disabled:pointer-events-none disabled:opacity-50"
      >
        {salvando ? (
          <Loader2 className="size-4 animate-spin" strokeWidth={2} />
        ) : (
          <Save className="size-4" strokeWidth={1.75} />
        )}
        Salvar alterações
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Verificar tipos e lint**

Run: `cd ~/Projects/Depsys && npx tsc --noEmit && npx eslint "app/(app)/pedidos/[id]/editar/page.tsx" components/pedido/EditarVendaForm.tsx --quiet`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/Depsys
git add "app/(app)/pedidos/[id]/editar/page.tsx" components/pedido/EditarVendaForm.tsx
git commit -m "feat: tela de editar itens de uma venda"
```

---

### Task 3: Botão "Editar" na tela do pedido

**Files:**
- Modify: `app/(app)/pedidos/[id]/page.tsx`

**Interfaces:**
- Consumes: `podeEditarPedido`, `caixaFechadoHoje` da Task 1.

**Nota de escopo:** só a tela de detalhe (`/pedidos/[id]`) ganha o botão
nesta task. A listagem `/pedidos` já existe mas só mostra pedidos de
entrega/retirada (não vendas de balcão) e paginaria mal um cálculo de
"caixa fechado" por linha — o acesso rápido pra editar fica pelo botão
aqui e pela seção nova do Dashboard (Task 4), que é o que foi pedido.

- [ ] **Step 1: Import e cálculo de elegibilidade**

Em `app/(app)/pedidos/[id]/page.tsx`, adicione o import:

```tsx
import { Pencil } from 'lucide-react'
```

(junto da importação já existente de ícones — troque a linha
`import { Printer, User, CalendarDays, CreditCard, StickyNote, Ban, Clock } from 'lucide-react'`
por
`import { Printer, User, CalendarDays, CreditCard, StickyNote, Ban, Clock, Pencil } from 'lucide-react'`)

E adicione:

```tsx
import { podeEditarPedido, caixaFechadoHoje } from '@/lib/actions/pedidos'
```

Dentro de `VendaDetailPage`, logo depois do bloco `const mostraAtribuir = ...` já existente, adicione:

```tsx
  const fechado = await caixaFechadoHoje(venda.local_id)
  const mostraEditar = podeEditarPedido(venda, fechado)
```

- [ ] **Step 2: Botão no cabeçalho**

Troque:

```tsx
        <Link
          href={`/pedidos/${venda.id}/romaneio`}
          className="u-motion inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text hover:bg-surface-2 active:scale-[0.98]"
        >
          <Printer className="size-4" strokeWidth={1.5} />
          Romaneio
        </Link>
        {!cancelada && (
          <BotaoCancelar pedidoId={venda.id} numero={numeroFmt} />
        )}
```

por:

```tsx
        <Link
          href={`/pedidos/${venda.id}/romaneio`}
          className="u-motion inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text hover:bg-surface-2 active:scale-[0.98]"
        >
          <Printer className="size-4" strokeWidth={1.5} />
          Romaneio
        </Link>
        {mostraEditar && (
          <Link
            href={`/pedidos/${venda.id}/editar`}
            className="u-motion inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text hover:bg-surface-2 active:scale-[0.98]"
          >
            <Pencil className="size-4" strokeWidth={1.5} />
            Editar
          </Link>
        )}
        {!cancelada && (
          <BotaoCancelar pedidoId={venda.id} numero={numeroFmt} />
        )}
```

- [ ] **Step 3: Verificar tipos e lint**

Run: `cd ~/Projects/Depsys && npx tsc --noEmit && npx eslint "app/(app)/pedidos/[id]/page.tsx" --quiet`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/Depsys
git add "app/(app)/pedidos/[id]/page.tsx"
git commit -m "feat: botao Editar na tela do pedido quando elegivel"
```

---

### Task 4: "Pedidos recentes" no Dashboard

**Files:**
- Modify: `lib/actions/pedidos.ts` (adiciona `listarPedidosRecentes`)
- Create: `components/dashboard/PedidosRecentes.tsx`
- Modify: `app/(app)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `podeEditarPedido`, `caixaFechadoHoje` da Task 1.
- Produces: `listarPedidosRecentes(limite?: number)`; `PedidosRecentes({ pedidos, editavel })`.

- [ ] **Step 1: `listarPedidosRecentes` em `lib/actions/pedidos.ts`**

No final do arquivo, adicione:

```ts
export type PedidoRecente = {
  id: string
  numero_pedido: number
  status: string
  total: number
  data_pedido: string
  concluido_em: string | null
  cliente_nome: string | null
}

export async function listarPedidosRecentes(limite = 5): Promise<PedidoRecente[]> {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, numero_pedido, status, total, data_pedido, concluido_em, clientes(nome)')
    .eq('local_id', localId)
    .order('data_pedido', { ascending: false })
    .limit(limite)
  if (error) throw error

  type Rel<T> = T | T[] | null
  const umaRel = <T,>(rel: Rel<T>): T | null => (Array.isArray(rel) ? (rel[0] ?? null) : rel)
  type Raw = Omit<PedidoRecente, 'cliente_nome'> & { clientes: Rel<{ nome: string }> }

  return ((data ?? []) as unknown as Raw[]).map((p) => ({
    ...p,
    cliente_nome: umaRel(p.clientes)?.nome ?? null,
  }))
}
```

- [ ] **Step 2: Componente `PedidosRecentes.tsx`**

Crie `components/dashboard/PedidosRecentes.tsx`:

```tsx
import Link from 'next/link'
import { Printer, Pencil } from 'lucide-react'
import { Money } from '@/components/ui-kit/Money'
import { StatusPill } from '@/components/ui-kit/StatusPill'
import { formatarData } from '@/lib/formatos'
import type { PedidoRecente } from '@/lib/actions/pedidos'

export function PedidosRecentes({
  pedidos,
  editaveis,
}: {
  pedidos: PedidoRecente[]
  /** ids dos pedidos que podem ser editados agora (ja calculado no servidor) */
  editaveis: Set<string>
}) {
  if (pedidos.length === 0) return null

  return (
    <div className="u-stagger mt-6 rounded-xl border border-border bg-surface p-5">
      <h2 className="mb-1 text-sm font-semibold tracking-tight text-text">
        Pedidos recentes
      </h2>
      <p className="mb-4 text-[11px] uppercase tracking-wider text-text-muted">
        Últimos {pedidos.length}
      </p>
      <div className="-mx-2 divide-y divide-border/60">
        {pedidos.map((p) => {
          const numeroFmt = `#${String(p.numero_pedido).padStart(4, '0')}`
          const cancelada = p.status === 'cancelada'
          return (
            <div key={p.id} className="flex items-center gap-3 px-2 py-3">
              <Link href={`/pedidos/${p.id}`} className="min-w-0 flex-1 hover:text-brand">
                <p className="truncate text-sm font-medium text-text">
                  {numeroFmt} · {p.cliente_nome ?? 'Venda de balcão'}
                </p>
                <p className="text-[13px] text-text-muted">{formatarData(p.data_pedido)}</p>
              </Link>
              <StatusPill status={cancelada ? 'critico' : 'ok'} label={cancelada ? 'Cancelada' : 'Concluída'} />
              <Money valor={p.total} destaque className="shrink-0 text-sm font-semibold" />
              <div className="flex shrink-0 items-center gap-1">
                <Link
                  href={`/pedidos/${p.id}/romaneio`}
                  className="u-motion flex size-8 items-center justify-center rounded-lg border border-border bg-surface text-text-muted hover:bg-surface-2 hover:text-text"
                  aria-label="Reimprimir"
                >
                  <Printer className="size-3.5" strokeWidth={1.5} />
                </Link>
                {editaveis.has(p.id) && (
                  <Link
                    href={`/pedidos/${p.id}/editar`}
                    className="u-motion flex size-8 items-center justify-center rounded-lg border border-border bg-surface text-text-muted hover:bg-surface-2 hover:text-text"
                    aria-label="Editar"
                  >
                    <Pencil className="size-3.5" strokeWidth={1.5} />
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Ligar no `app/(app)/dashboard/page.tsx`**

Adicione os imports:

```tsx
import { contarPedidosPendentes, listarPedidosRecentes, podeEditarPedido, caixaFechadoHoje } from '@/lib/actions/pedidos'
```

(substitui a linha `import { contarPedidosPendentes } from '@/lib/actions/pedidos'` já existente)

E:

```tsx
import { PedidosRecentes } from '@/components/dashboard/PedidosRecentes'
```

No `Promise.all` que já busca `stats`, `dre`, etc., adicione `listarPedidosRecentes()` e `caixaFechadoHoje(localId)`:

```tsx
  const [
    { data: pedidosHoje },
    { data: estoquesCriticos },
    { data: pedidosMes },
    stats,
    dre,
    resumoFiado,
    qtdPendentes,
    metaMes,
    pedidosRecentes,
    fechado,
  ] = await Promise.all([
    supabase.from('pedidos').select('total').gte('data_pedido', `${hoje}T00:00:00`).eq('status', 'concluida').eq('local_id', localId) as unknown as Promise<{ data: RowTotal[] }>,
    supabase.from('v_posicao_estoque').select('id').in('status_estoque', ['critico', 'ruptura']).eq('local_id', localId) as unknown as Promise<{ data: RowId[] }>,
    supabase.from('pedidos').select('data_pedido, total').gte('data_pedido', `${inicioMes}T00:00:00`).eq('status', 'concluida').eq('local_id', localId).order('data_pedido') as unknown as Promise<{ data: RowPedidoMes[] }>,
    getDashStats(),
    getDre(),
    buscarResumoFiado(),
    contarPedidosPendentes(),
    getMeta(),
    listarPedidosRecentes(),
    caixaFechadoHoje(localId),
  ])
```

Logo depois (antes do `return (`), adicione:

```tsx
  const editaveis = new Set(
    pedidosRecentes.filter((p) => podeEditarPedido(p, fechado)).map((p) => p.id),
  )
```

E, dentro do `return`, logo depois do bloco `{/* Gráfico (2/3) + acesso rápido (1/3) */}` (a `div` com `grid-cols-1 gap-6 lg:grid-cols-3`, que fecha com `</div>` antes do `</div>` final da página), adicione:

```tsx
      <PedidosRecentes pedidos={pedidosRecentes} editaveis={editaveis} />
```

(essa linha entra entre o fechamento daquele grid e o fechamento do
`<div className="px-6 py-5">` mais externo).

- [ ] **Step 4: Verificar tipos e lint**

Run: `cd ~/Projects/Depsys && npx tsc --noEmit && npx eslint lib/actions/pedidos.ts components/dashboard/PedidosRecentes.tsx "app/(app)/dashboard/page.tsx" --quiet`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/Depsys
git add lib/actions/pedidos.ts components/dashboard/PedidosRecentes.tsx "app/(app)/dashboard/page.tsx"
git commit -m "feat: secao de pedidos recentes no dashboard, com reimprimir e editar"
```

---

### Task 5: Build final, teste manual, limpeza e push

**Files:** nenhum arquivo novo — só verificação.

- [ ] **Step 1: Build de produção**

Run: `cd ~/Projects/Depsys && npx next build`
Expected: build conclui.

- [ ] **Step 2: Teste manual — editar venda à vista**

```bash
cd ~/Projects/Depsys && npm run dev
```

Logar com `sallesjoaquim111009@gmail.com` / `Deposito2026!`. Registrar
uma venda de teste com 1 produto (dinheiro). No Dashboard, confirmar que
ela aparece em "Pedidos recentes" com os botões Reimprimir e Editar.
Clicar Editar, adicionar um segundo produto, salvar. Conferir na tela do
pedido que o total bateu e que o estoque dos dois produtos reflete a
mudança (consultar `/estoque` ou via SQL).

- [ ] **Step 3: Teste manual — editar venda fiado**

Registrar uma segunda venda de teste, forma de pagamento fiado, com
cliente. Editar (tirar um item ou reduzir quantidade). Conferir em
`/financeiro/a-receber` que o valor da conta a receber acompanhou a
mudança.

- [ ] **Step 4: Teste manual — elegibilidade**

Tentar acessar `/pedidos/[id]/editar` de um pedido já cancelado ou de
outro dia (ex.: o pedido #1 de 05/07, usado em testes anteriores desta
sessão) — confirmar que dá 404 (página não encontrada), não erro feio.

- [ ] **Step 5: Limpar os pedidos de teste do banco**

Mesmo processo já usado nesta sessão: restaurar estoque via
`ajustar_estoque` (delta positivo pelas quantidades finais de cada
teste), apagar `pedido_itens`/`pedidos` (e a `contas_receber` do teste
fiado, se sobrar), tudo numa transação `BEGIN`/`COMMIT` via `node -e`
com `pg.Pool`.

- [ ] **Step 6: Push**

```bash
cd ~/Projects/Depsys
git push
```
