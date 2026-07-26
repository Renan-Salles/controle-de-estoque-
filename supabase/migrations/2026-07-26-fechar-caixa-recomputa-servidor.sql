drop function if exists public.fechar_caixa(uuid, date, numeric, numeric, numeric, numeric, numeric, numeric, text);

-- Espelha exatamente a logica de somarPorForma()/resumoDoDia() (lib/pedido-labels.ts,
-- lib/actions/caixa.ts) em SQL, pra fechar_caixa poder confiar no proprio calculo
-- em vez do que o cliente manda. Uma linha de pedido split conta a fatia certa em
-- cada forma (principal = total - valor_secundario quando ha split; secundaria =
-- valor_secundario); fiado nunca soma em dinheiro/pix/cartao_*.
create or replace function public.calcular_esperado_caixa(p_local_id uuid, p_data date)
returns table (
  esperado_dinheiro numeric,
  esperado_pix numeric,
  esperado_debito numeric,
  esperado_credito numeric,
  total_vendas integer
)
language sql
security definer
set search_path to ''
stable
as $function$
  with pagas as (
    select p.forma_pagamento, p.total, p.valor_secundario, p.forma_pagamento_secundaria
    from public.pedidos p
    where p.local_id = p_local_id
      and p.status = 'concluida'
      and p.pago = true
      and p.data_pedido >= (p_data::text || 'T00:00:00-03:00')::timestamptz
      and p.data_pedido <= (p_data::text || 'T23:59:59.999-03:00')::timestamptz
  ),
  soma as (
    select f as forma,
      coalesce(sum(case
        when pagas.forma_pagamento = f and pagas.forma_pagamento_secundaria is distinct from f
          then case when pagas.forma_pagamento_secundaria is not null then pagas.total - coalesce(pagas.valor_secundario, 0) else pagas.total end
        when pagas.forma_pagamento_secundaria = f
          then coalesce(pagas.valor_secundario, 0)
        else 0
      end), 0) as valor
    from unnest(array['dinheiro','pix','cartao_debito','cartao_credito']) as f
    left join pagas on pagas.forma_pagamento = f or pagas.forma_pagamento_secundaria = f
    group by f
  )
  select
    (select valor from soma where forma = 'dinheiro'),
    (select valor from soma where forma = 'pix'),
    (select valor from soma where forma = 'cartao_debito'),
    (select valor from soma where forma = 'cartao_credito'),
    (select count(*)::integer from pagas)
$function$;

grant execute on function public.calcular_esperado_caixa(uuid, date) to authenticated;

-- Precisa dropar antes de recriar: so trocar os nomes das colunas de
-- RETURNS TABLE via "create or replace" da erro ("cannot change name of
-- input parameter"/return type) -- so DROP + CREATE muda a shape.
drop function if exists public.fechar_caixa(uuid, numeric, text);

-- OUT params (RETURNS TABLE) prefixados com "r_" de proposito: nomes
-- iguais aos das colunas de caixa_fechamentos (data, dinheiro_contado,
-- esperado_dinheiro etc.) viram variaveis plpgsql implicitas, e o INSERT
-- logo abaixo (que referencia essas MESMAS colunas por nome) da erro em
-- runtime -- "column reference \"data\" is ambiguous: It could refer to
-- either a PL/pgSQL variable or a table column" -- confirmado ao vivo
-- (testado com SET LOCAL role authenticated + request.jwt.claims dentro de
-- uma transacao com ROLLBACK, ver
-- .superpowers/sdd/final-review-fixes-round2-report.md). Sem esse prefixo
-- TODO fechamento de caixa quebraria, admin ou nao-admin.
create or replace function public.fechar_caixa(
  p_local_id uuid,
  p_dinheiro_contado numeric,
  p_observacoes text
)
returns table (
  r_data date,
  r_dinheiro_contado numeric,
  r_esperado_dinheiro numeric,
  r_esperado_pix numeric,
  r_esperado_debito numeric,
  r_esperado_credito numeric,
  r_diferenca numeric,
  r_total_vendas integer
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_hoje date;
  v_esperado record;
  v_diferenca numeric;
begin
  if auth.uid() is null or not public.pode_acessar_local(p_local_id) then
    raise exception 'Sem permissao para fechar caixa desse local';
  end if;
  if p_dinheiro_contado is null or p_dinheiro_contado < 0 then
    raise exception 'Valor contado invalido';
  end if;

  v_hoje := (now() at time zone 'America/Sao_Paulo')::date;
  select * into v_esperado from public.calcular_esperado_caixa(p_local_id, v_hoje);
  v_diferenca := round(p_dinheiro_contado - v_esperado.esperado_dinheiro, 2);

  insert into public.caixa_fechamentos (
    local_id, data, dinheiro_contado, esperado_dinheiro, esperado_pix,
    esperado_debito, esperado_credito, diferenca, observacoes, fechado_por
  ) values (
    p_local_id, v_hoje, p_dinheiro_contado, v_esperado.esperado_dinheiro, v_esperado.esperado_pix,
    v_esperado.esperado_debito, v_esperado.esperado_credito, v_diferenca, p_observacoes, auth.uid()
  )
  on conflict (local_id, data) do update set
    dinheiro_contado = excluded.dinheiro_contado,
    esperado_dinheiro = excluded.esperado_dinheiro,
    esperado_pix = excluded.esperado_pix,
    esperado_debito = excluded.esperado_debito,
    esperado_credito = excluded.esperado_credito,
    diferenca = excluded.diferenca,
    observacoes = excluded.observacoes,
    fechado_por = excluded.fechado_por;

  return query select v_hoje, p_dinheiro_contado, v_esperado.esperado_dinheiro, v_esperado.esperado_pix,
    v_esperado.esperado_debito, v_esperado.esperado_credito, v_diferenca, v_esperado.total_vendas;
end;
$function$;

grant execute on function public.fechar_caixa(uuid, numeric, text) to authenticated;

-- Finding 2: caixaFechadoHoje() (lib/actions/pedidos.ts) fazia SELECT direto
-- em caixa_fechamentos, que agora e is_admin()-only -- sempre retornava 0
-- linhas (portanto false) pra nao-admin, mesmo com o caixa fechado. RPC
-- security definer que so responde um boolean (nenhum dado financeiro
-- exposto), checando pode_acessar_local() por dentro.
create or replace function public.caixa_fechado_em(p_local_id uuid, p_data date)
returns boolean
language sql
security definer
set search_path to ''
stable
as $function$
  select exists(
    select 1 from public.caixa_fechamentos
    where local_id = p_local_id and data = p_data and public.pode_acessar_local(p_local_id)
  )
$function$;

grant execute on function public.caixa_fechado_em(uuid, date) to authenticated;
