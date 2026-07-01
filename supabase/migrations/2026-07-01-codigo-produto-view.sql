-- Expoe codigo_barras (agora usado como codigo interno do produto, tipo
-- CER-0001) na view de posicao de estoque, pra aparecer na listagem e
-- poder buscar por ele.

create or replace view public.v_posicao_estoque as
select
  p.id,
  p.local_id,
  p.nome,
  p.marca,
  c.nome as categoria,
  p.embalagem,
  p.volume_ml,
  e.saldo_atual,
  p.estoque_minimo,
  p.custo_atual,
  e.custo_medio,
  (e.saldo_atual * e.custo_medio) as valor_total,
  case
    when e.saldo_atual <= 0 then 'ruptura'
    when e.saldo_atual <= p.estoque_minimo then 'critico'
    when e.saldo_atual <= p.estoque_minimo * 1.5 then 'alerta'
    else 'ok'
  end as status_estoque,
  p.preco_venda_padrao,
  p.ativo,
  p.codigo_barras
from public.produtos p
join public.estoque e on e.produto_id = p.id
join public.categorias c on c.id = p.categoria_id
where p.ativo = true;
