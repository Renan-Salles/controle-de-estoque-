-- Convite de equipe + escopo por local: profile ganha local_id, tabela de
-- convites com token de uso único, e funções security definer pra criar,
-- consultar (anônimo), revogar e resgatar convites sem depender de RLS
-- client-side (createServiceClient() só bypassa RLS quando não há sessão
-- ativa nos cookies — com sessão, ele age como o próprio usuário logado).

alter table public.profiles add column if not exists local_id uuid references public.locais(id);

create table if not exists public.convites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  cargo_id uuid not null references public.cargos(id),
  local_id uuid not null references public.locais(id),
  criado_por uuid not null references public.profiles(id),
  expira_em timestamptz not null,
  usado_em timestamptz,
  usado_por uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.convites enable row level security;
drop policy if exists convites_select on public.convites;
create policy convites_select on public.convites for select using (auth.uid() is not null);

-- Gera convite. Checa admin dentro da função (não depende de RLS/policy).
create or replace function public.criar_convite(p_cargo_id uuid, p_local_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin boolean;
  v_token text;
begin
  select exists (
    select 1 from public.profiles p
    join public.cargos c on c.id = p.cargo_id
    where p.id = auth.uid() and c.admin = true
  ) into v_admin;

  if not v_admin then
    raise exception 'Sem permissão';
  end if;

  -- gen_random_uuid() é built-in do Postgres (pg_catalog), sempre resolve
  -- mesmo com search_path vazio. Evita depender de onde o pgcrypto está
  -- instalado (gen_random_bytes fica em "extensions" no Supabase, fora do
  -- search_path desta função).
  v_token := replace(gen_random_uuid()::text, '-', '');

  insert into public.convites (token, cargo_id, local_id, criado_por, expira_em)
  values (v_token, p_cargo_id, p_local_id, auth.uid(), now() + interval '7 days');

  return v_token;
end;
$$;

-- Revoga convite ainda não usado. Só admin.
create or replace function public.revogar_convite(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin boolean;
begin
  select exists (
    select 1 from public.profiles p
    join public.cargos c on c.id = p.cargo_id
    where p.id = auth.uid() and c.admin = true
  ) into v_admin;

  if not v_admin then
    raise exception 'Sem permissão';
  end if;

  delete from public.convites where id = p_id and usado_em is null;
end;
$$;

-- Consulta pública (anônima), só pra mostrar cargo/local na tela do convite
-- antes do cadastro. Não expõe token, ids nem quem convidou.
create or replace function public.consultar_convite(p_token text)
returns table (valido boolean, cargo_nome text, local_nome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_convite record;
begin
  select * into v_convite
  from public.convites
  where token = p_token and usado_em is null and expira_em > now()
  limit 1;

  if v_convite is null then
    return query select false, null::text, null::text;
    return;
  end if;

  -- l.nome é varchar(120): precisa do cast pra bater com o "text" declarado
  -- no returns table (RETURN QUERY exige tipo exato, não só compatível).
  return query
    select true, c.nome::text, l.nome::text
    from public.cargos c, public.locais l
    where c.id = v_convite.cargo_id and l.id = v_convite.local_id;
end;
$$;

-- Resgata o convite: chamado pelo usuário recém-criado (signUp já rodou e
-- já existe sessão). Grava nome/cargo/local no profile dele e marca o
-- convite como usado, tudo na mesma transação da função.
create or replace function public.resgatar_convite(p_token text, p_nome text)
returns table (cargo_nome text, local_nome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_convite record;
begin
  select * into v_convite
  from public.convites
  where token = p_token and usado_em is null and expira_em > now()
  limit 1;

  if v_convite is null then
    raise exception 'Convite inválido ou expirado';
  end if;

  update public.profiles
  set nome = p_nome, cargo_id = v_convite.cargo_id, local_id = v_convite.local_id
  where id = auth.uid();

  update public.convites
  set usado_em = now(), usado_por = auth.uid()
  where id = v_convite.id;

  return query
    select c.nome::text, l.nome::text
    from public.cargos c, public.locais l
    where c.id = v_convite.cargo_id and l.id = v_convite.local_id;
end;
$$;

grant execute on function public.criar_convite(uuid, uuid) to authenticated;
grant execute on function public.revogar_convite(uuid) to authenticated;
grant execute on function public.consultar_convite(text) to anon, authenticated;
grant execute on function public.resgatar_convite(text, text) to authenticated;
