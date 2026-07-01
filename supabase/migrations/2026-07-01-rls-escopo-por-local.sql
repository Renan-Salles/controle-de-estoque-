-- Nenhuma policy de RLS filtrava por local_id -- todas so checavam
-- "auth.uid() is not null" (esta logado?), nunca "esse dado e do local
-- dessa pessoa?". O isolamento entre locais (ex. R$ Deposito / Imperio
-- Salles) existia so na aplicacao (cookie local_ativo + getLocalAtivo()),
-- nunca no banco. Confirmado ao vivo: um Caixa vinculado a um local
-- conseguia ler e escrever produtos, clientes etc. de outro local via
-- chamada direta (bypass da UI).
--
-- Fix: funcao auxiliar pode_acessar_local(), com o MESMO fail-open que a
-- app ja usa em lib/local.ts getLocalAtivo() -- admin nunca e restrito,
-- conta sem local_id fixo tambem nao (conta antiga / fail-open
-- intencional), so quem tem local_id fixo (contas criadas por convite)
-- fica preso aquele local. Aplicada nas tabelas operacionais com
-- local_id direto, e via join nas que referenciam produto/pedido/cliente.

create or replace function public.pode_acessar_local(p_local_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select
    public.is_admin()
    or not exists (
      select 1 from public.profiles where id = auth.uid() and local_id is not null
    )
    or exists (
      select 1 from public.profiles where id = auth.uid() and local_id = p_local_id
    );
$$;

grant execute on function public.pode_acessar_local(uuid) to authenticated;

-- produtos ------------------------------------------------------------
drop policy if exists "autenticados escrevem produtos" on public.produtos;
create policy "autenticados escrevem produtos" on public.produtos
  for all
  using (auth.uid() is not null and public.pode_acessar_local(local_id))
  with check (auth.uid() is not null and public.pode_acessar_local(local_id));

drop policy if exists "autenticados leem produtos" on public.produtos;
create policy "autenticados leem produtos" on public.produtos
  for select
  using (auth.uid() is not null and public.pode_acessar_local(local_id));

-- clientes --------------------------------------------------------------
drop policy if exists "autenticados gerenciam clientes" on public.clientes;
create policy "autenticados gerenciam clientes" on public.clientes
  for all
  using (auth.uid() is not null and public.pode_acessar_local(local_id))
  with check (auth.uid() is not null and public.pode_acessar_local(local_id));

-- fornecedores ------------------------------------------------------------
drop policy if exists "autenticados gerenciam fornecedores" on public.fornecedores;
create policy "autenticados gerenciam fornecedores" on public.fornecedores
  for all
  using (auth.uid() is not null and public.pode_acessar_local(local_id))
  with check (auth.uid() is not null and public.pode_acessar_local(local_id));

-- pedidos ------------------------------------------------------------
drop policy if exists "autenticados gerenciam pedidos" on public.pedidos;
create policy "autenticados gerenciam pedidos" on public.pedidos
  for all
  using (auth.uid() is not null and public.pode_acessar_local(local_id))
  with check (auth.uid() is not null and public.pode_acessar_local(local_id));

-- contas_pagar ------------------------------------------------------------
-- "admin ve contas pagar" fica intacta (admin nunca e restrito por local).
-- So a policy aberta pra todo autenticado ganha o filtro de local.
drop policy if exists "gerente ve contas pagar" on public.contas_pagar;
create policy "gerente ve contas pagar" on public.contas_pagar
  for all
  using (auth.uid() is not null and public.pode_acessar_local(local_id))
  with check (auth.uid() is not null and public.pode_acessar_local(local_id));

-- custos_fixos ------------------------------------------------------------
drop policy if exists "autenticados gerenciam custos_fixos" on public.custos_fixos;
create policy "autenticados gerenciam custos_fixos" on public.custos_fixos
  for all
  using (auth.uid() is not null and public.pode_acessar_local(local_id))
  with check (auth.uid() is not null and public.pode_acessar_local(local_id));

-- estoque (via produto_id -> produtos.local_id) ------------------------
drop policy if exists "autenticados escrevem estoque" on public.estoque;
create policy "autenticados escrevem estoque" on public.estoque
  for all
  using (
    auth.uid() is not null
    and public.pode_acessar_local((select p.local_id from public.produtos p where p.id = estoque.produto_id))
  )
  with check (
    auth.uid() is not null
    and public.pode_acessar_local((select p.local_id from public.produtos p where p.id = estoque.produto_id))
  );

drop policy if exists "autenticados leem estoque" on public.estoque;
create policy "autenticados leem estoque" on public.estoque
  for select
  using (
    auth.uid() is not null
    and public.pode_acessar_local((select p.local_id from public.produtos p where p.id = estoque.produto_id))
  );

-- movimentacoes_estoque (via produto_id -> produtos.local_id) -----------
-- So tem policy de INSERT e SELECT (ledger append-only, sem update/delete
-- de proposito -- mantido assim).
drop policy if exists "autenticados inserem movimentacoes" on public.movimentacoes_estoque;
create policy "autenticados inserem movimentacoes" on public.movimentacoes_estoque
  for insert
  with check (
    auth.uid() is not null
    and public.pode_acessar_local((select p.local_id from public.produtos p where p.id = movimentacoes_estoque.produto_id))
  );

drop policy if exists "autenticados veem movimentacoes" on public.movimentacoes_estoque;
create policy "autenticados veem movimentacoes" on public.movimentacoes_estoque
  for select
  using (
    auth.uid() is not null
    and public.pode_acessar_local((select p.local_id from public.produtos p where p.id = movimentacoes_estoque.produto_id))
  );

-- pedido_itens (via pedido_id -> pedidos.local_id) -----------------------
drop policy if exists "autenticados gerenciam itens" on public.pedido_itens;
create policy "autenticados gerenciam itens" on public.pedido_itens
  for all
  using (
    auth.uid() is not null
    and public.pode_acessar_local((select pe.local_id from public.pedidos pe where pe.id = pedido_itens.pedido_id))
  )
  with check (
    auth.uid() is not null
    and public.pode_acessar_local((select pe.local_id from public.pedidos pe where pe.id = pedido_itens.pedido_id))
  );

-- contas_receber (via cliente_id -> clientes.local_id) -------------------
-- "admin ve contas receber" fica intacta. "gerente ve receber vinculado"
-- era um SELECT redundante com a policy ALL de baixo (mesmo qual, sem
-- filtro nenhum) -- removida, senao um SELECT sem escopo de local ali
-- anularia o filtro que a policy ALL abaixo esta aplicando.
drop policy if exists "gerente ve receber vinculado" on public.contas_receber;
drop policy if exists "autenticados gerenciam contas_receber" on public.contas_receber;
create policy "autenticados gerenciam contas_receber" on public.contas_receber
  for all
  using (
    auth.uid() is not null
    and public.pode_acessar_local((select c.local_id from public.clientes c where c.id = contas_receber.cliente_id))
  )
  with check (
    auth.uid() is not null
    and public.pode_acessar_local((select c.local_id from public.clientes c where c.id = contas_receber.cliente_id))
  );
