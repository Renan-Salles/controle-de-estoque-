-- Multi-local: dois pontos independentes (Deposito e Imperio Salles / piscina).
-- Cada local tem seus proprios produtos, precos, estoque, clientes, fornecedores,
-- vendas e contas a pagar. Tudo que existe hoje pertence ao Deposito.

create table if not exists public.locais (
  id uuid primary key default gen_random_uuid(),
  nome varchar(120) not null,
  slug varchar(40) not null unique,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.locais (nome, slug) values
  ('Depósito', 'deposito'),
  ('Império Salles', 'piscina')
on conflict (slug) do nothing;

alter table public.locais enable row level security;
drop policy if exists "autenticados veem locais" on public.locais;
create policy "autenticados veem locais" on public.locais for all using (auth.uid() is not null);

-- local_id nas tabelas, com backfill para o Deposito
alter table public.produtos add column if not exists local_id uuid references public.locais(id);
update public.produtos set local_id = (select id from public.locais where slug = 'deposito') where local_id is null;
alter table public.produtos alter column local_id set not null;
create index if not exists idx_produtos_local on public.produtos(local_id);

alter table public.clientes add column if not exists local_id uuid references public.locais(id);
update public.clientes set local_id = (select id from public.locais where slug = 'deposito') where local_id is null;
alter table public.clientes alter column local_id set not null;
create index if not exists idx_clientes_local on public.clientes(local_id);

alter table public.fornecedores add column if not exists local_id uuid references public.locais(id);
update public.fornecedores set local_id = (select id from public.locais where slug = 'deposito') where local_id is null;
alter table public.fornecedores alter column local_id set not null;
create index if not exists idx_fornecedores_local on public.fornecedores(local_id);

alter table public.pedidos add column if not exists local_id uuid references public.locais(id);
update public.pedidos set local_id = (select id from public.locais where slug = 'deposito') where local_id is null;
alter table public.pedidos alter column local_id set not null;
create index if not exists idx_pedidos_local on public.pedidos(local_id);

alter table public.contas_pagar add column if not exists local_id uuid references public.locais(id);
update public.contas_pagar set local_id = (select id from public.locais where slug = 'deposito') where local_id is null;
alter table public.contas_pagar alter column local_id set not null;
create index if not exists idx_contas_pagar_local on public.contas_pagar(local_id);

-- Recria as views expondo local_id para permitir filtro por local
drop view if exists public.v_posicao_estoque cascade;
create view public.v_posicao_estoque as
select
  p.id,
  p.local_id,
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

drop view if exists public.v_faturamento_mensal cascade;
create view public.v_faturamento_mensal as
select
  local_id,
  date_trunc('month', data_pedido) as mes,
  count(id) as total_pedidos,
  sum(total) as receita_bruta,
  sum(desconto_total) as descontos,
  sum(total - desconto_total) as receita_liquida,
  round(sum(total) / nullif(count(id), 0), 2) as ticket_medio
from public.pedidos
where status not in ('cancelada')
group by local_id, date_trunc('month', data_pedido)
order by mes desc;

drop view if exists public.v_curva_abc cascade;
create view public.v_curva_abc as
with vendas as (
  select
    pi.produto_id,
    p.local_id,
    p.nome,
    sum(pi.quantidade_pedida) as total_unidades,
    sum(pi.total) as total_faturamento
  from public.pedido_itens pi
  join public.produtos p on p.id = pi.produto_id
  join public.pedidos ped on ped.id = pi.pedido_id
  where ped.status not in ('cancelada')
    and ped.data_pedido >= now() - interval '90 days'
  group by pi.produto_id, p.local_id, p.nome
),
ranking as (
  select *,
    sum(total_faturamento) over (partition by local_id) as total_geral,
    sum(total_faturamento) over (partition by local_id order by total_faturamento desc) as acumulado
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
