'use server'
import { createClient } from '@/lib/supabase/server'
import { getLocalAtivoId } from '@/lib/local'
import { hojeBrasil } from '@/lib/formatos'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

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

  // Vendas totalmente a vista e pagas (comportamento de sempre) + a fatia
  // paga na hora de vendas fiado parciais (forma_pagamento_secundaria), que
  // entram no caixa mesmo com forma_pagamento = 'fiado' e pago = false.
  const soma = (forma: string) =>
    rows.filter((r) => r.pago && r.forma_pagamento === forma).reduce((a, r) => a + Number(r.total ?? 0), 0) +
    rows
      .filter((r) => r.forma_pagamento === 'fiado' && r.forma_pagamento_secundaria === forma)
      .reduce((a, r) => a + Number(r.valor_secundario ?? 0), 0)

  const totalVendas = rows.filter((r) => r.pago).length

  return {
    data: hoje,
    dinheiro: soma('dinheiro'),
    pix: soma('pix'),
    debito: soma('cartao_debito'),
    credito: soma('cartao_credito'),
    totalVendas,
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('caixa_fechamentos') as any).upsert(
    {
      local_id: localId,
      data: resumo.data,
      dinheiro_contado: parsed.data.dinheiro_contado,
      esperado_dinheiro: resumo.dinheiro,
      esperado_pix: resumo.pix,
      esperado_debito: resumo.debito,
      esperado_credito: resumo.credito,
      diferenca,
      observacoes: parsed.data.observacoes?.trim() || null,
      fechado_por: user.id,
    },
    { onConflict: 'local_id,data' },
  )
  if (error) return { error: error.message }

  revalidatePath('/caixa')
  return {
    success: true as const,
    comparativo: {
      ...resumo,
      dinheiro_contado: parsed.data.dinheiro_contado,
      diferenca,
    },
  }
}

export type Fechamento = {
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
  fechado_por_nome: string | null
}

export async function listarFechamentos(limite = 30): Promise<Fechamento[]> {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('caixa_fechamentos')
    .select('id, data, dinheiro_contado, esperado_dinheiro, esperado_pix, esperado_debito, esperado_credito, diferenca, observacoes, created_at, profiles(nome)')
    .eq('local_id', localId)
    .order('data', { ascending: false })
    .limit(limite)
  if (error) throw new Error(error.message)
  type Raw = Omit<Fechamento, 'fechado_por_nome'> & { profiles: { nome: string } | { nome: string }[] | null }
  return ((data ?? []) as unknown as Raw[]).map((f) => {
    const rel = Array.isArray(f.profiles) ? f.profiles[0] : f.profiles
    return { ...f, fechado_por_nome: rel?.nome ?? null }
  })
}

// Ja fechou o caixa de hoje? (pro aviso de substituicao na tela)
export async function fechamentoDeHoje(): Promise<Fechamento | null> {
  const lista = await listarFechamentos(1)
  return lista[0]?.data === hojeBrasil() ? lista[0] : null
}
