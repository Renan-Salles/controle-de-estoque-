-- Chave Pix do local (CPF/CNPJ/email/celular/aleatoria) pro QR estatico
-- gerado na venda. Null = botao de QR nao aparece.
alter table public.locais
  add column if not exists chave_pix text;
