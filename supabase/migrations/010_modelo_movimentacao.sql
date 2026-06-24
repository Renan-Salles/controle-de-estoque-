-- Modelo de movimentacao: venda a vista (sem fiado) e sem ciclo de status de entrega.
-- Toda venda nasce concluida. Cliente passa a ser opcional na venda.

-- Cliente opcional na venda (balcao sem cliente identificado)
alter table public.pedidos alter column cliente_id drop not null;

-- Remove os checks antigos ANTES de converter os dados (senao os updates violam o check vigente)
alter table public.pedidos drop constraint if exists pedidos_forma_pagamento_check;
alter table public.pedidos drop constraint if exists pedidos_status_check;

-- Converte dados atuais para o novo modelo
update public.pedidos set forma_pagamento = 'pix' where forma_pagamento in ('fiado', 'boleto');
update public.pedidos set status = 'concluida' where status not in ('concluida', 'cancelada');
update public.clientes set forma_pagamento_padrao = 'dinheiro' where forma_pagamento_padrao = 'fiado';

-- Novos checks (a vista, sem fluxo de entrega)
alter table public.pedidos add constraint pedidos_forma_pagamento_check
  check (forma_pagamento in ('dinheiro', 'pix', 'cartao_debito', 'cartao_credito'));
alter table public.pedidos add constraint pedidos_status_check
  check (status in ('concluida', 'cancelada'));
alter table public.pedidos alter column status set default 'concluida';
