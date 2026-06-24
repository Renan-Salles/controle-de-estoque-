'use server'
import { createClient } from '@/lib/supabase/server'
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

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from('produtos').insert(parsed.data as any)
  if (error) return { error: error.message }

  revalidatePath('/produtos')
  return { success: true }
}

export async function buscarProdutos(termo?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('produtos')
    .select('id, nome, marca, preco_venda_padrao, embalagem, categorias(nome), estoque(saldo_atual)')
    .eq('ativo', true)
    .order('nome')

  if (termo) query = query.ilike('nome', `%${termo}%`)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function buscarPosicaoProdutos(termo?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('v_posicao_estoque')
    .select('*')
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
