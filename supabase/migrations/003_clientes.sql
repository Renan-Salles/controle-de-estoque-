create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  tipo varchar(50) default 'bar' check (tipo in ('bar', 'comercio', 'consumidor_final', 'revendedor')),
  nome varchar(255) not null,
  cpf_cnpj varchar(20),
  telefone varchar(20),
  whatsapp varchar(20),
  endereco jsonb default '{}',
  observacoes text,
  limite_credito numeric(10,2) default 0,
  prazo_pagamento_dias integer default 0,
  forma_pagamento_padrao varchar(50) default 'dinheiro',
  status varchar(20) default 'ativo' check (status in ('ativo', 'inativo', 'bloqueado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_clientes_nome on public.clientes using gin(to_tsvector('portuguese', nome));
create index if not exists idx_clientes_telefone on public.clientes(telefone);
create index if not exists idx_clientes_status on public.clientes(status);

alter table public.clientes enable row level security;
drop policy if exists "autenticados gerenciam clientes" on public.clientes;
create policy "autenticados gerenciam clientes" on public.clientes for all using (auth.uid() is not null);
