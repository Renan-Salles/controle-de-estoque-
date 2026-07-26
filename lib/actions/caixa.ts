'use server'
import { createClient } from '@/lib/supabase/server'
import { getLocalAtivoId } from '@/lib/local'
import { hojeBrasil } from '@/lib/formatos'
import { somarPorForma } from '@/lib/pedido-labels'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCargoUsuario } from '@/lib/permissoes'

export type ResumoDia = {
  data: string
  dinheiro: number
  pix: number
  debito: number
  credito: number
  totalVendas: number
}

// Quanto entrou HOJE por forma de pagamento (vendas concluidas E pagas do
// local ativo). Frete incluso de proposito: caixa e dinheiro que entrou de
// verdade, nao faturamento de mercadoria.
export async function resumoDoDia(): Promise<ResumoDia> {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const hoje = hojeBrasil()

  const { data, error } = await supabase
    .from('pedidos')
    .select('forma_pagamento, total, pago, valor_secundario, forma_pagamento_secundaria')
    .eq('local_id', localId)
    .eq('status', 'concluida')
    .gte('data_pedido', `${hoje}T00:00:00-03:00`)
    .lte('data_pedido', `${hoje}T23:59:59.999-03:00`)
  if (error) throw new Error(error.message)

  type Linha = {
    forma_pagamento: string
    total: number
    pago: boolean
    valor_secundario: number | null
    forma_pagamento_secundaria: string | null
  }
  const rows = (data ?? []) as Linha[]
  const pagas = rows.filter((r) => r.pago)

  // somarPorForma ja trata o split: cada pedido entra com a fatia certa em
  // cada forma, e a perna fiado nunca soma em dinheiro/pix/cartao_* (nao e
  // dinheiro em caixa).
  const resumo = somarPorForma(pagas, ['dinheiro', 'pix', 'cartao_debito', 'cartao_credito'])
  const porForma = (f: string) => resumo.find((r) => r.forma === f)?.valor ?? 0

  return {
    data: hoje,
    dinheiro: porForma('dinheiro'),
    pix: porForma('pix'),
    debito: porForma('cartao_debito'),
    credito: porForma('cartao_credito'),
    totalVendas: pagas.length,
  }
}

const FecharSchema = z.object({
  dinheiro_contado: z.number().min(0),
  observacoes: z.string().optional(),
})

// Fecha o caixa de hoje: grava o snapshot do esperado por forma + a
// diferenca (contado - esperado em dinheiro). Upsert: refechar substitui.
export async function fecharCaixa(input: unknown) {
  const parsed = FecharSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const localId = await getLocalAtivoId()
  const resumo = await resumoDoDia()
  const diferenca = +(parsed.data.dinheiro_contado - resumo.dinheiro).toFixed(2)

  // Upsert direto na tabela (INSERT ... ON CONFLICT DO UPDATE) quebra com
  // RLS pra quem nao e admin desde que SELECT virou is_admin()-only
  // (2026-07-26-caixa-fechamentos-select-so-admin.sql): o Postgres precisa
  // de visibilidade de SELECT pra sondar o indice unico do ON CONFLICT,
  // mesmo sem conflito real -- confirmado ao vivo (ver
  // .superpowers/sdd/final-review-fixes-report.md, Grupo A). fechar_caixa()
  // e security definer (2026-07-26-fechar-caixa-rpc.sql): roda como dona da
  // tabela, ignorando RLS, checando pode_acessar_local() por dentro.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('fechar_caixa', {
    p_local_id: localId,
    p_data: resumo.data,
    p_dinheiro_contado: parsed.data.dinheiro_contado,
    p_esperado_dinheiro: resumo.dinheiro,
    p_esperado_pix: resumo.pix,
    p_esperado_debito: resumo.debito,
    p_esperado_credito: resumo.credito,
    p_diferenca: diferenca,
    p_observacoes: parsed.data.observacoes?.trim() || null,
  })
  if (error) return { error: error.message }

  revalidatePath('/caixa')
  const cargo = await getCargoUsuario()
  const podeVerEsperado = !cargo || cargo.admin
  return {
    success: true as const,
    comparativo: podeVerEsperado
      ? {
          totalVendas: resumo.totalVendas,
          dinheiro_contado: parsed.data.dinheiro_contado,
          dinheiro: resumo.dinheiro,
          pix: resumo.pix,
          debito: resumo.debito,
          credito: resumo.credito,
          diferenca,
        }
      : {
          totalVendas: resumo.totalVendas,
          dinheiro_contado: parsed.data.dinheiro_contado,
        },
  }
}

type FechamentoBase = {
  id: string
  data: string
  dinheiro_contado: number
  observacoes: string | null
  created_at: string
  fechado_por_nome: string | null
}

export type Fechamento =
  | FechamentoBase
  | (FechamentoBase & {
      esperado_dinheiro: number
      esperado_pix: number
      esperado_debito: number
      esperado_credito: number
      diferenca: number
    })

export async function listarFechamentos(limite = 30): Promise<Fechamento[]> {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const cargo = await getCargoUsuario()
  const podeVerEsperado = !cargo || cargo.admin

  // Nao-admin: a policy de SELECT da tabela base agora e is_admin()-only
  // (2026-07-26-caixa-fechamentos-select-so-admin.sql) -- consultar a tabela
  // direto devolveria 0 linhas. A RPC listar_fechamentos_publico (security
  // definer) devolve so as colunas seguras, ja com o nome de quem fechou.
  if (!podeVerEsperado) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('listar_fechamentos_publico', {
      p_local_id: localId,
      p_limite: limite,
    })
    if (error) throw new Error(error.message)
    type RawPublico = {
      id: string
      data: string
      dinheiro_contado: number
      observacoes: string | null
      fechado_por_nome: string | null
      created_at: string
    }
    return ((data ?? []) as RawPublico[]).map((f) => ({
      id: f.id,
      data: f.data,
      dinheiro_contado: f.dinheiro_contado,
      observacoes: f.observacoes,
      created_at: f.created_at,
      fechado_por_nome: f.fechado_por_nome,
    }))
  }

  const { data, error } = await supabase
    .from('caixa_fechamentos')
    .select('id, data, dinheiro_contado, esperado_dinheiro, esperado_pix, esperado_debito, esperado_credito, diferenca, observacoes, created_at, profiles(nome)')
    .eq('local_id', localId)
    .order('data', { ascending: false })
    .limit(limite)
  if (error) throw new Error(error.message)

  type Raw = {
    id: string
    data: string
    dinheiro_contado: number
    esperado_dinheiro: number
    esperado_pix: number
    esperado_debito: number
    esperado_credito: number
    diferenca: number
    observacoes: string | null
    created_at: string
    profiles: { nome: string } | { nome: string }[] | null
  }
  return ((data ?? []) as unknown as Raw[]).map((f) => {
    const rel = Array.isArray(f.profiles) ? f.profiles[0] : f.profiles
    return {
      id: f.id,
      data: f.data,
      dinheiro_contado: f.dinheiro_contado,
      observacoes: f.observacoes,
      created_at: f.created_at,
      fechado_por_nome: rel?.nome ?? null,
      esperado_dinheiro: f.esperado_dinheiro,
      esperado_pix: f.esperado_pix,
      esperado_debito: f.esperado_debito,
      esperado_credito: f.esperado_credito,
      diferenca: f.diferenca,
    }
  })
}

// Ja fechou o caixa de hoje? (pro aviso de substituicao na tela)
export async function fechamentoDeHoje(): Promise<Fechamento | null> {
  const lista = await listarFechamentos(1)
  return lista[0]?.data === hojeBrasil() ? lista[0] : null
}
