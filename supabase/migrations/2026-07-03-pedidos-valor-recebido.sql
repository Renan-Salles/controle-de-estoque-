-- Troco na venda em dinheiro: guarda quanto o cliente entregou, pro cupom
-- reimprimivel mostrar Recebido/Troco. Null = nao informado (formas
-- eletronicas ou operador pulou o campo).
alter table public.pedidos
  add column if not exists valor_recebido numeric;
