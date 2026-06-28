create table if not exists public.custos_fixos (
  id uuid primary key default gen_random_uuid(),
  local_id uuid references public.locais(id) on delete cascade not null,
  nome varchar(120) not null,
  categoria varchar(50) not null check (categoria in (
    'aluguel','salario','energia','agua','telefone',
    'internet','combustivel','manutencao','contabilidade','impostos','outros'
  )),
  valor numeric(12,2) not null check (valor >= 0),
  recorrencia varchar(20) not null default 'mensal' check (recorrencia in ('mensal','anual','unico')),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.custos_fixos enable row level security;
create policy "autenticados gerenciam custos_fixos" on public.custos_fixos
  for all using (auth.uid() is not null);
