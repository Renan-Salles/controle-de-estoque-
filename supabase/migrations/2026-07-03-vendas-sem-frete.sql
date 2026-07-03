-- Relatorio de venda/faturamento conta MERCADORIA, nao frete. Assim "Vendas
-- por cliente" bate com "Vendas por produto"/Curva ABC (que ja somam
-- pedido_itens.total, sem frete). Formas de pagamento e DRE ficam com frete
-- de proposito: la o frete e dinheiro que entrou de verdade, nao faturamento
-- de mercadoria.
-- vendas_por_produto ja soma pedido_itens.total (sem frete) -- nao muda.
create or replace function public.vendas_por_cliente(p_local uuid, p_ini date, p_fim date)
returns table(cliente_id uuid, nome text, pedidos bigint, total numeric)
language sql stable as $$
  select c.id,
         coalesce(c.nome, 'Não identificado') as nome,
         count(p.id) as pedidos,
         sum(p.total - p.frete)::numeric as total
  from pedidos p
  left join clientes c on c.id = p.cliente_id
  where p.local_id = p_local
    and p.status = 'concluida'
    and p.data_pedido >= p_ini
    and p.data_pedido < (p_fim + 1)
  group by c.id, c.nome
  order by total desc;
$$;
