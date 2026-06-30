-- contas_receber so permitia escrita para admin (via is_admin()), mas fiado e' criado
-- automaticamente quando QUALQUER usuario autenticado registra uma venda (lib/actions/pedidos.ts)
-- e marcado como recebido por qualquer um na tela financeiro/a-receber. Sem essa policy,
-- toda venda fiado falhava com "new row violates row-level security policy".
-- Segue o mesmo padrao usado em pedidos/estoque/clientes ("autenticados gerenciam X").

drop policy if exists "autenticados gerenciam contas_receber" on public.contas_receber;
create policy "autenticados gerenciam contas_receber" on public.contas_receber
  for all using (auth.uid() is not null);
