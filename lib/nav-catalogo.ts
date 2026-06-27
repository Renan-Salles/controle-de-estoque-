// Catálogo de itens da sidebar + regras de permissão. Dados puros (sem imports
// de servidor), usados tanto no client (tela de cargos) quanto no servidor
// (layout/guard). As chaves são os próprios hrefs das rotas.

export type Cargo = {
  id: string
  nome: string
  admin: boolean
  itens_visiveis: string[]
  ativo: boolean
}

export type NavCatalogoItem = { href: string; label: string; grupo: string }

// Todos os itens configuráveis, agrupados como aparecem na sidebar.
export const NAV_CATALOGO: NavCatalogoItem[] = [
  { href: '/dashboard', label: 'Dashboard', grupo: 'Geral' },
  { href: '/movimentacoes/nova', label: 'Nova Movimentação', grupo: 'Geral' },
  { href: '/movimentacoes', label: 'Movimentações', grupo: 'Vendas' },
  { href: '/clientes', label: 'Clientes', grupo: 'Vendas' },
  { href: '/estoque', label: 'Posição de estoque', grupo: 'Estoque' },
  { href: '/estoque/reposicao', label: 'Reposição', grupo: 'Estoque' },
  { href: '/produtos', label: 'Produtos', grupo: 'Estoque' },
  { href: '/fornecedores', label: 'Fornecedores', grupo: 'Estoque' },
  { href: '/financeiro/resultado', label: 'Financeiro (resultado, contas, formas)', grupo: 'Financeiro' },
  { href: '/relatorios', label: 'Vendas por período', grupo: 'Relatórios' },
  { href: '/relatorios/produto', label: 'Vendas por produto', grupo: 'Relatórios' },
  { href: '/relatorios/cliente', label: 'Vendas por cliente', grupo: 'Relatórios' },
]

// Pode acessar a rota? Admin e cargo nulo (fail-open) liberam tudo. Dashboard é
// sempre permitido (destino seguro de redirect). Demais: precisa estar nos itens
// visíveis do cargo (casando href exato ou como prefixo da sub-rota).
export function rotaPermitida(pathname: string, cargo: Cargo | null): boolean {
  if (!cargo || cargo.admin) return true
  if (pathname === '/' || pathname.startsWith('/dashboard')) return true
  // O detalhe/romaneio de um pedido é parte de Movimentações; quem vê
  // Movimentações abre a venda (o botão "Pedidos" foi unificado nele).
  if (pathname.startsWith('/pedidos') && cargo.itens_visiveis.includes('/movimentacoes')) {
    return true
  }
  // Financeiro é um botão só (/financeiro/resultado); libera todas as sub-telas
  // (a pagar, formas de pagamento, faturamento) que as abas internas trocam.
  if (pathname.startsWith('/financeiro') && cargo.itens_visiveis.includes('/financeiro/resultado')) {
    return true
  }
  // Faturamento & ABC também é alcançado pelas abas de Relatórios.
  if (pathname === '/financeiro/relatorios' && cargo.itens_visiveis.includes('/relatorios')) {
    return true
  }
  return cargo.itens_visiveis.some(
    (href) => pathname === href || pathname.startsWith(href + '/'),
  )
}

// Item da sidebar aparece? null = sem restrição (admin/fail-open) → mostra tudo.
export function itemVisivel(href: string, itensVisiveis: string[] | null): boolean {
  if (itensVisiveis === null) return true
  return itensVisiveis.includes(href)
}
