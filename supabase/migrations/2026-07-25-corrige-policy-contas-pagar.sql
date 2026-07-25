-- supabase/migrations/2026-07-25-corrige-policy-contas-pagar.sql
-- "gerente ve contas pagar" nao filtra por cargo (so por local), e por ser
-- permissiva soma-se via OR com "admin ve contas pagar" (is_admin()),
-- anulando a intencao de admin-only. Funcionario/Entregador nunca
-- leem/gravam contas_pagar hoje (nao esta em itens_visiveis de nenhum dos
-- dois), entao remover essa policy nao muda fluxo nenhum deles.
drop policy if exists "gerente ve contas pagar" on public.contas_pagar;
