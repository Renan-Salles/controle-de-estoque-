-- v_posicao_estoque nao tinha security_invoker (roda com o privilegio de
-- quem CRIOU a view, nao de quem consulta) e tinha SELECT liberado pra
-- anon -- confirmado ao vivo: "select count(*) from v_posicao_estoque"
-- como role anon (sem login nenhum) devolvia linhas reais com
-- custo_medio/valor_total, enquanto consultar produtos/estoque direto como
-- anon devolvia 0 linhas (RLS correta nas tabelas base). Reachable via
-- GET /rest/v1/v_posicao_estoque so com a anon key publica, sem JWT nenhum.
--
-- security_invoker=on faz a view respeitar a RLS de produtos/estoque/
-- categorias do CHAMADOR (ja corretamente escopada por local_id/
-- pode_acessar_local -- nao precisa de mudanca nelas). revoke de anon fecha
-- o acesso nao-autenticado por completo (app e 100% interno, atras de
-- /login -- nenhum caller legitimo usa esse anon).
alter view public.v_posicao_estoque set (security_invoker = on);
revoke all on public.v_posicao_estoque from anon;
