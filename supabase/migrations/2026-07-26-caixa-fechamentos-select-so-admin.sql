-- caixa_fechamentos tinha uma unica policy "for all" (autenticado + local),
-- sem checagem de cargo. A redacao de esperado_*/diferenca da Task 3 e so na
-- server action (lib/actions/caixa.ts) -- um Funcionario logado conseguia
-- pegar os valores reais direto via REST API
-- (GET /rest/v1/caixa_fechamentos?select=esperado_dinheiro,diferenca),
-- contornando a app inteira. Mesma classe de bug ja corrigida em
-- contas_pagar (2026-07-25-corrige-policy-contas-pagar.sql).
--
-- Fix: separa a policy unica em 3 -- INSERT/UPDATE continuam abertos pra
-- autenticado+local (o funcionario precisa gravar o fechamento dele todo
-- dia, upsert por conflito local+data), SELECT na tabela base vira
-- is_admin()-only (mesmo padrao de "admin ve contas pagar",
-- 009_fix_rls_recursion.sql). Pra nao-admin nao perder a tabela
-- "Fechamentos anteriores" (Task 3 deliberadamente manteve ela visivel, so
-- sem esperado/diferenca), ganha uma RPC security definer que devolve
-- so as colunas seguras (nunca esperado_*/diferenca).

drop policy if exists "caixa por local" on public.caixa_fechamentos;

create policy "caixa insere por local" on public.caixa_fechamentos
  for insert
  with check (auth.uid() is not null and public.pode_acessar_local(local_id));

create policy "caixa atualiza por local" on public.caixa_fechamentos
  for update
  using (auth.uid() is not null and public.pode_acessar_local(local_id))
  with check (auth.uid() is not null and public.pode_acessar_local(local_id));

create policy "admin ve caixa fechamentos" on public.caixa_fechamentos
  for select
  using (public.is_admin());

-- Historico "as cegas" pra quem nao e admin: so as colunas seguras, nunca
-- esperado_dinheiro/esperado_pix/esperado_debito/esperado_credito/diferenca.
create or replace function public.listar_fechamentos_publico(p_local_id uuid, p_limite int default 30)
returns table (id uuid, data date, dinheiro_contado numeric, observacoes text, fechado_por_nome text, created_at timestamptz)
language sql
security definer
set search_path to ''
as $function$
  select cf.id, cf.data, cf.dinheiro_contado, cf.observacoes, p.nome, cf.created_at
  from public.caixa_fechamentos cf
  left join public.profiles p on p.id = cf.fechado_por
  where cf.local_id = p_local_id and public.pode_acessar_local(p_local_id)
  order by cf.data desc
  limit p_limite
$function$;

grant execute on function public.listar_fechamentos_publico(uuid, int) to authenticated;
