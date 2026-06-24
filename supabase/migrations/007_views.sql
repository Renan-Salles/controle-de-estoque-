-- Posicao de estoque com alerta
create or replace view public.v_posicao_estoque as
select
  p.id,
  p.nome,
  p.marca,
  c.nome as categoria,
  p.embalagem,
  p.volume_ml,
  e.saldo_atual,
  p.estoque_minimo,
  p.custo_atual,
  e.custo_medio,
  (e.saldo_atual * e.custo_medio) as valor_total,
  case
    when e.saldo_atual <= 0 then 'ruptura'
    when e.saldo_atual <= p.estoque_minimo then 'critico'
    when e.saldo_atual <= p.estoque_minimo * 1.5 then 'alerta'
    else 'ok'
  end as status_estoque,
  p.preco_venda_padrao,
  p.ativo
from public.produtos p
join public.estoque e on e.produto_id = p.id
join public.categorias c on c.id = p.categoria_id
where p.ativo = true;

-- Aging de contas a receber
create or replace view public.v_aging_receber as
select
  cr.id,
  cl.nome as cliente,
  cr.valor,
  cr.valor_pago,
  (cr.valor - cr.valor_pago) as saldo,
  cr.data_vencimento,
  (current_date - cr.data_vencimento) as dias_atraso,
  case
    when cr.data_vencimento >= current_date then 'a_vencer'
    when (current_date - cr.data_vencimento) <= 30 then 'ate_30'
    when (current_date - cr.data_vencimento) <= 60 then 'ate_60'
    when (current_date - cr.data_vencimento) <= 90 then 'ate_90'
    else 'mais_90'
  end as faixa,
  cr.status
from public.contas_receber cr
join public.clientes cl on cl.id = cr.cliente_id
where cr.status in ('aberto', 'parcial', 'vencido');

-- Faturamento mensal
create or replace view public.v_faturamento_mensal as
select
  date_trunc('month', data_pedido) as mes,
  count(id) as total_pedidos,
  sum(total) as receita_bruta,
  sum(desconto_total) as descontos,
  sum(total - desconto_total) as receita_liquida,
  round(sum(total) / nullif(count(id), 0), 2) as ticket_medio
from public.pedidos
where status not in ('cancelado', 'rascunho')
group by 1
order by 1 desc;

-- Curva ABC de produtos
create or replace view public.v_curva_abc as
with vendas as (
  select
    pi.produto_id,
    p.nome,
    sum(pi.quantidade_pedida) as total_unidades,
    sum(pi.total) as total_faturamento
  from public.pedido_itens pi
  join public.produtos p on p.id = pi.produto_id
  join public.pedidos ped on ped.id = pi.pedido_id
  where ped.status not in ('cancelado', 'rascunho')
    and ped.data_pedido >= now() - interval '90 days'
  group by 1, 2
),
ranking as (
  select *,
    sum(total_faturamento) over () as total_geral,
    sum(total_faturamento) over (order by total_faturamento desc) as acumulado
  from vendas
)
select *,
  round((acumulado / nullif(total_geral, 0)) * 100, 1) as pct_acumulado,
  case
    when (acumulado / nullif(total_geral, 0)) <= 0.80 then 'A'
    when (acumulado / nullif(total_geral, 0)) <= 0.95 then 'B'
    else 'C'
  end as classe_abc
from ranking
order by total_faturamento desc;
