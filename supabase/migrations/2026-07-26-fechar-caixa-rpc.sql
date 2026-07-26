-- Achado ao vivo (testado no browser + confirmado via SQL direto, simulando
-- a role authenticated): depois da migration anterior
-- (2026-07-26-caixa-fechamentos-select-so-admin.sql), o upsert() que
-- fecharCaixa() fazia direto na tabela base
-- (INSERT ... ON CONFLICT (local_id, data) DO UPDATE) passou a falhar com
-- "new row violates row-level security policy" pra QUALQUER nao-admin --
-- inclusive no PRIMEIRO fechamento do dia, sem conflito real nenhum. Causa:
-- o Postgres precisa de visibilidade de SELECT pra sondar o indice unico do
-- ON CONFLICT, mesmo quando nao ha linha conflitante -- e a policy de
-- SELECT da tabela agora e is_admin()-only, entao um Funcionario nao tem
-- visibilidade nenhuma pra essa sondagem.
--
-- Nao da pra reabrir SELECT pra nao-admin (reabriria o vazamento de
-- esperado_*/diferenca que a migration anterior fechou -- RLS nao esconde
-- coluna, so linha). Fix: mesmo padrao ja documentado no CLAUDE.md pra
-- escrita privilegiada independente de quem chama (criar_convite,
-- resgatar_convite, ajustar_estoque) -- funcao security definer, que roda
-- como dona da tabela (RLS nao se aplica ao dono por padrao) e faz o
-- upsert por dentro, checando pode_acessar_local() explicitamente antes.

create or replace function public.fechar_caixa(
  p_local_id uuid,
  p_data date,
  p_dinheiro_contado numeric,
  p_esperado_dinheiro numeric,
  p_esperado_pix numeric,
  p_esperado_debito numeric,
  p_esperado_credito numeric,
  p_diferenca numeric,
  p_observacoes text
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null or not public.pode_acessar_local(p_local_id) then
    raise exception 'Sem permissao para fechar caixa desse local';
  end if;

  insert into public.caixa_fechamentos (
    local_id, data, dinheiro_contado, esperado_dinheiro, esperado_pix,
    esperado_debito, esperado_credito, diferenca, observacoes, fechado_por
  ) values (
    p_local_id, p_data, p_dinheiro_contado, p_esperado_dinheiro, p_esperado_pix,
    p_esperado_debito, p_esperado_credito, p_diferenca, p_observacoes, auth.uid()
  )
  on conflict (local_id, data) do update set
    dinheiro_contado = excluded.dinheiro_contado,
    esperado_dinheiro = excluded.esperado_dinheiro,
    esperado_pix = excluded.esperado_pix,
    esperado_debito = excluded.esperado_debito,
    esperado_credito = excluded.esperado_credito,
    diferenca = excluded.diferenca,
    observacoes = excluded.observacoes,
    fechado_por = excluded.fechado_por;
end;
$function$;

grant execute on function public.fechar_caixa(uuid, date, numeric, numeric, numeric, numeric, numeric, numeric, text) to authenticated;
