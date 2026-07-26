-- Rodada 3 de hardening pos-revisao adversarial. O Achado principal da
-- rodada 2 (calcular_esperado_caixa) fechou o forjamento de fechar_caixa,
-- mas a propria funcao nova saiu chamavel por "anon" (a role publica sem
-- login nenhum, so com a anon key) -- confirmado via
-- has_function_privilege('anon', oid, 'EXECUTE'). Auditoria completa
-- (grep + query em pg_proc) mostrou que TODA funcao security definer do
-- schema public sofre disso, porque o projeto nunca customizou
-- ALTER DEFAULT PRIVILEGES: o comportamento padrao do Postgres e conceder
-- EXECUTE em funcao nova pra PUBLIC, e "anon" herda de PUBLIC. Nao e algo
-- que uma migration pontual resolve pra sempre (funcao futura volta a
-- nascer aberta) -- fica registrado aqui como debito, mas o alvo desta
-- migration e fechar os buracos JA existentes.
--
-- Nem toda funcao tecnicamente anon-callable e explorável: a maioria tem
-- "auth.uid() is null" (ou is_admin(), que tambem checa auth.uid()) que
-- devolve null/false/0-linhas pra anon. Confirmado plausivel apenas nas
-- que dependiam do bug do Achado 1 abaixo (pode_acessar_local) ou nao
-- tinham NENHUMA checagem interna (Achados 2 e 3).

-- ---------------------------------------------------------------------
-- Achado 1 (raiz): pode_acessar_local() falha aberto pra anon
-- ---------------------------------------------------------------------
-- O ramo do meio (not exists(... id = auth.uid() ...)) existe pra deixar
-- passar uma conta autenticada de verdade sem local_id fixo (convencao
-- "cargo nulo ou admin=true = acesso total" documentada no CLAUDE.md).
-- Mas pra "anon", auth.uid() e NULL -- "id = auth.uid()" nunca bate,
-- "not exists(...)" fica trivialmente verdadeiro, e a funcao devolve
-- true pra QUALQUER p_local_id sem autenticacao nenhuma. Essa e a causa
-- raiz que deixava caixa_fechado_em() e listar_fechamentos_publico()
-- (que usam pode_acessar_local() como unico portao) exploraveis por anon.
--
-- Fix: exige auth.uid() is not null ANTES de avaliar os ramos de
-- fail-open. So estreita o comportamento -- muda de true pra false
-- SOMENTE pra anon; pra qualquer usuario autenticado de verdade,
-- auth.uid() is not null sempre foi verdadeiro, entao o resultado final
-- e byte-a-byte identico ao de antes.
create or replace function public.pode_acessar_local(p_local_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select
    auth.uid() is not null
    and (
      public.is_admin()
      or not exists (
        select 1 from public.profiles where id = auth.uid() and local_id is not null
      )
      or exists (
        select 1 from public.profiles where id = auth.uid() and local_id = p_local_id
      )
    );
$function$;

-- ---------------------------------------------------------------------
-- Achado 2: ajustar_estoque() nao tinha NENHUMA checagem de auth interna
-- ---------------------------------------------------------------------
-- Confirmado ao vivo: anon chamando ajustar_estoque(<produto_id>, null,
-- <saldo forjado>, <custo forjado>) reescrevia saldo/custo de um produto
-- real sem autenticacao nenhuma. Guarda minima, no mesmo padrao ja usado
-- em criar_convite/aceitar_entrega/fechar_caixa. Escopo por local (via
-- pode_acessar_local) fica de fora deste passo -- a funcao nao tem
-- local_id direto no corpo (so produto_id), exigiria um join extra em
-- produtos pra descobrir o local; o guard de autenticacao sozinho ja
-- fecha o buraco explorado (chamada sem login nenhum) e bate com o nivel
-- de protecao que toda outra escrita privilegiada do sistema tem hoje.
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
as $function$
declare
  v_saldo_atual numeric;
  v_custo_atual numeric;
  v_saldo_novo numeric;
  v_custo_novo numeric;
  v_delta numeric;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;

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
$function$;

-- ---------------------------------------------------------------------
-- Achado 3: stats_cliente() nao tinha NENHUMA checagem de auth interna
-- ---------------------------------------------------------------------
-- Confirmado ao vivo: anon recebia valor_total/ticket_medio reais de
-- qualquer cliente. Diferente do Achado 2, aqui o fix e so bloquear anon
-- especificamente -- essa RPC e intencionalmente legivel por QUALQUER
-- autenticado (nao so admin), decisao original do Grupo F: um Funcionario
-- legitimamente ja consegue derivar isso do historico de pedidos, so a
-- UI que decide o que renderizar. Precisou virar plpgsql (era "language
-- sql") pra caber o "if" -- mesmo padrao de conversao ja usado em
-- calcular_dre/calcular_dre_serie (2026-07-25-dre-rpc-so-admin.sql).
create or replace function public.stats_cliente(p_cliente_id uuid, p_local_id uuid)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;

  return (
    with
    pedidos_c as (
      select total, data_pedido
      from public.pedidos
      where cliente_id = p_cliente_id
        and local_id = p_local_id
        and status != 'cancelada'
    ),
    fav as (
      select pr.nome, sum(pi.quantidade_pedida) as qtd
      from public.pedido_itens pi
      join public.pedidos p on p.id = pi.pedido_id
      join public.produtos pr on pr.id = pi.produto_id
      where p.cliente_id = p_cliente_id
        and p.local_id = p_local_id
        and p.status != 'cancelada'
      group by pr.id, pr.nome
      order by qtd desc
      limit 1
    )
    select json_build_object(
      'total_compras',    (select count(*) from pedidos_c),
      'valor_total',      (select coalesce(sum(total), 0) from pedidos_c),
      'ticket_medio',     (select coalesce(avg(total), 0) from pedidos_c),
      'ultima_compra',    (select max(data_pedido) from pedidos_c),
      'produto_favorito', (select nome from fav)
    )
  );
end;
$function$;

-- ---------------------------------------------------------------------
-- Achado 4: endurecimento defesa-em-profundidade -- REVOKE explicito de
-- PUBLIC/anon em toda funcao security definer criada ou tocada pelas 3
-- rodadas desta feature, mesmo depois dos Achados 1-3 fecharem os
-- caminhos realmente exploraveis. Assim, se o corpo de alguma dessas
-- funcoes for alterado no futuro e alguem esquecer de checar auth.uid(),
-- o REVOKE ja bloqueia a chamada antes mesmo de entrar na funcao (nao
-- depende de ninguem lembrar de repetir a checagem interna).
--
-- consultar_convite/resgatar_convite ficam DE FORA de proposito -- sao
-- o fluxo de convite pre-cadastro, tem que continuar chamaveis por
-- visitante sem login.
--
-- Assinaturas conferidas contra pg_get_function_identity_arguments()
-- direto no banco (nao de memoria) antes de escrever este bloco -- ver
-- .superpowers/sdd/final-review-fixes-round3-report.md pra query e
-- resultado completo.
--
-- IMPORTANTE, descoberto testando este bloco numa transacao com ROLLBACK
-- antes de aplicar de verdade: "revoke ... from public" sozinho NAO basta
-- aqui. pg_proc.proacl mostra que toda funcao nesse schema tem DOIS
-- grants de EXECUTE independentes -- um pra PUBLIC (o default do
-- Postgres) e outro DIRETO pra "anon" (o setup padrao do Supabase roda
-- "alter default privileges in schema public grant execute on functions
-- to anon, authenticated, service_role" na criacao do projeto). Revogar
-- so de PUBLIC deixa o grant direto de "anon" intacto -- confirmado ao
-- vivo: has_function_privilege('anon', ..., 'EXECUTE') continuava true
-- depois de um "revoke ... from public" isolado. Por isso "anon" entra
-- explicitamente na clausula FROM abaixo, ao lado de "public".
revoke execute on function public.calcular_dre(uuid, date) from public, anon;
revoke execute on function public.calcular_dre_serie(uuid, integer) from public, anon;
revoke execute on function public.calcular_esperado_caixa(uuid, date) from public, anon;
revoke execute on function public.caixa_fechado_em(uuid, date) from public, anon;
revoke execute on function public.listar_fechamentos_publico(uuid, integer) from public, anon;
revoke execute on function public.fechar_caixa(uuid, numeric, text) from public, anon;
revoke execute on function public.ajustar_estoque(uuid, numeric, numeric, numeric) from public, anon;
revoke execute on function public.stats_cliente(uuid, uuid) from public, anon;

grant execute on function public.calcular_dre(uuid, date) to authenticated;
grant execute on function public.calcular_dre_serie(uuid, integer) to authenticated;
grant execute on function public.calcular_esperado_caixa(uuid, date) to authenticated;
grant execute on function public.caixa_fechado_em(uuid, date) to authenticated;
grant execute on function public.listar_fechamentos_publico(uuid, integer) to authenticated;
grant execute on function public.fechar_caixa(uuid, numeric, text) to authenticated;
grant execute on function public.ajustar_estoque(uuid, numeric, numeric, numeric) to authenticated;
grant execute on function public.stats_cliente(uuid, uuid) to authenticated;
