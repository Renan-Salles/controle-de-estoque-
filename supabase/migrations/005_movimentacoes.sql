create table if not exists public.movimentacoes_estoque (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid references public.produtos(id) not null,
  tipo varchar(50) not null check (tipo in (
    'entrada_compra', 'saida_venda', 'ajuste_inventario',
    'descarte', 'devolucao_cliente', 'devolucao_fornecedor'
  )),
  quantidade numeric(10,3) not null,
  custo_unitario numeric(10,2),
  saldo_apos numeric(10,3) not null,
  referencia_tipo varchar(50),
  referencia_id uuid,
  usuario_id uuid references auth.users(id),
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists idx_mov_produto on public.movimentacoes_estoque(produto_id);
create index if not exists idx_mov_created on public.movimentacoes_estoque(created_at);

alter table public.movimentacoes_estoque enable row level security;
drop policy if exists "autenticados veem movimentacoes" on public.movimentacoes_estoque;
create policy "autenticados veem movimentacoes" on public.movimentacoes_estoque for select using (auth.uid() is not null);
drop policy if exists "autenticados inserem movimentacoes" on public.movimentacoes_estoque;
create policy "autenticados inserem movimentacoes" on public.movimentacoes_estoque for insert with check (auth.uid() is not null);
