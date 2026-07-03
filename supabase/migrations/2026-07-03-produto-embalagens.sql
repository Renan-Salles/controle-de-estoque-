-- Cada produto pode ser vendido em varias embalagens (unidade, fardo, caixa),
-- cada uma com seu preco. Estoque continua em unidade base -- 'unidades' diz
-- quantas unidades base uma embalagem fechada consome.
create table if not exists public.produto_embalagens (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete cascade,
  nome text not null,
  unidades numeric not null default 1 check (unidades >= 1),
  preco numeric not null default 0 check (preco >= 0),
  padrao boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_produto_embalagens_produto on public.produto_embalagens(produto_id);

alter table public.produto_embalagens enable row level security;

-- Mesmo escopo por local que produtos, via join no produto pai.
drop policy if exists "produto_embalagens acesso por local" on public.produto_embalagens;
create policy "produto_embalagens acesso por local" on public.produto_embalagens
  for all using (
    auth.uid() is not null and exists (
      select 1 from public.produtos p
      where p.id = produto_embalagens.produto_id
        and public.pode_acessar_local(p.local_id)
    )
  )
  with check (
    auth.uid() is not null and exists (
      select 1 from public.produtos p
      where p.id = produto_embalagens.produto_id
        and public.pode_acessar_local(p.local_id)
    )
  );

-- Converte o catalogo atual: 1 embalagem "Unidade" (padrao) por produto +
-- se o produto tinha embalagem != 'unidade', uma segunda com o fator antigo
-- (preco estimado = preco unitario x fator; o Renan ajusta depois).
-- Idempotente: so insere pra produtos que ainda nao tem nenhuma embalagem.
insert into public.produto_embalagens (produto_id, nome, unidades, preco, padrao)
select id, 'Unidade', 1, preco_venda_padrao, true
from public.produtos pr
where not exists (select 1 from public.produto_embalagens pe where pe.produto_id = pr.id);

insert into public.produto_embalagens (produto_id, nome, unidades, preco, padrao)
select id,
       -- fator_conversao e numeric; ::int evita nome tipo "Fardo 12.0000"
       initcap(embalagem) || ' ' || fator_conversao::int,
       fator_conversao,
       round(preco_venda_padrao * fator_conversao, 2),
       false
from public.produtos pr
where embalagem is not null and embalagem <> 'unidade' and coalesce(fator_conversao, 1) > 1
  and not exists (
    select 1 from public.produto_embalagens pe
    where pe.produto_id = pr.id and pe.unidades > 1
  );
