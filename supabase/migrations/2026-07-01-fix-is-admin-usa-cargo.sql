-- is_admin() checava a coluna legada profiles.perfil ('admin'/'gerente'),
-- que existia antes do sistema de cargos. resgatar_convite() (fluxo atual
-- de criacao de conta) so seta profiles.cargo_id, nunca profiles.perfil --
-- entao qualquer Administrador criado por convite ficava com cargo_id
-- correto na app, mas is_admin() (usado pelo RLS de profiles, contas_pagar,
-- contas_receber, audit_log) continuava enxergando ele como nao-admin.
-- Efeito pratico: admin convidado so via o proprio perfil na tela Equipe,
-- e qualquer update em outro profile falhava silenciosamente (RLS bloqueia
-- a linha, update retorna sucesso com 0 linhas afetadas, sem erro).
--
-- Fix: is_admin() passa a checar a mesma fonte de verdade que a app usa
-- (cargo_id -> cargos.admin), igual ja faz criar_convite()/revogar_convite().

create or replace function public.is_admin()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.profiles p
    join public.cargos c on c.id = p.cargo_id
    where p.id = auth.uid() and c.admin = true
  );
$$;
