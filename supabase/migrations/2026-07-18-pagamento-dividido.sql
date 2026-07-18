-- Generaliza as colunas do "fiado parcial" pra qualquer split de 2 formas
-- de pagamento. Essa migration so renomeia; a regra de negocio que aceita
-- split fora do fiado vem no codigo da Task 2.
alter table public.pedidos
  rename column forma_pagamento_parcial to forma_pagamento_secundaria;
alter table public.pedidos
  rename column valor_pago_agora to valor_secundario;

alter table public.pedidos
  drop constraint if exists pedidos_forma_pagamento_parcial_check;
alter table public.pedidos
  add constraint pedidos_forma_pagamento_secundaria_check
  check (
    forma_pagamento_secundaria in
      ('dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'fiado')
    or forma_pagamento_secundaria is null
  );
