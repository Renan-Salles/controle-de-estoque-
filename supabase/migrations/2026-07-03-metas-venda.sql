-- Meta de faturamento mensal por local. Admin define em Configuracoes;
-- o dashboard mostra a barra de progresso (receita do mes / meta).
create table if not exists public.metas_venda (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locais(id),
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  valor numeric not null check (valor > 0),
  created_at timestamptz not null default now(),
  unique (local_id, mes)
);

alter table public.metas_venda enable row level security;

drop policy if exists "metas por local" on public.metas_venda;
create policy "metas por local" on public.metas_venda
  for all
  using (auth.uid() is not null and public.pode_acessar_local(local_id))
  with check (auth.uid() is not null and public.pode_acessar_local(local_id));
