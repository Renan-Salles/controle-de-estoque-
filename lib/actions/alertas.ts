import { createServiceClient } from '@/lib/supabase/server'

export async function gerarAlertas() {
  const supabase = await createServiceClient()

  const { data: criticos } = await supabase
    .from('v_posicao_estoque')
    .select('*')
    .in('status_estoque', ['critico', 'ruptura'])

  for (const p of criticos ?? []) {
    await supabase.from('alertas').upsert({
      tipo: 'ruptura_estoque',
      severidade: p.status_estoque === 'ruptura' ? 'critico' : 'aviso',
      titulo: `Estoque ${p.status_estoque === 'ruptura' ? 'zerado' : 'critico'}: ${p.nome}`,
      mensagem: `Saldo atual: ${p.saldo_atual} | Minimo: ${p.estoque_minimo}`,
      referencia_tipo: 'produto',
      referencia_id: p.id,
    }, { onConflict: 'tipo,referencia_id' })
  }

  const { data: vencidas } = await supabase
    .from('contas_receber')
    .select('id, valor, clientes(nome)')
    .eq('status', 'aberto')
    .lt('data_vencimento', new Date().toISOString().split('T')[0])
    .limit(50)

  for (const cr of vencidas ?? []) {
    await supabase.from('alertas').upsert({
      tipo: 'inadimplencia',
      severidade: 'aviso',
      titulo: `Cobranca pendente: ${(cr.clientes as { nome: string } | null)?.nome}`,
      mensagem: `Valor: R$ ${cr.valor.toFixed(2)} - vencido`,
      referencia_tipo: 'conta_receber',
      referencia_id: cr.id,
    }, { onConflict: 'tipo,referencia_id' })
  }

  return { ok: true, criticos: criticos?.length, vencidas: vencidas?.length }
}
