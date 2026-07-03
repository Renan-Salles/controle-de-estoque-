-- Fechamento de caixa diario, com contagem AS CEGAS: quem conta digita o
-- dinheiro da gaveta sem ver o esperado; o sistema grava o snapshot do
-- esperado por forma no momento do fechamento e a diferenca. Refechar o
-- mesmo dia sobrescreve (unique local+data).
create table if not exists public.caixa_fechamentos (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locais(id),
  data date not null,
  dinheiro_contado numeric not null default 0,
  esperado_dinheiro numeric not null default 0,
  esperado_pix numeric not null default 0,
  esperado_debito numeric not null default 0,
  esperado_credito numeric not null default 0,
  diferenca numeric not null default 0,
  observacoes text,
  fechado_por uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (local_id, data)
);

alter table public.caixa_fechamentos enable row level security;

drop policy if exists "caixa por local" on public.caixa_fechamentos;
create policy "caixa por local" on public.caixa_fechamentos
  for all
  using (auth.uid() is not null and public.pode_acessar_local(local_id))
  with check (auth.uid() is not null and public.pode_acessar_local(local_id));

-- Funcionario passa a ver o item /caixa na sidebar (admin ja ve tudo).
update public.cargos
set itens_visiveis = array_append(itens_visiveis, '/caixa')
where admin = false
  and '/movimentacoes' = any(itens_visiveis)
  and not ('/caixa' = any(itens_visiveis));
