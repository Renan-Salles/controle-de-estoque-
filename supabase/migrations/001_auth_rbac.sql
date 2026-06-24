-- Perfis de usuário (estende auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  nome varchar(255) not null,
  email varchar(255) not null,
  perfil varchar(50) not null default 'gerente' check (perfil in ('admin', 'gerente')),
  status varchar(50) not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "usuarios veem proprio perfil" on public.profiles
  for select using (auth.uid() = id);
create policy "admin ve todos os perfis" on public.profiles
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.perfil = 'admin')
  );

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, nome, email, perfil)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'perfil', 'gerente')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  tabela varchar(100) not null,
  operacao varchar(20) not null check (operacao in ('INSERT', 'UPDATE', 'DELETE')),
  registro_id uuid,
  dados_antes jsonb,
  dados_depois jsonb,
  usuario_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;
create policy "admin le audit log" on public.audit_log
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.perfil = 'admin')
  );
