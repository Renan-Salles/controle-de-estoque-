-- Corrige recursao infinita nas policies de RLS (erro 42P17).
-- Causa: policies que checavam admin via "exists (select 1 from profiles ...)"
-- dentro da propria tabela profiles (e em tabelas que a referenciam) recursavam.
-- Solucao: funcao SECURITY DEFINER que roda como owner da tabela, ignorando o RLS
-- de profiles e quebrando o ciclo.

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and perfil = 'admin'
  );
$$;

-- profiles: troca a policy recursiva
drop policy if exists "admin ve todos os perfis" on public.profiles;
create policy "admin ve todos os perfis" on public.profiles
  for all using (public.is_admin());

-- audit_log
drop policy if exists "admin le audit log" on public.audit_log;
create policy "admin le audit log" on public.audit_log
  for select using (public.is_admin());

-- contas_receber
drop policy if exists "admin ve contas receber" on public.contas_receber;
create policy "admin ve contas receber" on public.contas_receber
  for all using (public.is_admin());

-- contas_pagar
drop policy if exists "admin ve contas pagar" on public.contas_pagar;
create policy "admin ve contas pagar" on public.contas_pagar
  for all using (public.is_admin());
