-- Taxa de entrega padrao por bairro. Na venda tipo entrega, ao escolher o
-- cliente, o frete vem preenchido pela taxa do bairro dele (editavel).
create table if not exists public.taxas_entrega (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locais(id),
  bairro text not null,
  valor numeric not null check (valor >= 0),
  created_at timestamptz not null default now()
);
create unique index if not exists uq_taxas_entrega_local_bairro
  on public.taxas_entrega (local_id, lower(bairro));

alter table public.taxas_entrega enable row level security;

drop policy if exists "taxas por local" on public.taxas_entrega;
create policy "taxas por local" on public.taxas_entrega
  for all
  using (auth.uid() is not null and public.pode_acessar_local(local_id))
  with check (auth.uid() is not null and public.pode_acessar_local(local_id));
