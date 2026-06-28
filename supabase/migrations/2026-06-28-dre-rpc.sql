create or replace function public.calcular_dre(p_local_id uuid, p_mes date)
returns json language sql security definer set search_path = '' as $$
  with
  periodo as (
    select
      date_trunc('month', p_mes::timestamptz) as inicio,
      date_trunc('month', p_mes::timestamptz) + interval '1 month' as fim
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
$$;
