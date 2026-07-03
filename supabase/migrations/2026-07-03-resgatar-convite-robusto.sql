-- Bug real (2026-07-03): resgatar_convite rodou com auth.uid() NULL (a
-- sessao recem-criada pelo signUp ainda nao tinha propagado pro server) e
-- o UPDATE de profiles virou WHERE id = null -- 0 linhas, silencioso. O
-- convite foi marcado como usado MESMO SEM aplicar o cargo: a pessoa
-- entrou com cargo nulo (fail-open = viu tudo).
-- Fix: exige sessao, confere ROW_COUNT do update, e so queima o convite
-- depois que o cargo foi de fato aplicado. Se falhar, o convite continua
-- valido pra nova tentativa.
create or replace function public.resgatar_convite(p_token text, p_nome text)
returns table (cargo_nome text, local_nome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_convite record;
  v_linhas int;
begin
  if auth.uid() is null then
    raise exception 'Sessão ainda não está pronta. Tente de novo em instantes.';
  end if;

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

  get diagnostics v_linhas = row_count;
  if v_linhas = 0 then
    -- Perfil ainda nao existe (trigger de auth nao rodou?): cria na hora,
    -- em vez de falhar -- o convite tem tudo que o perfil precisa.
    insert into public.profiles (id, nome, email, cargo_id, local_id)
    select auth.uid(), p_nome, coalesce(u.email, ''), v_convite.cargo_id, v_convite.local_id
    from auth.users u where u.id = auth.uid()
    on conflict (id) do update
      set nome = excluded.nome, cargo_id = excluded.cargo_id, local_id = excluded.local_id;
  end if;

  update public.convites
  set usado_em = now(), usado_por = auth.uid()
  where id = v_convite.id;

  return query
    select c.nome::text, l.nome::text
    from public.cargos c, public.locais l
    where c.id = v_convite.cargo_id and l.id = v_convite.local_id;
end;
$$;
