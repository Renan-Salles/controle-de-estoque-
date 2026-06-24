create table if not exists public.contas_receber (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid references public.pedidos(id),
  cliente_id uuid references public.clientes(id) not null,
  descricao varchar(255),
  valor numeric(10,2) not null,
  valor_pago numeric(10,2) not null default 0,
  status varchar(50) not null default 'aberto'
    check (status in ('aberto', 'pago', 'parcial', 'vencido', 'cancelado')),
  data_emissao date not null default current_date,
  data_vencimento date not null,
  data_pagamento date,
  forma_pagamento varchar(50),
  observacoes text,
  created_at timestamptz not null default now()
);

create table if not exists public.contas_pagar (
  id uuid primary key default gen_random_uuid(),
  categoria varchar(100) not null default 'outros'
    check (categoria in ('mercadoria', 'aluguel', 'salario', 'combustivel', 'manutencao', 'servicos', 'impostos', 'outros')),
  descricao varchar(255) not null,
  valor numeric(10,2) not null,
  valor_pago numeric(10,2) not null default 0,
  status varchar(50) not null default 'aberto'
    check (status in ('aberto', 'pago', 'parcial', 'vencido', 'cancelado')),
  data_emissao date not null default current_date,
  data_vencimento date not null,
  data_pagamento date,
  forma_pagamento varchar(50),
  observacoes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_cr_cliente on public.contas_receber(cliente_id);
create index if not exists idx_cr_vencimento on public.contas_receber(data_vencimento);
create index if not exists idx_cr_status on public.contas_receber(status);
create index if not exists idx_cp_vencimento on public.contas_pagar(data_vencimento);
create index if not exists idx_cp_status on public.contas_pagar(status);

alter table public.contas_receber enable row level security;
alter table public.contas_pagar enable row level security;
drop policy if exists "admin ve contas receber" on public.contas_receber;
create policy "admin ve contas receber" on public.contas_receber for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.perfil = 'admin'));
drop policy if exists "gerente ve receber vinculado" on public.contas_receber;
create policy "gerente ve receber vinculado" on public.contas_receber for select
  using (auth.uid() is not null);
drop policy if exists "admin ve contas pagar" on public.contas_pagar;
create policy "admin ve contas pagar" on public.contas_pagar for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.perfil = 'admin'));

create table if not exists public.alertas (
  id uuid primary key default gen_random_uuid(),
  tipo varchar(50) not null,
  severidade varchar(20) not null default 'aviso' check (severidade in ('info', 'aviso', 'critico')),
  titulo varchar(255) not null,
  mensagem text,
  referencia_tipo varchar(50),
  referencia_id uuid,
  resolvido boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tipo, referencia_id)
);

alter table public.alertas enable row level security;
drop policy if exists "autenticados veem alertas" on public.alertas;
create policy "autenticados veem alertas" on public.alertas for all using (auth.uid() is not null);
