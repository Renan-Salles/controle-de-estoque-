-- Tempo de entrega: quando o entregador saiu (novo) ate quando
-- confirmou a entrega (concluido_em, ja existe). So faz sentido pra
-- tipo_fulfillment='entrega' -- retirada nao tem trajeto.
alter table public.pedidos
  add column if not exists saiu_entrega_em timestamptz;
