-- Fila de entregas: entrega criada sem entregador_id fica disponivel pra
-- qualquer pessoa com cargo Entregador do mesmo local aceitar. security
-- definer porque o entregador precisa escrever numa linha de pedidos que
-- ainda nao e dele (RLS normal nao deixa, e createServiceClient() nao
-- bypassa RLS com sessao ativa -- mesmo padrao de criar_convite).
-- A trava de concorrencia (dois aceitando ao mesmo tempo) e o proprio
-- WHERE entregador_id IS NULL: so um UPDATE acha a linha.
create or replace function public.aceitar_entrega(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cargo_entregador boolean;
  v_linhas int;
begin
  select exists (
    select 1 from public.profiles p
    join public.cargos c on c.id = p.cargo_id
    where p.id = auth.uid() and c.nome = 'Entregador'
  ) into v_cargo_entregador;

  if not v_cargo_entregador then
    raise exception 'Só quem tem cargo Entregador pode aceitar entregas';
  end if;

  update public.pedidos
  set entregador_id = auth.uid()
  where id = p_pedido_id
    and entregador_id is null
    and tipo_fulfillment = 'entrega'
    and status = 'concluida'
    and local_id = (select local_id from public.profiles where id = auth.uid());

  get diagnostics v_linhas = row_count;
  if v_linhas = 0 then
    raise exception 'Essa entrega já foi aceita por outra pessoa (ou não está mais disponível)';
  end if;
end;
$$;
