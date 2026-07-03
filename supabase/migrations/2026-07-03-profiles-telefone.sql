-- Telefone do membro da equipe: habilita o botao "avisar entregador no
-- WhatsApp" quando uma entrega e designada a ele.
alter table public.profiles
  add column if not exists telefone text;
