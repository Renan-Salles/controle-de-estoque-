-- Comparativo entre locais (mes corrente, fuso Brasilia): receita de
-- mercadoria (sem frete), vendas, ticket e CMV por local. Security definer
-- pra enxergar os dois locais de uma vez, MAS com gate de admin dentro da
-- funcao (quem nao e admin recebe erro, nao dados).
create or replace function public.comparativo_locais(p_mes date default null)
returns table (
  local_id uuid,
  local_nome text,
  receita numeric,
  vendas bigint,
  ticket numeric,
  cmv numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin boolean;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_mes date;
begin
  select coalesce(c.admin, false) into v_admin
  from public.profiles p
  left join public.cargos c on c.id = p.cargo_id
  where p.id = auth.uid();

  -- Cargo nulo e fail-open no app, mas comparativo cruza locais: so admin.
  if not coalesce(v_admin, false) then
    raise exception 'Somente administrador pode ver o comparativo entre locais';
  end if;

  v_mes := coalesce(p_mes, (now() at time zone 'America/Sao_Paulo')::date);
  v_inicio := date_trunc('month', v_mes::timestamp) at time zone 'America/Sao_Paulo';
  v_fim := (date_trunc('month', v_mes::timestamp) + interval '1 month') at time zone 'America/Sao_Paulo';

  return query
  with vendas_mes as (
    select p.local_id as lid,
           sum(p.total - p.frete) as receita,
           count(*) as vendas
    from public.pedidos p
    where p.status = 'concluida'
      and p.data_pedido >= v_inicio and p.data_pedido < v_fim
    group by p.local_id
  ),
  cmv_mes as (
    select pr.local_id as lid,
           sum(abs(m.quantidade) * coalesce(m.custo_unitario, 0)) as cmv
    from public.movimentacoes_estoque m
    join public.produtos pr on pr.id = m.produto_id
    where m.tipo = 'saida_venda'
      and m.created_at >= v_inicio and m.created_at < v_fim
    group by pr.local_id
  )
  select l.id,
         l.nome::text,
         coalesce(v.receita, 0)::numeric,
         coalesce(v.vendas, 0)::bigint,
         case when coalesce(v.vendas, 0) > 0
           then round(v.receita / v.vendas, 2) else 0 end::numeric,
         coalesce(c.cmv, 0)::numeric
  from public.locais l
  left join vendas_mes v on v.lid = l.id
  left join cmv_mes c on c.lid = l.id
  where l.ativo = true
  order by l.nome;
end;
$$;

grant execute on function public.comparativo_locais(date) to authenticated;
