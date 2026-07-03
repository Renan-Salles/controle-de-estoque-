-- Endereco de entrega em texto livre: usado quando a venda e tipo Entrega
-- mas nao tem cliente cadastrado (o formulario nao tinha onde digitar isso
-- antes). Mesmo formato jsonb de clientes.endereco, pra reaproveitar a
-- formatacao e a busca de taxa por bairro ja existentes.
alter table public.pedidos
  add column if not exists endereco_entrega jsonb;
