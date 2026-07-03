-- Consolida Gerente+Caixa num cargo Funcionario (Pedidos, Movimentacoes,
-- Estoque, Cadastro -- sem Relatorios/Financeiro) e cria o cargo Entregador
-- (sem itens na sidebar; a tela dele vive em /dashboard por cargo).
-- Defensivo: so apaga Gerente/Caixa se nenhum profile estiver vinculado
-- (hoje so o admin Renan tem profile), pra nunca tirar acesso de ninguem.
do $$
declare
  v_funcionario_itens text[] := array[
    '/dashboard', '/movimentacoes/nova', '/pedidos', '/movimentacoes',
    '/estoque', '/estoque/reposicao', '/clientes', '/produtos', '/fornecedores'
  ];
  v_tem_profile boolean;
begin
  select exists(
    select 1 from profiles p
    join cargos c on c.id = p.cargo_id
    where c.nome in ('Gerente', 'Caixa')
  ) into v_tem_profile;

  if v_tem_profile then
    raise notice 'Gerente/Caixa tem profile vinculado -- pulei a consolidacao. Rever manualmente.';
  else
    delete from cargos where nome in ('Gerente', 'Caixa') and admin = false;
    insert into cargos (nome, admin, itens_visiveis, ativo)
    values ('Funcionario', false, v_funcionario_itens, true)
    on conflict (nome) do update set itens_visiveis = excluded.itens_visiveis, ativo = true;
  end if;

  insert into cargos (nome, admin, itens_visiveis, ativo)
  values ('Entregador', false, array[]::text[], true)
  on conflict (nome) do update set itens_visiveis = excluded.itens_visiveis, ativo = true;
end $$;
