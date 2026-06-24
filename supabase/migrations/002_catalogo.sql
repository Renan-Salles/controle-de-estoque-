create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  nome varchar(100) not null unique,
  ordem integer not null default 0,
  ativo boolean not null default true
);

insert into public.categorias (nome, ordem) values
  ('Cerveja', 1), ('Refrigerante', 2), ('Agua', 3),
  ('Guarana', 4), ('Destilado', 5), ('Vinho', 6), ('Outros', 7)
on conflict (nome) do nothing;

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  codigo_barras varchar(20),
  nome varchar(255) not null,
  marca varchar(100),
  categoria_id uuid references public.categorias(id) not null,
  embalagem varchar(50) default 'unidade' check (embalagem in ('unidade', 'fardo', 'caixa', 'grade', 'pack')),
  volume_ml integer,
  fator_conversao numeric(10,4) default 1,
  custo_atual numeric(10,2) default 0,
  preco_venda_padrao numeric(10,2) not null default 0,
  margem_alvo_pct numeric(5,2) default 30,
  estoque_minimo numeric(10,3) default 0,
  estoque_maximo numeric(10,3),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_produtos_categoria on public.produtos(categoria_id);
create index if not exists idx_produtos_nome on public.produtos using gin(to_tsvector('portuguese', nome));

create table if not exists public.estoque (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid references public.produtos(id) on delete cascade unique not null,
  saldo_atual numeric(10,3) not null default 0,
  custo_medio numeric(10,2) default 0,
  updated_at timestamptz not null default now()
);

alter table public.categorias enable row level security;
alter table public.produtos enable row level security;
alter table public.estoque enable row level security;

drop policy if exists "autenticados leem categorias" on public.categorias;
create policy "autenticados leem categorias" on public.categorias for select using (auth.uid() is not null);
drop policy if exists "autenticados leem produtos" on public.produtos;
create policy "autenticados leem produtos" on public.produtos for select using (auth.uid() is not null);
drop policy if exists "autenticados leem estoque" on public.estoque;
create policy "autenticados leem estoque" on public.estoque for select using (auth.uid() is not null);
drop policy if exists "autenticados escrevem produtos" on public.produtos;
create policy "autenticados escrevem produtos" on public.produtos for all using (auth.uid() is not null);
drop policy if exists "autenticados escrevem estoque" on public.estoque;
create policy "autenticados escrevem estoque" on public.estoque for all using (auth.uid() is not null);

create or replace function public.criar_estoque_produto()
returns trigger language plpgsql as $$
begin
  insert into public.estoque (produto_id) values (new.id) on conflict (produto_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_produto_created on public.produtos;
create trigger on_produto_created
  after insert on public.produtos
  for each row execute procedure public.criar_estoque_produto();
