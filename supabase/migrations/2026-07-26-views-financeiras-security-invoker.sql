-- Varredura final: 3 views ainda legiveis por anon sem login nenhum
-- (v_posicao_estoque ja foi corrigida numa migration anterior deste mesmo
-- pacote, mas o sweep na hora ficou restrito a ela -- v_faturamento_mensal,
-- v_curva_abc e v_aging_receber passaram batido porque uma view sem
-- security_invoker roda com o dono (postgres) e ignora a RLS das tabelas
-- de baixo, e o grant default do projeto pra anon nunca foi revogado).
-- Mesma causa raiz documentada em 2026-07-26-v-posicao-estoque-rls.sql,
-- so que essas tres devolvem receita/faturamento/cliente com divida em
-- aberto -- exatamente os dados que a feature de restricao financeira por
-- cargo existe pra proteger, agora expostos pra qualquer um com a anon key
-- publica, sem nem precisar de login.
alter view public.v_faturamento_mensal set (security_invoker = on);
alter view public.v_curva_abc          set (security_invoker = on);
alter view public.v_aging_receber      set (security_invoker = on);

revoke all on public.v_faturamento_mensal from anon;
revoke all on public.v_curva_abc          from anon;
revoke all on public.v_aging_receber      from anon;
