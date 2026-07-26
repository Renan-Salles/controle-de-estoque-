-- Causa raiz sistemica achada na revisao adversarial da feature de
-- restricao financeira por cargo: toda funcao NOVA criada pelo role
-- `postgres` (role usado por todas as migrations deste repo, ver
-- CLAUDE.md) nascia com EXECUTE liberado por padrao pra `anon` e
-- `authenticated`. Isso fez pelo menos 3 funcoes security definer
-- criadas/tocadas nessa feature ficarem chamaveis sem login nenhum ate
-- alguem lembrar de revogar manualmente.
--
-- Passo 1: aperta o default pra objetos FUTUROS (nao retroativo).
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, public;

-- Passo 2 (o que realmente fecha o buraco AGORA): testado ao vivo que o
-- Passo 1 sozinho NAO impede uma funcao nova sem grant explicito de
-- nascer executavel por anon/authenticated mesmo assim -- o projeto
-- Supabase tem algum mecanismo de reconciliacao automatica (fora do
-- alcance de ALTER DEFAULT PRIVILEGES) que reaplica grant de exposicao
-- de API em objetos novos do schema public, provavelmente ligado a
-- feature de "instant API" do proprio Supabase. Revoga PUBLIC de toda
-- funcao JA existente agora (nao muda nada pra quem ja tem grant
-- explicito nomeado, que e o padrao que toda funcao deste repo ja segue).
revoke execute on all functions in schema public from public;

-- IMPORTANTE pra quem for criar uma funcao security definer nova daqui
-- pra frente: NAO confiar que esses dois passos acima bastam. Sempre
-- incluir na PROPRIA migration da funcao um `grant execute on function
-- ... to authenticated;` explicito (e `revoke ... from anon` explicito
-- se a funcao nao for uma das duas exceções pre-login: consultar_convite/
-- resgatar_convite) -- essa e a unica mitigacao comprovada nesse repo
-- (testada e confirmada funcionando em produção pra 8 funcoes distintas
-- durante esse trabalho). Ver CLAUDE.md.
