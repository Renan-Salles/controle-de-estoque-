-- Dados do estabelecimento por local (cupom fiscal, CNPJ, endereço)
alter table public.locais add column if not exists cnpj varchar(20);
alter table public.locais add column if not exists telefone varchar(30);
alter table public.locais add column if not exists endereco_rua varchar(200);
alter table public.locais add column if not exists endereco_numero varchar(20);
alter table public.locais add column if not exists endereco_bairro varchar(100);
alter table public.locais add column if not exists endereco_cidade varchar(100);

-- Preenche o CNPJ do Depósito que estava hardcoded no cupom
update public.locais set cnpj = '26.139.271/0001-16' where slug = 'deposito';
