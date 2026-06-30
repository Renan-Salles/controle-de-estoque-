-- Reabilita fiado como forma de pagamento de venda (migration 010 havia removido).
-- Agora fiado gera automaticamente uma linha em contas_receber (lib/actions/pedidos.ts).

alter table public.pedidos drop constraint if exists pedidos_forma_pagamento_check;
alter table public.pedidos add constraint pedidos_forma_pagamento_check
  check (forma_pagamento in ('dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'fiado'));
