create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  numero_pedido serial unique not null,
  cliente_id uuid references public.clientes(id) not null,
  atendente_id uuid references auth.users(id) not null,
  status varchar(50) not null default 'confirmado'
    check (status in ('rascunho', 'confirmado', 'em_separacao', 'saiu_entrega', 'entregue', 'parcial', 'cancelado')),
  data_pedido timestamptz not null default now(),
  data_entrega_prevista date,
  forma_pagamento varchar(50) not null default 'dinheiro'
    check (forma_pagamento in ('dinheiro', 'pix', 'fiado', 'cartao_debito', 'cartao_credito', 'boleto')),
  prazo_pagamento_dias integer not null default 0,
  data_vencimento date,
  subtotal numeric(10,2) not null default 0,
  desconto_total numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  total_pago numeric(10,2) not null default 0,
  observacoes text,
  canal varchar(50) default 'telefone' check (canal in ('telefone', 'whatsapp', 'balcao', 'app')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid references public.pedidos(id) on delete cascade not null,
  produto_id uuid references public.produtos(id) not null,
  quantidade_pedida numeric(10,3) not null,
  quantidade_entregue numeric(10,3),
  preco_unitario numeric(10,2) not null,
  desconto_pct numeric(5,2) not null default 0,
  total numeric(10,2) not null
);

create index if not exists idx_pedidos_cliente on public.pedidos(cliente_id);
create index if not exists idx_pedidos_status on public.pedidos(status);
create index if not exists idx_pedidos_data on public.pedidos(data_pedido);
create index if not exists idx_pedido_itens_pedido on public.pedido_itens(pedido_id);

alter table public.pedidos enable row level security;
alter table public.pedido_itens enable row level security;
drop policy if exists "autenticados gerenciam pedidos" on public.pedidos;
create policy "autenticados gerenciam pedidos" on public.pedidos for all using (auth.uid() is not null);
drop policy if exists "autenticados gerenciam itens" on public.pedido_itens;
create policy "autenticados gerenciam itens" on public.pedido_itens for all using (auth.uid() is not null);
