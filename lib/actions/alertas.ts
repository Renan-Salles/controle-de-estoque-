import { createServiceClient } from '@/lib/supabase/server'
import { hojeBrasil, addDias } from '@/lib/formatos'
import type { PosicaoEstoque } from '@/types'

export async function gerarAlertas() {
  const supabase = await createServiceClient()
  const erros: string[] = []

  const { data: criticosRaw } = await supabase
    .from('v_posicao_estoque')
    .select('*')
    .in('status_estoque', ['critico', 'ruptura'])
  const criticos = (criticosRaw ?? []) as unknown as PosicaoEstoque[]

  for (const p of criticos) {
    // resolvido: false explicito -- sem isso, um alerta ja marcado como
    // resolvido pelo usuario nunca reaparece mesmo se a condicao realmente
    // voltar (upsert em cima de um conflito so grava os campos passados,
    // resolvido antigo fica intacto).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('alertas') as any).upsert({
      tipo: 'ruptura_estoque',
      severidade: p.status_estoque === 'ruptura' ? 'critico' : 'aviso',
      titulo: `Estoque ${p.status_estoque === 'ruptura' ? 'zerado' : 'critico'}: ${p.nome}`,
      mensagem: `Saldo atual: ${p.saldo_atual} | Minimo: ${p.estoque_minimo}`,
      referencia_tipo: 'produto',
      referencia_id: p.id,
      resolvido: false,
    }, { onConflict: 'tipo,referencia_id' })
    if (error) erros.push(`ruptura_estoque ${p.id}: ${error.message}`)
  }

  // Contas a pagar vencidas e ainda não quitadas.
  const hoje = hojeBrasil()
  const { data: vencidas } = await supabase
    .from('contas_pagar')
    .select('id, descricao, valor')
    .in('status', ['aberto', 'vencido', 'parcial'])
    .lt('data_vencimento', hoje)
    .limit(50)

  for (const cp of (vencidas ?? []) as { id: string; descricao: string; valor: number | string }[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('alertas') as any).upsert({
      tipo: 'conta_vencida',
      severidade: 'aviso',
      titulo: `Conta vencida: ${cp.descricao}`,
      mensagem: `Valor: R$ ${Number(cp.valor).toFixed(2)} - pague para evitar juros`,
      referencia_tipo: 'conta_pagar',
      referencia_id: cp.id,
      resolvido: false,
    }, { onConflict: 'tipo,referencia_id' })
    if (error) erros.push(`conta_vencida ${cp.id}: ${error.message}`)
  }

  // Fiado (contas_receber) vencido ou vencendo nos próximos 3 dias.
  const em3dias = addDias(hoje, 3)
  const { data: fiados } = await supabase
    .from('contas_receber')
    .select('id, valor, valor_pago, data_vencimento, clientes(nome)')
    .in('status', ['aberto', 'parcial'])
    .lte('data_vencimento', em3dias)
    .limit(50)

  for (const f of (fiados ?? []) as {
    id: string
    valor: number | string
    valor_pago: number | string
    data_vencimento: string
    clientes: { nome: string } | { nome: string }[] | null
  }[]) {
    const vencido = f.data_vencimento < hoje
    const nomeCliente = (Array.isArray(f.clientes) ? f.clientes[0] : f.clientes)?.nome ?? 'Cliente'
    const saldo = Number(f.valor) - Number(f.valor_pago)
    const dataFmt = f.data_vencimento.split('-').reverse().join('/')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('alertas') as any).upsert({
      tipo: 'fiado_vencendo',
      severidade: vencido ? 'critico' : 'aviso',
      titulo: vencido ? `Fiado vencido: ${nomeCliente}` : `Fiado vence em breve: ${nomeCliente}`,
      mensagem: `Valor em aberto: R$ ${saldo.toFixed(2)} - vencimento ${dataFmt}`,
      referencia_tipo: 'conta_receber',
      referencia_id: f.id,
      resolvido: false,
    }, { onConflict: 'tipo,referencia_id' })
    if (error) erros.push(`fiado_vencendo ${f.id}: ${error.message}`)
  }

  return {
    ok: erros.length === 0,
    criticos: criticos?.length,
    vencidas: vencidas?.length,
    fiados: fiados?.length,
    erros: erros.length ? erros : undefined,
  }
}
