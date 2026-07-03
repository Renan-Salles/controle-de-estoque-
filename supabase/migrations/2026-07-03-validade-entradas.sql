-- Validade (simples, sem lote/FIFO): data opcional por item na ENTRADA.
-- A tela de Estoque lista as entradas vencendo em ate 30 dias.
alter table public.movimentacoes_estoque
  add column if not exists validade date;
