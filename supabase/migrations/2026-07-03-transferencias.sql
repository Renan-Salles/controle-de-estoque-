-- Transferencia de estoque entre locais (admin): baixa na origem, entrada
-- no destino (produto de mesmo nome, clonado se nao existir), registro aqui.
create table if not exists public.transferencias (
  id uuid primary key default gen_random_uuid(),
  produto_origem_id uuid not null references public.produtos(id),
  produto_destino_id uuid not null references public.produtos(id),
  local_origem_id uuid not null references public.locais(id),
  local_destino_id uuid not null references public.locais(id),
  quantidade numeric not null check (quantidade > 0),
  realizado_por uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.transferencias enable row level security;

-- Leitura: quem acessa origem OU destino. Escrita so via service/admin (a
-- action gateia admin; RLS de escrita exige acesso aos dois lados).
drop policy if exists "transferencias por local" on public.transferencias;
create policy "transferencias por local" on public.transferencias
  for select
  using (
    auth.uid() is not null and (
      public.pode_acessar_local(local_origem_id) or public.pode_acessar_local(local_destino_id)
    )
  );

drop policy if exists "transferencias escrita" on public.transferencias;
create policy "transferencias escrita" on public.transferencias
  for insert
  with check (
    auth.uid() is not null
    and public.pode_acessar_local(local_origem_id)
    and public.pode_acessar_local(local_destino_id)
  );
