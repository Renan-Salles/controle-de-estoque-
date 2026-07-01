-- Entrega/retirada: venda ganha tipo de fulfillment, quem entrega, frete
-- opcional, e controle separado de pagamento/conclusão. Balcão (default)
-- não muda de comportamento nenhum.

alter table public.pedidos
  add column if not exists tipo_fulfillment varchar(20) not null default 'balcao',
  add column if not exists entregador_id uuid references public.profiles(id),
  add column if not exists frete numeric not null default 0,
  add column if not exists pago boolean not null default true,
  add column if not exists concluido_em timestamptz;

alter table public.pedidos drop constraint if exists pedidos_tipo_fulfillment_check;
alter table public.pedidos add constraint pedidos_tipo_fulfillment_check
  check (tipo_fulfillment in ('balcao', 'entrega', 'retirada'));

-- Acelera o filtro "aguardando entrega/retirada" em Movimentações.
create index if not exists idx_pedidos_fulfillment_pendente
  on public.pedidos (local_id, tipo_fulfillment)
  where concluido_em is null and tipo_fulfillment <> 'balcao';
