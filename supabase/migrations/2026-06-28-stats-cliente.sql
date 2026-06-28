create or replace function public.stats_cliente(p_cliente_id uuid, p_local_id uuid)
returns json language sql security definer set search_path = '' as $$
  with
  pedidos_c as (
    select total, data_pedido
    from public.pedidos
    where cliente_id = p_cliente_id
      and local_id = p_local_id
      and status != 'cancelada'
  ),
  fav as (
    select pr.nome, sum(pi.quantidade_pedida) as qtd
    from public.pedido_itens pi
    join public.pedidos p on p.id = pi.pedido_id
    join public.produtos pr on pr.id = pi.produto_id
    where p.cliente_id = p_cliente_id
      and p.local_id = p_local_id
      and p.status != 'cancelada'
    group by pr.id, pr.nome
    order by qtd desc
    limit 1
  )
  select json_build_object(
    'total_compras',    (select count(*) from pedidos_c),
    'valor_total',      (select coalesce(sum(total), 0) from pedidos_c),
    'ticket_medio',     (select coalesce(avg(total), 0) from pedidos_c),
    'ultima_compra',    (select max(data_pedido) from pedidos_c),
    'produto_favorito', (select nome from fav)
  )
$$;
