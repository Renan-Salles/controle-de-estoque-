-- Inventario: conferencia fisica do estoque com ajuste em massa. Cabecalho
-- + itens (esperado x contado); divergencias viram ajustar_estoque +
-- movimentacao 'ajuste_inventario'.
create table if not exists public.inventarios (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locais(id),
  realizado_por uuid references public.profiles(id),
  itens_conferidos int not null default 0,
  itens_divergentes int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.inventario_itens (
  id uuid primary key default gen_random_uuid(),
  inventario_id uuid not null references public.inventarios(id) on delete cascade,
  produto_id uuid not null references public.produtos(id),
  esperado numeric not null,
  contado numeric not null
);

alter table public.inventarios enable row level security;
alter table public.inventario_itens enable row level security;

drop policy if exists "inventarios por local" on public.inventarios;
create policy "inventarios por local" on public.inventarios
  for all
  using (auth.uid() is not null and public.pode_acessar_local(local_id))
  with check (auth.uid() is not null and public.pode_acessar_local(local_id));

drop policy if exists "inventario_itens via inventario" on public.inventario_itens;
create policy "inventario_itens via inventario" on public.inventario_itens
  for all
  using (
    auth.uid() is not null and exists (
      select 1 from public.inventarios i
      where i.id = inventario_itens.inventario_id
        and public.pode_acessar_local(i.local_id)
    )
  )
  with check (
    auth.uid() is not null and exists (
      select 1 from public.inventarios i
      where i.id = inventario_itens.inventario_id
        and public.pode_acessar_local(i.local_id)
    )
  );

-- Funcionario/cargos com /estoque passam a ver a aba de contagem.
update public.cargos
set itens_visiveis = array_append(itens_visiveis, '/estoque/contagem')
where admin = false
  and '/estoque' = any(itens_visiveis)
  and not ('/estoque/contagem' = any(itens_visiveis));
