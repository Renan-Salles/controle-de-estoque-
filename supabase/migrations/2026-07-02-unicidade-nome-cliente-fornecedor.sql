-- cadastrarClienteRapido()/cadastrarFornecedorRapido() (usados no meio de
-- uma venda/entrada, sem dedup no banco) fazem so um insert direto. Duas
-- abas/pessoas cadastrando o mesmo nome quase ao mesmo tempo criam dois
-- registros com o mesmo nome e local, fragmentando historico de compra e
-- credito (fiado) do cliente entre dois UUIDs diferentes.
--
-- Indice unico fecha a corrida de vez (nao da pra ter dois inserts com o
-- mesmo nome vencerem ao mesmo tempo). O codigo trata a violacao (23505)
-- devolvendo o registro existente em vez de erro cru.

create unique index if not exists clientes_local_nome_unq
  on public.clientes (local_id, lower(nome));

create unique index if not exists fornecedores_local_nome_unq
  on public.fornecedores (local_id, lower(nome));
