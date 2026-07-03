'use server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getLocalAtivoId } from '@/lib/local'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const ItensSchema = z
  .array(
    z.object({
      produto_id: z.string().uuid(),
      contado: z.number().min(0),
    }),
  )
  .min(1, 'Conte ao menos um produto')

// Conclui a contagem: pra cada item conferido, se divergir do saldo atual,
// ajusta o estoque (ajustar_estoque trava a linha) e registra movimentacao
// 'ajuste_inventario'. Grava cabecalho + itens pro historico.
export async function concluirInventario(input: unknown) {
  const parsed = ItensSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const localId = await getLocalAtivoId()
  const serviceClient = await createServiceClient()

  // Saldos atuais dos produtos conferidos (do local ativo, valida o vinculo).
  const ids = parsed.data.map((i) => i.produto_id)
  const { data: produtosRaw, error: errProd } = await supabase
    .from('produtos')
    .select('id, estoque(saldo_atual)')
    .eq('local_id', localId)
    .in('id', ids)
  if (errProd) return { error: errProd.message }

  type Rel<T> = T | T[] | null
  const umaRel = <T,>(rel: Rel<T>): T | null =>
    !rel ? null : Array.isArray(rel) ? (rel[0] ?? null) : rel
  const saldoPorProduto = new Map(
    ((produtosRaw ?? []) as unknown as { id: string; estoque: Rel<{ saldo_atual: number }> }[]).map(
      (p) => [p.id, Number(umaRel(p.estoque)?.saldo_atual ?? 0)],
    ),
  )

  const itens = parsed.data
    .filter((i) => saldoPorProduto.has(i.produto_id))
    .map((i) => ({
      produto_id: i.produto_id,
      esperado: saldoPorProduto.get(i.produto_id)!,
      contado: i.contado,
    }))
  if (itens.length === 0) return { error: 'Nenhum produto válido na contagem.' }

  const divergentes = itens.filter((i) => i.contado !== i.esperado)

  // Cabecalho primeiro (pro historico existir mesmo se um ajuste falhar no meio).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invRaw, error: errInv } = await (supabase.from('inventarios') as any)
    .insert({
      local_id: localId,
      realizado_por: user.id,
      itens_conferidos: itens.length,
      itens_divergentes: divergentes.length,
    })
    .select('id')
    .single()
  if (errInv) return { error: errInv.message }
  const inventarioId = (invRaw as { id: string }).id

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: errItens } = await (supabase.from('inventario_itens') as any).insert(
    itens.map((i) => ({ inventario_id: inventarioId, ...i })),
  )
  if (errItens) return { error: errItens.message }

  // Ajustes de saldo so nas divergencias.
  for (const item of divergentes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ajusteRaw, error: errAjuste } = await (serviceClient as any).rpc('ajustar_estoque', {
      p_produto_id: item.produto_id,
      p_novo_saldo: item.contado,
    })
    if (errAjuste) {
      return { error: `Ajuste falhou num produto: ${errAjuste.message}. Confira o histórico antes de recontar.` }
    }
    const ajuste = (ajusteRaw as { saldo_novo: number; custo_medio: number; delta_aplicado: number }[] | null)?.[0]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (serviceClient.from('movimentacoes_estoque') as any).insert({
      produto_id: item.produto_id,
      tipo: 'ajuste_inventario',
      quantidade: ajuste?.delta_aplicado ?? item.contado - item.esperado,
      custo_unitario: ajuste?.custo_medio ?? 0,
      saldo_apos: ajuste?.saldo_novo ?? item.contado,
      referencia_tipo: 'inventario',
      referencia_id: inventarioId,
      usuario_id: user.id,
    })
  }

  revalidatePath('/estoque')
  revalidatePath('/estoque/contagem')
  return {
    success: true as const,
    conferidos: itens.length,
    divergentes: divergentes.length,
  }
}

export type InventarioResumo = {
  id: string
  created_at: string
  itens_conferidos: number
  itens_divergentes: number
  realizado_por_nome: string | null
}

export async function listarInventarios(limite = 20): Promise<InventarioResumo[]> {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inventarios')
    .select('id, created_at, itens_conferidos, itens_divergentes, profiles(nome)')
    .eq('local_id', localId)
    .order('created_at', { ascending: false })
    .limit(limite)
  if (error) throw new Error(error.message)
  type Raw = Omit<InventarioResumo, 'realizado_por_nome'> & {
    profiles: { nome: string } | { nome: string }[] | null
  }
  return ((data ?? []) as unknown as Raw[]).map((i) => {
    const rel = Array.isArray(i.profiles) ? i.profiles[0] : i.profiles
    return { ...i, realizado_por_nome: rel?.nome ?? null }
  })
}
