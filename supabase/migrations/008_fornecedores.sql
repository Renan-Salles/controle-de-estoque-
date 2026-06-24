create table if not exists public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome varchar(255) not null,
  razao_social varchar(255),
  cnpj varchar(20),
  telefone varchar(20),
  whatsapp varchar(20),
  contato_nome varchar(255),
  email varchar(255),
  endereco jsonb default '{}',
  produtos_fornecidos text,
  prazo_entrega_dias integer default 0,
  observacoes text,
  status varchar(20) default 'ativo' check (status in ('ativo','inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_fornecedores_nome on public.fornecedores using gin(to_tsvector('portuguese', nome));
create index if not exists idx_fornecedores_status on public.fornecedores(status);
alter table public.fornecedores enable row level security;
drop policy if exists "autenticados gerenciam fornecedores" on public.fornecedores;
create policy "autenticados gerenciam fornecedores" on public.fornecedores for all using (auth.uid() is not null);
