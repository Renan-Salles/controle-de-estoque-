import { createServiceClient } from '@/lib/supabase/server'
import type { PosicaoEstoque } from '@/types'

export async function gerarAlertas() {
  const supabase = await createServiceClient()

  const { data: criticosRaw } = await supabase
    .from('v_posicao_estoque')
    .select('*')
    .in('status_estoque', ['critico', 'ruptura'])
  const criticos = (criticosRaw ?? []) as unknown as PosicaoEstoque[]

  for (const p of criticos) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('alertas') as any).upsert({
      tipo: 'ruptura_estoque',
      severidade: p.status_estoque === 'ruptura' ? 'critico' : 'aviso',
      titulo: `Estoque ${p.status_estoque === 'ruptura' ? 'zerado' : 'critico'}: ${p.nome}`,
      mensagem: `Saldo atual: ${p.saldo_atual} | Minimo: ${p.estoque_minimo}`,
      referencia_tipo: 'produto',
      referencia_id: p.id,
    }, { onConflict: 'tipo,referencia_id' })
  }

  // Contas a pagar vencidas e ainda não quitadas (sem fiado, não há mais a receber).
  const { data: vencidas } = await supabase
    .from('contas_pagar')
    .select('id, descricao, valor')
    .in('status', ['aberto', 'vencido', 'parcial'])
    .lt('data_vencimento', new Date().toISOString().split('T')[0])
    .limit(50)

  for (const cp of (vencidas ?? []) as { id: string; descricao: string; valor: number | string }[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('alertas') as any).upsert({
      tipo: 'conta_vencida',
      severidade: 'aviso',
      titulo: `Conta vencida: ${cp.descricao}`,
      mensagem: `Valor: R$ ${Number(cp.valor).toFixed(2)} - pague para evitar juros`,
      referencia_tipo: 'conta_pagar',
      referencia_id: cp.id,
    }, { onConflict: 'tipo,referencia_id' })
  }

  return { ok: true, criticos: criticos?.length, vencidas: vencidas?.length }
}
