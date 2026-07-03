'use server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getLocalAtivoId } from '@/lib/local'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const EntradaItemSchema = z.object({
  produto_id: z.string().uuid(),
  quantidade: z.number().positive(),
  custo_unitario: z.number().min(0),
  // Validade do lote comprado (opcional): alimenta o aviso de "vencendo".
  validade: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

const EntradaSchema = z.object({
  fornecedor_nome: z.string().optional(),
  observacoes: z.string().optional(),
  itens: z.array(EntradaItemSchema).min(1, 'Adicione pelo menos 1 item'),
})

// Registra uma ENTRADA (compra de estoque): aumenta saldo e recalcula custo medio
// ponderado de cada item. Agrupa os itens por um id de lote.
export async function registrarEntrada(data: unknown) {
  const parsed = EntradaSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nao autenticado' }

  const service = await createServiceClient()
  const lote = crypto.randomUUID()
  const obs = parsed.data.fornecedor_nome
    ? `Compra: ${parsed.data.fornecedor_nome}`
    : parsed.data.observacoes || 'Compra de mercadoria'

  for (const item of parsed.data.itens) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ajusteRaw, error: errAjuste } = await (service as any).rpc('ajustar_estoque', {
      p_produto_id: item.produto_id,
      p_delta: item.quantidade,
      p_novo_custo_unitario: item.custo_unitario,
    })
    if (errAjuste) return { error: `Falha ao dar entrada no estoque: ${errAjuste.message}` }
    const ajuste = (ajusteRaw as { saldo_novo: number; custo_medio: number }[] | null)?.[0]
    const novoSaldo = ajuste?.saldo_novo ?? 0
    const novoCusto = ajuste?.custo_medio ?? item.custo_unitario

    // Preço de venda ainda em aberto (0) e o dono já deixou uma margem alvo:
    // sugere o preço agora que o custo real chegou. Nunca mexe se já tem
    // preço definido — quem manda no preço é o dono, isso só preenche o vazio.
    const { data: prod } = await service
      .from('produtos')
      .select('preco_venda_padrao, margem_alvo_pct')
      .eq('id', item.produto_id)
      .single()
    const produtoInfo = prod as { preco_venda_padrao: number; margem_alvo_pct: number | null } | null
    if (produtoInfo && Number(produtoInfo.preco_venda_padrao) === 0 && produtoInfo.margem_alvo_pct) {
      const precoSugerido = Math.round(novoCusto * (1 + Number(produtoInfo.margem_alvo_pct) / 100) * 100) / 100
      const { error: errPreco } = await (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        service.from('produtos') as any
      )
        .update({ preco_venda_padrao: precoSugerido })
        .eq('id', item.produto_id)
      if (errPreco) return { error: `Entrada registrada, mas não foi possível sugerir o preço: ${errPreco.message}` }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service.from('movimentacoes_estoque') as any).insert({
      produto_id: item.produto_id,
      tipo: 'entrada_compra',
      quantidade: item.quantidade,
      custo_unitario: item.custo_unitario,
      saldo_apos: novoSaldo,
      referencia_tipo: 'entrada',
      referencia_id: lote,
      usuario_id: user.id,
      observacao: obs,
      validade: item.validade ?? null,
    })
  }

  revalidatePath('/movimentacoes')
  revalidatePath('/estoque')
  revalidatePath('/dashboard')
  revalidatePath('/produtos')
  return { success: true }
}

// Histórico unificado: vendas (saidas) + entradas (compras de estoque).
export async function listarMovimentacoes() {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const [{ data: vendas }, { data: entradas }] = await Promise.all([
    supabase
      .from('pedidos')
      .select('id, numero_pedido, total, data_pedido, forma_pagamento, status, tipo_fulfillment, concluido_em, clientes(nome)')
      .eq('local_id', localId)
      .order('data_pedido', { ascending: false })
      .limit(150),
    supabase
      .from('movimentacoes_estoque')
      .select('id, quantidade, custo_unitario, created_at, observacao, produtos!inner(nome, local_id)')
      .eq('tipo', 'entrada_compra')
      .eq('produtos.local_id', localId)
      .order('created_at', { ascending: false })
      .limit(150),
  ])
  return { vendas: vendas ?? [], entradas: entradas ?? [] }
}
