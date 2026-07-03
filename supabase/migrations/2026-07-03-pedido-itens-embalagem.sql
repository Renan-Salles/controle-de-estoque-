-- Guarda QUAL forma de venda foi usada em cada item (Unidade, Fardo 12...).
-- Hoje so a quantidade em unidade base sobrevive; recibo/romaneio/detalhe
-- nao conseguem mostrar "2 fardos" -- mostram "24 unidade", confuso.
alter table public.pedido_itens
  add column if not exists embalagem_nome text,
  add column if not exists embalagem_unidades numeric;
