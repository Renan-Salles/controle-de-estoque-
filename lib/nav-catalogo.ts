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
  { href: '/pedidos', label: 'Pedidos', grupo: 'Operação' },
  { href: '/movimentacoes', label: 'Movimentações', grupo: 'Operação' },
  { href: '/estoque', label: 'Posição de estoque', grupo: 'Operação' },
  { href: '/estoque/reposicao', label: 'Reposição', grupo: 'Operação' },
  { href: '/estoque/contagem', label: 'Contagem de estoque', grupo: 'Operação' },
  { href: '/caixa', label: 'Caixa', grupo: 'Operação' },
  { href: '/clientes', label: 'Clientes', grupo: 'Cadastro' },
  { href: '/produtos', label: 'Produtos', grupo: 'Cadastro' },
  { href: '/fornecedores', label: 'Fornecedores', grupo: 'Cadastro' },
  { href: '/relatorios', label: 'Vendas por período', grupo: 'Relatórios' },
  { href: '/relatorios/produto', label: 'Vendas por produto', grupo: 'Relatórios' },
  { href: '/relatorios/cliente', label: 'Vendas por cliente', grupo: 'Relatórios' },
  { href: '/relatorios/entregadores', label: 'Entregadores', grupo: 'Relatórios' },
  { href: '/financeiro/relatorios', label: 'Faturamento & ABC', grupo: 'Relatórios' },
  { href: '/financeiro/resultado', label: 'Resultado', grupo: 'Relatórios' },
  { href: '/financeiro/a-pagar', label: 'A pagar', grupo: 'Relatórios' },
  { href: '/financeiro/a-receber', label: 'Fiado', grupo: 'Operação' },
  { href: '/financeiro/custos-fixos', label: 'Custos Fixos', grupo: 'Relatórios' },
  { href: '/financeiro/formas-pagamento', label: 'Formas de pagamento', grupo: 'Relatórios' },
]

// Pode acessar a rota? Admin e cargo nulo (fail-open) liberam tudo. Dashboard é
// sempre permitido (destino seguro de redirect). Demais: precisa estar nos itens
// visíveis do cargo (casando href exato ou como prefixo da sub-rota).
export function rotaPermitida(pathname: string, cargo: Cargo | null): boolean {
  if (!cargo || cargo.admin) return true
  if (pathname === '/' || pathname.startsWith('/dashboard')) return true
  // O detalhe/romaneio de um pedido e alcancado tanto por Pedidos (lista nova)
  // quanto por Movimentacoes (extrato financeiro) -- duas lentes sobre a mesma
  // venda, ver docs/superpowers/specs/2026-07-02-reorganizacao-nav-pedidos-design.md.
  if (pathname.startsWith('/pedidos') && cargo.itens_visiveis.includes('/movimentacoes')) {
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
