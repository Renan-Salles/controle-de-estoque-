-- RBAC: cargos configuráveis pelo admin + vínculo do usuário ao cargo.
-- itens_visiveis = lista de hrefs da sidebar que o cargo enxerga. admin=true vê tudo.

create table if not exists cargos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  admin boolean not null default false,
  itens_visiveis text[] not null default '{}',
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table profiles add column if not exists cargo_id uuid references cargos(id);

-- Leitura liberada para autenticados (a sidebar precisa). Escrita só via service
-- role (server actions do admin usam service client, que ignora RLS).
alter table cargos enable row level security;
drop policy if exists cargos_select on cargos;
create policy cargos_select on cargos for select using (auth.uid() is not null);

-- Cargos padrão (editáveis/removíveis pelo admin depois).
insert into cargos (nome, admin, itens_visiveis) values
  ('Administrador', true, '{}')
  on conflict (nome) do nothing;

insert into cargos (nome, admin, itens_visiveis) values
  ('Gerente', false, ARRAY[
    '/dashboard','/movimentacoes/nova','/pedidos','/clientes','/movimentacoes',
    '/estoque','/estoque/reposicao','/produtos','/fornecedores',
    '/financeiro/resultado','/financeiro/a-receber','/financeiro/a-pagar','/financeiro/formas-pagamento',
    '/relatorios','/relatorios/produto','/relatorios/cliente'
  ])
  on conflict (nome) do nothing;

insert into cargos (nome, admin, itens_visiveis) values
  ('Caixa', false, ARRAY[
    '/dashboard','/movimentacoes/nova','/movimentacoes','/estoque'
  ])
  on conflict (nome) do nothing;

-- Atribui os usuários atuais (não trancar ninguém: quem ficar sem cargo vira Gerente).
update profiles set cargo_id = (select id from cargos where nome='Administrador')
  where id = '04029c48-99f4-454b-8776-4ba0c11b2f4c' and cargo_id is null;
update profiles set cargo_id = (select id from cargos where nome='Gerente')
  where id = '91268401-0a4e-493c-be74-133b23926d89' and cargo_id is null;
update profiles set cargo_id = (select id from cargos where nome='Gerente')
  where cargo_id is null;
