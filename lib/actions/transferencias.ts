'use server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getLocalAtivoId, listarLocais } from '@/lib/local'
import { getCargoUsuario } from '@/lib/permissoes'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Dados pro dialog de transferencia: sou admin? quais os outros locais?
export async function dadosTransferencia() {
  const cargo = await getCargoUsuario()
  const admin = !cargo || cargo.admin // fail-open igual ao resto do app
  if (!admin) return { admin: false as const, destinos: [] }
  const localAtivo = await getLocalAtivoId()
  const locais = await listarLocais()
  return {
    admin: true as const,
    destinos: locais.filter((l) => l.id !== localAtivo).map((l) => ({ id: l.id, nome: l.nome })),
  }
}

const TransferirSchema = z.object({
  produto_id: z.string().uuid(),
  quantidade: z.number().positive('Quantidade precisa ser maior que zero'),
  destino_local_id: z.string().uuid(),
})

// Transfere estoque entre locais. Ordem: valida tudo -> baixa origem ->
// entrada destino. Se a entrada no destino falhar, devolve a origem e
// reporta (sem transacao distribuida via PostgREST; janela minima).
export async function transferirProduto(input: unknown) {
  const parsed = TransferirSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const cargo = await getCargoUsuario()
  if (cargo && !cargo.admin) return { error: 'Só administrador transfere estoque entre locais.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const origemLocalId = await getLocalAtivoId()
  const { produto_id, quantidade, destino_local_id } = parsed.data
  if (destino_local_id === origemLocalId) return { error: 'Destino é o mesmo local de origem.' }

  const service = await createServiceClient()

  // Produto de origem (do local ativo) + saldo + custo medio.
  const { data: origemRaw, error: errOrigem } = await service
    .from('produtos')
    .select('id, nome, marca, categoria_id, embalagem, fator_conversao, volume_ml, preco_venda_padrao, custo_atual, margem_alvo_pct, estoque_minimo, codigo_barras, estoque(saldo_atual, custo_medio)')
    .eq('id', produto_id)
    .eq('local_id', origemLocalId)
    .single()
  if (errOrigem || !origemRaw) return { error: 'Produto não encontrado neste local.' }
  type Rel<T> = T | T[] | null
  const umaRel = <T,>(rel: Rel<T>): T | null =>
    !rel ? null : Array.isArray(rel) ? (rel[0] ?? null) : rel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const origem = origemRaw as any
  const saldoOrigem = Number(umaRel<{ saldo_atual: number }>(origem.estoque)?.saldo_atual ?? 0)
  const custoMedio = Number(
    umaRel<{ custo_medio: number }>(origem.estoque)?.custo_medio ?? origem.custo_atual ?? 0,
  )
  if (saldoOrigem < quantidade) {
    return { error: `Saldo insuficiente: tem ${saldoOrigem}, e a transferência pede ${quantidade}.` }
  }

  // Produto no destino: mesmo NOME (exato, case-insensitive); clona se faltar.
  const { data: destExistente } = await service
    .from('produtos')
    .select('id')
    .eq('local_id', destino_local_id)
    .ilike('nome', origem.nome)
    .limit(1)
    .maybeSingle()

  let produtoDestinoId = (destExistente as { id: string } | null)?.id ?? null
  if (!produtoDestinoId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: clonado, error: errClone } = await (service.from('produtos') as any)
      .insert({
        nome: origem.nome,
        marca: origem.marca,
        categoria_id: origem.categoria_id,
        embalagem: origem.embalagem,
        fator_conversao: origem.fator_conversao,
        volume_ml: origem.volume_ml,
        preco_venda_padrao: origem.preco_venda_padrao,
        custo_atual: origem.custo_atual,
        margem_alvo_pct: origem.margem_alvo_pct,
        estoque_minimo: origem.estoque_minimo,
        codigo_barras: origem.codigo_barras,
        local_id: destino_local_id,
      })
      .select('id')
      .single()
    if (errClone) return { error: `Não foi possível criar o produto no destino: ${errClone.message}` }
    produtoDestinoId = (clonado as { id: string }).id

    // Clona tambem as formas de venda.
    const { data: embalagens } = await service
      .from('produto_embalagens')
      .select('nome, unidades, preco, padrao')
      .eq('produto_id', produto_id)
    if (embalagens && embalagens.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (service.from('produto_embalagens') as any).insert(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (embalagens as any[]).map((e) => ({ ...e, produto_id: produtoDestinoId })),
      )
    }
  }

  // Baixa na origem.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: errBaixa } = await (service as any).rpc('ajustar_estoque', {
    p_produto_id: produto_id,
    p_delta: -quantidade,
  })
  if (errBaixa) return { error: `Falha na baixa de origem: ${errBaixa.message}` }

  // Entrada no destino (com o custo medio da origem).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: errEntrada } = await (service as any).rpc('ajustar_estoque', {
    p_produto_id: produtoDestinoId,
    p_delta: quantidade,
    p_novo_custo_unitario: custoMedio,
  })
  if (errEntrada) {
    // devolve a origem pra nao sumir estoque
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).rpc('ajustar_estoque', { p_produto_id: produto_id, p_delta: quantidade })
    return { error: `Falha na entrada do destino (origem devolvida): ${errEntrada.message}` }
  }

  // Registro da transferencia + movimentacoes dos dois lados.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: transfRaw } = await (service.from('transferencias') as any)
    .insert({
      produto_origem_id: produto_id,
      produto_destino_id: produtoDestinoId,
      local_origem_id: origemLocalId,
      local_destino_id: destino_local_id,
      quantidade,
      realizado_por: user.id,
    })
    .select('id')
    .single()
  const transfId = (transfRaw as { id: string } | null)?.id ?? null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (service.from('movimentacoes_estoque') as any).insert([
    {
      produto_id,
      tipo: 'transferencia_saida',
      quantidade: -quantidade,
      custo_unitario: custoMedio,
      saldo_apos: saldoOrigem - quantidade,
      referencia_tipo: 'transferencia',
      referencia_id: transfId,
      usuario_id: user.id,
    },
    {
      produto_id: produtoDestinoId,
      tipo: 'transferencia_entrada',
      quantidade,
      custo_unitario: custoMedio,
      referencia_tipo: 'transferencia',
      referencia_id: transfId,
      usuario_id: user.id,
    },
  ])

  revalidatePath('/estoque')
  return { success: true as const }
}

export type TransferenciaResumo = {
  id: string
  quantidade: number
  created_at: string
  produto_nome: string
  origem_nome: string
  destino_nome: string
}

export async function listarTransferencias(limite = 10): Promise<TransferenciaResumo[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('transferencias')
    .select('id, quantidade, created_at, produtos!transferencias_produto_origem_id_fkey(nome), origem:locais!transferencias_local_origem_id_fkey(nome), destino:locais!transferencias_local_destino_id_fkey(nome)')
    .order('created_at', { ascending: false })
    .limit(limite)
  if (error) throw new Error(error.message)
  type Rel<T> = T | T[] | null
  const umaRel = <T,>(rel: Rel<T>): T | null =>
    !rel ? null : Array.isArray(rel) ? (rel[0] ?? null) : rel
  type Raw = {
    id: string
    quantidade: number
    created_at: string
    produtos: Rel<{ nome: string }>
    origem: Rel<{ nome: string }>
    destino: Rel<{ nome: string }>
  }
  return ((data ?? []) as unknown as Raw[]).map((t) => ({
    id: t.id,
    quantidade: Number(t.quantidade),
    created_at: t.created_at,
    produto_nome: umaRel(t.produtos)?.nome ?? '?',
    origem_nome: umaRel(t.origem)?.nome ?? '?',
    destino_nome: umaRel(t.destino)?.nome ?? '?',
  }))
}
