-- 1) calcular_dre tinha o mesmo bug de fuso da v_faturamento_mensal:
--    date_trunc em UTC joga vendas de 21h-23h59 pro mes seguinte. Corrige
--    truncando em America/Sao_Paulo (mesmo fix da migration
--    2026-07-03-faturamento-fuso-brasilia).
create or replace function public.calcular_dre(p_local_id uuid, p_mes date)
returns json
language sql
security definer
set search_path to ''
as $function$
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
$function$;

-- 2) Serie mensal do DRE (ultimos N meses) numa query so, agrupada no fuso
--    de Brasilia. Custos fixos ficam por conta do app (valor unico atual
--    aplicado a todos os meses -- o cadastro nao tem historico).
create or replace function public.calcular_dre_serie(p_local_id uuid, p_meses int default 6)
returns table (mes text, receita numeric, cmv numeric, perdas numeric)
language sql
security definer
set search_path to ''
as $function$
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
  order by meses.mes desc
$function$;

grant execute on function public.calcular_dre_serie(uuid, int) to authenticated;
