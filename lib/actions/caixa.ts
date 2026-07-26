'use server'
import { createClient } from '@/lib/supabase/server'
import { getLocalAtivoId } from '@/lib/local'
import { hojeBrasil } from '@/lib/formatos'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCargoUsuario } from '@/lib/permissoes'

const FecharSchema = z.object({
  dinheiro_contado: z.number().min(0),
  observacoes: z.string().optional(),
})

// Campos prefixados com "r_": nome de saida do RPC fechar_caixa (ver
// 2026-07-26-fechar-caixa-recomputa-servidor.sql -- prefixo evita colisao
// de nome entre OUT param e coluna de caixa_fechamentos dentro da funcao).
type FecharCaixaRow = {
  r_data: string
  r_dinheiro_contado: number
  r_esperado_dinheiro: number
  r_esperado_pix: number
  r_esperado_debito: number
  r_esperado_credito: number
  r_diferenca: number
  r_total_vendas: number
}

// Fecha o caixa de hoje: grava o snapshot do esperado por forma + a
// diferenca (contado - esperado em dinheiro). Upsert: refechar substitui.
//
// esperado_*/diferenca NAO sao mais calculados aqui em JS -- eram passados
// pro RPC como parametros confiando no cliente, o que permitia forjar um
// fechamento com qualquer numero via chamada direta a
// POST /rest/v1/rpc/fechar_caixa (achado critico, ver
// .superpowers/sdd/final-review-fixes-round2-report.md). fechar_caixa()
// agora recalcula tudo no servidor a partir de public.pedidos e trava a
// data em current_date do proprio banco -- so p_local_id/
// p_dinheiro_contado/p_observacoes sao informados por quem chama (ver
// 2026-07-26-fechar-caixa-recomputa-servidor.sql).
export async function fecharCaixa(input: unknown) {
  const parsed = FecharSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const localId = await getLocalAtivoId()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rpcData, error } = await (supabase as any).rpc('fechar_caixa', {
    p_local_id: localId,
    p_dinheiro_contado: parsed.data.dinheiro_contado,
    p_observacoes: parsed.data.observacoes?.trim() || null,
  })
  if (error) return { error: error.message }

  const linha = (rpcData as FecharCaixaRow[] | null)?.[0]
  if (!linha) return { error: 'Falha ao fechar o caixa' }

  revalidatePath('/caixa')
  const cargo = await getCargoUsuario()
  const podeVerEsperado = !cargo || cargo.admin
  return {
    success: true as const,
    comparativo: podeVerEsperado
      ? {
          totalVendas: linha.r_total_vendas,
          dinheiro_contado: linha.r_dinheiro_contado,
          dinheiro: linha.r_esperado_dinheiro,
          pix: linha.r_esperado_pix,
          debito: linha.r_esperado_debito,
          credito: linha.r_esperado_credito,
          diferenca: linha.r_diferenca,
        }
      : {
          totalVendas: linha.r_total_vendas,
          dinheiro_contado: linha.r_dinheiro_contado,
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
