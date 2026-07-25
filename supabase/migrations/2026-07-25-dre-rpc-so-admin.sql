-- supabase/migrations/2026-07-25-dre-rpc-so-admin.sql
-- calcular_dre/calcular_dre_serie eram "language sql" chamaveis por
-- qualquer authenticated sem checagem de cargo -- um funcionario logado
-- conseguia pegar lucro/DRE direto via supabase.rpc(...), sem passar pela
-- tela. Viram plpgsql com early return: sem ser admin, calcular_dre
-- retorna null e calcular_dre_serie retorna 0 linhas.

create or replace function public.calcular_dre(p_local_id uuid, p_mes date)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not public.is_admin() then
    return null;
  end if;
  return (
    with
    periodo as (
      select
        (date_trunc('month', p_mes::timestamp) at time zone 'America/Sao_Paulo') as inicio,
        ((date_trunc('month', p_mes::timestamp) + interval '1 month') at time zone 'America/Sao_Paulo') as fim
    ),
    receita as (
      select coalesce(sum(p.total), 0) as valor
      from public.pedidos p, periodo
      where p.local_id = p_local_id
        and p.status != 'cancelada'
        and p.data_pedido >= periodo.inicio
        and p.data_pedido < periodo.fim
    ),
    cmv as (
      select coalesce(sum(abs(m.quantidade) * coalesce(m.custo_unitario, 0)), 0) as valor
      from public.movimentacoes_estoque m
      join public.produtos pr on pr.id = m.produto_id
      , periodo
      where pr.local_id = p_local_id
        and m.tipo = 'saida_venda'
        and m.created_at >= periodo.inicio
        and m.created_at < periodo.fim
    ),
    perdas as (
      select coalesce(sum(abs(m.quantidade) * coalesce(m.custo_unitario, 0)), 0) as valor
      from public.movimentacoes_estoque m
      join public.produtos pr on pr.id = m.produto_id
      , periodo
      where pr.local_id = p_local_id
        and m.tipo = 'descarte'
        and m.created_at >= periodo.inicio
        and m.created_at < periodo.fim
    )
    select json_build_object(
      'receita_bruta', (select valor from receita),
      'cmv',          (select valor from cmv),
      'margem_bruta', (select valor from receita) - (select valor from cmv),
      'perdas',       (select valor from perdas)
    )
  );
end;
$function$;

create or replace function public.calcular_dre_serie(p_local_id uuid, p_meses int default 6)
returns table (mes text, receita numeric, cmv numeric, perdas numeric)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not public.is_admin() then
    return;
  end if;
  return query
    with meses as (
      select to_char(
        (date_trunc('month', now() at time zone 'America/Sao_Paulo') - (n || ' months')::interval),
        'YYYY-MM'
      ) as mes
      from generate_series(0, greatest(p_meses, 1) - 1) as n
    ),
    vendas as (
      select to_char(p.data_pedido at time zone 'America/Sao_Paulo', 'YYYY-MM') as mes,
             sum(p.total) as receita
      from public.pedidos p
      where p.local_id = p_local_id and p.status != 'cancelada'
      group by 1
    ),
    movs as (
      select to_char(m.created_at at time zone 'America/Sao_Paulo', 'YYYY-MM') as mes,
             sum(abs(m.quantidade) * coalesce(m.custo_unitario, 0)) filter (where m.tipo = 'saida_venda') as cmv,
             sum(abs(m.quantidade) * coalesce(m.custo_unitario, 0)) filter (where m.tipo = 'descarte') as perdas
      from public.movimentacoes_estoque m
      join public.produtos pr on pr.id = m.produto_id
      where pr.local_id = p_local_id
      group by 1
    )
    select meses.mes,
           coalesce(vendas.receita, 0)::numeric,
           coalesce(movs.cmv, 0)::numeric,
           coalesce(movs.perdas, 0)::numeric
    from meses
    left join vendas on vendas.mes = meses.mes
    left join movs on movs.mes = meses.mes
    order by meses.mes desc;
end;
$function$;
