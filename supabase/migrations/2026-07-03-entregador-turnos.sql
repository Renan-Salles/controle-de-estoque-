-- Turno de trabalho do entregador: "iniciar expediente"/"encerrar
-- expediente" na tela dele. Disponibilidade = ter (ou nao) um turno aberto
-- agora -- nao existe um status separado pra nao duplicar conceito.
create table if not exists public.entregador_turnos (
  id uuid primary key default gen_random_uuid(),
  entregador_id uuid not null references public.profiles(id),
  local_id uuid not null references public.locais(id),
  iniciado_em timestamptz not null default now(),
  encerrado_em timestamptz
);

-- So um turno aberto por entregador de cada vez.
create unique index if not exists entregador_turnos_aberto_unico
  on public.entregador_turnos (entregador_id)
  where encerrado_em is null;

alter table public.entregador_turnos enable row level security;

drop policy if exists "turnos por local" on public.entregador_turnos;
create policy "turnos por local" on public.entregador_turnos
  for all
  using (auth.uid() is not null and public.pode_acessar_local(local_id))
  with check (auth.uid() is not null and public.pode_acessar_local(local_id));
