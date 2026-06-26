-- Relatórios de vendas: índices + funções de agregação por período.
-- Aplicar com: node scripts/migrations/aplicar-relatorios.mjs

-- Índices para os relatórios de período não varrerem a tabela inteira.
create index if not exists idx_pedidos_local_data_status
  on pedidos (local_id, data_pedido, status);
create index if not exists idx_pedido_itens_pedido on pedido_itens (pedido_id);
create index if not exists idx_pedido_itens_produto on pedido_itens (produto_id);

-- Vendas por produto no período (só pedidos concluídos do local).
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
    and p.data_pedido between p_ini and p_fim
  group by pr.id, pr.nome
  order by faturamento desc;
$$;

-- Vendas por cliente no período. Cliente nulo (balcão) cai como "Não identificado".
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
    and p.data_pedido between p_ini and p_fim
  group by c.id, c.nome
  order by total desc;
$$;

grant execute on function vendas_por_produto(uuid, date, date) to authenticated;
grant execute on function vendas_por_cliente(uuid, date, date) to authenticated;
