-- A reorganizacao da sidebar trocou dois "bridges" implicitos de permissao
-- (ter /financeiro/resultado liberava todas as sub-telas financeiras; ter
-- /movimentacoes liberava a badge de pedidos pendentes) por entradas
-- explicitas no catalogo. Sem esse backfill, cargos que ja tinham acesso
-- perderiam telas silenciosamente na proxima vez que forem atribuidos a
-- alguem (hoje nenhum profile usa Gerente/Caixa, mas os cargos existem
-- prontos pra convite).
update public.cargos
set itens_visiveis = (
  select array_agg(distinct v)
  from unnest(
    itens_visiveis
    || case when '/financeiro/resultado' = any(itens_visiveis)
         then array['/financeiro/a-pagar', '/financeiro/a-receber', '/financeiro/custos-fixos', '/financeiro/formas-pagamento']
         else array[]::text[]
       end
    || case when '/relatorios' = any(itens_visiveis)
         then array['/financeiro/relatorios']
         else array[]::text[]
       end
    || case when '/movimentacoes' = any(itens_visiveis)
         then array['/pedidos']
         else array[]::text[]
       end
  ) as v
)
where admin = false;
