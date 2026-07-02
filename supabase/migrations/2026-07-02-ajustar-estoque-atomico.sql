-- registrarVenda, cancelarVenda, registrarEntrada, darEntrada e
-- ajustarEstoque faziam todos o mesmo padrao perigoso: SELECT saldo_atual,
-- calcula o novo valor em JS, UPDATE de volta. Sem trava nem transacao.
-- Confirmado ao vivo: 10 "vendas" simultaneas do mesmo produto perderam 9
-- atualizacoes (leram o mesmo saldo antes de qualquer uma escrever).
--
-- ajustar_estoque() centraliza toda escrita de saldo_atual/custo_medio.
-- SELECT ... FOR UPDATE trava a linha ate o fim da chamada (cada RPC e uma
-- transacao implicita), serializando concorrentes no MESMO produto -- a
-- segunda chamada espera a primeira terminar e le o valor ja atualizado.
--
-- Dois modos, nunca os dois juntos:
--   p_delta:      ajuste relativo (venda: negativo: entrada/devolucao: positivo)
--   p_novo_saldo: ajuste absoluto (acerto de inventario -- "e isso que sobrou")
-- p_novo_custo_unitario: informado so em entrada de compra, recalcula a
--   media ponderada. Null em venda/devolucao/perda/acerto (custo nao muda).
-- Delta negativo que deixaria saldo < 0 vira excecao ESTOQUE_INSUFICIENTE
-- (nao silencia: quem chama trata e mostra erro claro), exceto em
-- p_novo_saldo (acerto sempre aceita o valor fisico contado).

create or replace function public.ajustar_estoque(
  p_produto_id uuid,
  p_delta numeric default null,
  p_novo_saldo numeric default null,
  p_novo_custo_unitario numeric default null
)
returns table (saldo_anterior numeric, saldo_novo numeric, custo_medio numeric, delta_aplicado numeric)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_saldo_atual numeric;
  v_custo_atual numeric;
  v_saldo_novo numeric;
  v_custo_novo numeric;
  v_delta numeric;
begin
  if p_delta is null and p_novo_saldo is null then
    raise exception 'ajustar_estoque: informe p_delta ou p_novo_saldo';
  end if;

  select e.saldo_atual, e.custo_medio into v_saldo_atual, v_custo_atual
  from public.estoque e
  where e.produto_id = p_produto_id
  for update;

  if not found then
    raise exception 'ajustar_estoque: produto % nao tem linha de estoque', p_produto_id;
  end if;

  if p_novo_saldo is not null then
    v_delta := p_novo_saldo - v_saldo_atual;
    v_saldo_novo := greatest(0, p_novo_saldo);
  else
    v_delta := p_delta;
    v_saldo_novo := v_saldo_atual + p_delta;
    if v_saldo_novo < 0 then
      raise exception 'ESTOQUE_INSUFICIENTE saldo_atual=%', v_saldo_atual;
    end if;
  end if;

  if p_novo_custo_unitario is not null and v_delta > 0 then
    v_custo_novo := case
      when v_saldo_atual > 0
        then (v_saldo_atual * v_custo_atual + v_delta * p_novo_custo_unitario) / nullif(v_saldo_novo, 0)
      else p_novo_custo_unitario
    end;
  else
    v_custo_novo := v_custo_atual;
  end if;

  update public.estoque e
  set saldo_atual = v_saldo_novo,
      custo_medio = coalesce(v_custo_novo, v_custo_atual),
      updated_at = now()
  where e.produto_id = p_produto_id;

  return query select v_saldo_atual, v_saldo_novo, coalesce(v_custo_novo, v_custo_atual), v_delta;
end;
$$;

grant execute on function public.ajustar_estoque(uuid, numeric, numeric, numeric) to authenticated;
