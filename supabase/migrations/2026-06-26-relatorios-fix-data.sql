-- Correção: data_pedido é timestamptz. O "between p_ini and p_fim" excluía os
-- pedidos do último dia após a meia-noite. Troca por >= p_ini e < (p_fim + 1 dia).

create or replace function vendas_por_produto(p_local uuid, p_ini date, p_fim date)
returns table (produto_id uuid, nome text, unidades numeric, faturamento numeric)
language sql stable as $$
  select pr.id, pr.nome,
         sum(pi.quantidade_pedida)::numeric as unidades,
         sum(pi.total)::numeric as faturamento
  from pedido_itens pi
  join pedidos p on p.id = pi.pedido_id
  join produtos pr on pr.id = pi.produto_id
  where p.local_id = p_local
    and p.status = 'concluida'
    and p.data_pedido >= p_ini
    and p.data_pedido < (p_fim + 1)
  group by pr.id, pr.nome
  order by faturamento desc;
$$;

create or replace function vendas_por_cliente(p_local uuid, p_ini date, p_fim date)
returns table (cliente_id uuid, nome text, pedidos bigint, total numeric)
language sql stable as $$
  select c.id,
         coalesce(c.nome, 'Não identificado') as nome,
         count(p.id) as pedidos,
         sum(p.total)::numeric as total
  from pedidos p
  left join clientes c on c.id = p.cliente_id
  where p.local_id = p_local
    and p.status = 'concluida'
    and p.data_pedido >= p_ini
    and p.data_pedido < (p_fim + 1)
  group by c.id, c.nome
  order by total desc;
$$;
