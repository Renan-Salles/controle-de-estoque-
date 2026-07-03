-- Fiado parcial: parte da venda pode ser paga na hora (numa forma a vista)
-- e o resto vira fiado. contas_receber ja tem valor/valor_pago prontos pra
-- isso -- so faltava o pedido guardar quanto e em que forma entrou na hora.
alter table public.pedidos
  add column if not exists valor_pago_agora numeric not null default 0;

alter table public.pedidos
  add column if not exists forma_pagamento_parcial varchar(20);

alter table public.pedidos
  drop constraint if exists pedidos_forma_pagamento_parcial_check;

alter table public.pedidos
  add constraint pedidos_forma_pagamento_parcial_check
  check (forma_pagamento_parcial in ('dinheiro', 'pix', 'cartao_debito', 'cartao_credito') or forma_pagamento_parcial is null);
