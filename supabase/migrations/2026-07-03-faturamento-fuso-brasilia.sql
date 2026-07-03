-- date_trunc sem fuso trunca em UTC; venda das 21h-23h59 (Brasil) cai no
-- mes seguinte. Converte pra America/Sao_Paulo antes de truncar, igual
-- ja e feito em lib/formatos.ts pro resto do sistema.
-- Drop necessario: a coluna 'mes' muda de timestamptz pra timestamp (o
-- 'at time zone' devolve timestamp sem tz), e create or replace nao deixa
-- mudar tipo de coluna existente.
drop view if exists public.v_faturamento_mensal;
create view public.v_faturamento_mensal as
  select local_id,
    date_trunc('month', data_pedido at time zone 'America/Sao_Paulo') as mes,
    count(id) as total_pedidos,
    sum(total) as receita_bruta,
    sum(desconto_total) as descontos,
    sum(total - desconto_total) as receita_liquida,
    round(sum(total) / nullif(count(id), 0)::numeric, 2) as ticket_medio
  from pedidos
  where status::text <> 'cancelada'::text
  group by local_id, date_trunc('month', data_pedido at time zone 'America/Sao_Paulo')
  order by date_trunc('month', data_pedido at time zone 'America/Sao_Paulo') desc;
