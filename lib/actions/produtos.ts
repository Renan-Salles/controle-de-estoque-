'use server'
import { createClient } from '@/lib/supabase/server'
import { getLocalAtivoId } from '@/lib/local'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const ProdutoSchema = z.object({
  nome: z.string().min(2, 'Nome obrigatorio'),
  marca: z.string().optional(),
  categoria_id: z.string().uuid('Categoria obrigatoria'),
  embalagem: z.enum(['unidade', 'fardo', 'caixa', 'grade', 'pack']),
  volume_ml: z.number().optional(),
  preco_venda_padrao: z.number().min(0),
  custo_atual: z.number().min(0),
  estoque_minimo: z.number().min(0).default(0),
  codigo_barras: z.string().optional(),
})

export async function criarProduto(data: Record<string, unknown>) {
  const parsed = ProdutoSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from('produtos').insert({ ...parsed.data, local_id: localId } as any)
  if (error) return { error: error.message }

  revalidatePath('/produtos')
  return { success: true }
}

export async function buscarProdutos(termo?: string) {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  let query = supabase
    .from('produtos')
    .select('id, nome, marca, preco_venda_padrao, embalagem, categorias(nome), estoque(saldo_atual)')
    .eq('ativo', true)
    .eq('local_id', localId)
    .order('nome')

  if (termo) query = query.ilike('nome', `%${termo}%`)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function buscarPosicaoProdutos(termo?: string) {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  let query = supabase
    .from('v_posicao_estoque')
    .select('*')
    .eq('local_id', localId)
    .order('categoria')
    .order('nome')

  if (termo) query = query.ilike('nome', `%${termo}%`)
  const { data, error } = await query as {
    data: import('@/types/database.types').Database['public']['Views']['v_posicao_estoque']['Row'][] | null
    error: { message: string } | null
  }
  if (error) throw new Error(error.message)
  return data ?? []
}

// Atalho do PDV: top ~8 produtos mais vendidos do local ativo nos ultimos 30 dias.
// Soma quantidade_pedida dos itens de vendas concluidas, junta produto + saldo.
export type MaisVendido = {
  id: string
  nome: string
  categoria: string
  preco_venda_padrao: number
  saldo_atual: number
}

export async function buscarMaisVendidos(): Promise<MaisVendido[]> {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('pedido_itens')
    .select(
      'produto_id, quantidade_pedida, pedidos!inner(status, data_pedido, local_id), produtos!inner(id, nome, ativo, preco_venda_padrao, local_id, categorias(nome), estoque(saldo_atual))',
    )
    .eq('pedidos.status', 'concluida')
    .eq('pedidos.local_id', localId)
    .eq('produtos.local_id', localId)
    .eq('produtos.ativo', true)
    .gte('pedidos.data_pedido', desde)

  if (error) throw new Error(error.message)

  type Rel<T> = T | T[] | null
  type Linha = {
    produto_id: string
    quantidade_pedida: number
    produtos: Rel<{
      id: string
      nome: string
      preco_venda_padrao: number
      categorias: Rel<{ nome: string }>
      estoque: Rel<{ saldo_atual: number }>
    }>
  }
  const umaRel = <T,>(rel: Rel<T>): T | null =>
    !rel ? null : Array.isArray(rel) ? (rel[0] ?? null) : rel

  const acc = new Map<string, { qtde: number; produto: MaisVendido }>()
  for (const linha of (data ?? []) as unknown as Linha[]) {
    const prod = umaRel(linha.produtos)
    if (!prod) continue
    const atual = acc.get(linha.produto_id)
    if (atual) {
      atual.qtde += linha.quantidade_pedida
    } else {
      acc.set(linha.produto_id, {
        qtde: linha.quantidade_pedida,
        produto: {
          id: prod.id,
          nome: prod.nome,
          categoria: umaRel(prod.categorias)?.nome ?? '',
          preco_venda_padrao: prod.preco_venda_padrao,
          saldo_atual: umaRel(prod.estoque)?.saldo_atual ?? 0,
        },
      })
    }
  }

  return Array.from(acc.values())
    .sort((a, b) => b.qtde - a.qtde)
    .slice(0, 8)
    .map((e) => e.produto)
}

export async function listarCategorias() {
  const supabase = await createClient()
  const { data } = await supabase.from('categorias').select('id, nome').eq('ativo', true).order('ordem')
  return data ?? []
}

export async function buscarProdutoPorId(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('produtos')
    .select(
      'id, nome, marca, codigo_barras, categoria_id, embalagem, volume_ml, preco_venda_padrao, custo_atual, estoque_minimo, ativo',
    )
    .eq('id', id)
    .single() as {
    data: {
      id: string
      nome: string
      marca: string | null
      codigo_barras: string | null
      categoria_id: string
      embalagem: string
      volume_ml: number | null
      preco_venda_padrao: number
      custo_atual: number
      estoque_minimo: number
      ativo: boolean
    } | null
  }
  return data
}

export async function atualizarProduto(id: string, data: Record<string, unknown>) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('produtos') as any).update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/produtos')
  return { success: true }
}
