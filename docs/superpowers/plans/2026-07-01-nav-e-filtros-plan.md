# Reorganização de navegação + filtros em Produtos — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar a navegação lateral (Cadastros novo, Movimentações e Estoque viram itens diretos, Financeiro perde a aba duplicada) e adicionar filtros de Categoria + Status de estoque na tabela de Produtos.

**Architecture:** Mudança puramente de apresentação/roteamento no App Router existente — nenhuma migração de banco, nenhuma nova query. Reaproveita os padrões já existentes: `FinanceiroTabs`/`RelatoriosTabs` (barra de abas via `Link`) como modelo para o novo `EstoqueTabs`; `Tabs`/`TabsList`/`TabsTrigger` (já usado em `/estoque`) para os filtros de Produtos.

**Tech Stack:** Next.js 16 App Router, React client components, Tailwind v4, `@base-ui/react` (via `components/ui/tabs`).

## Global Constraints

- Nenhuma nova rota, nenhuma migração de banco.
- `/financeiro/relatorios` não muda de URL — só a aba que leva até ela.
- `/estoque` e `/estoque/reposicao` continuam páginas/rotas separadas, cada uma com sua própria busca de dados.
- Filtros de Produtos operam client-side sobre a lista já carregada por `buscarPosicaoProdutos()` — sem chamada nova ao banco.
- Cargos com `itens_visiveis` restrito não podem quebrar: os hrefs `/clientes`, `/fornecedores`, `/produtos`, `/estoque`, `/estoque/reposicao` já existem no `NAV_CATALOGO` e não mudam de valor, só de rótulo de agrupamento.

---

### Task 1: `EstoqueTabs` — abas Posição/Reposição

**Files:**
- Create: `components/estoque/EstoqueTabs.tsx`
- Modify: `app/(app)/estoque/page.tsx` (adicionar import + render)
- Modify: `app/(app)/estoque/reposicao/page.tsx` (adicionar import + render)

**Interfaces:**
- Produces: `EstoqueTabs` (componente sem props, usa `usePathname()` internamente — mesmo contrato de `FinanceiroTabs`/`RelatoriosTabs`).

- [ ] **Step 1: Criar o componente `EstoqueTabs`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

// Navegação entre Posição e Reposição de estoque (segmented control).
// Mesmo padrão de FinanceiroTabs/RelatoriosTabs: barra de links, aba ativa
// pelo pathname.

const TABS = [
  { href: '/estoque', label: 'Posição' },
  { href: '/estoque/reposicao', label: 'Reposição' },
] as const

export function EstoqueTabs() {
  const pathname = usePathname()

  return (
    <div className="mb-5 inline-flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
      {TABS.map((tab) => {
        const ativo = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={ativo ? 'page' : undefined}
            className={cn(
              'u-motion u-press-sm rounded-md px-3.5 py-1.5 text-sm font-medium',
              ativo
                ? 'bg-brand text-white shadow-sm shadow-black/20'
                : 'text-text-muted hover:bg-surface-2 hover:text-text',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Renderizar em `/estoque/page.tsx`**

Adicionar o import junto aos demais componentes de ui-kit (`app/(app)/estoque/page.tsx` topo do arquivo):

```tsx
import { EstoqueTabs } from '@/components/estoque/EstoqueTabs'
```

Renderizar logo abaixo do `<PageHeader>` (antes do bloco `{/* Filtros como segmented control */}`), em `app/(app)/estoque/page.tsx:254-256`:

```tsx
      </PageHeader>

      <EstoqueTabs />

      {/* Filtros como segmented control */}
```

- [ ] **Step 3: Renderizar em `/estoque/reposicao/page.tsx`**

Adicionar o mesmo import e renderizar logo abaixo do `<PageHeader>` em `app/(app)/estoque/reposicao/page.tsx:40-53`:

```tsx
      <PageHeader
        titulo="Reposição"
        subtitulo="Produtos acabando, com sugestão de quanto comprar."
      >
        <Link
          href="/estoque"
          className="u-motion u-press inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text hover:border-brand/50 hover:text-brand"
        >
          <ArrowLeft className="size-4" strokeWidth={1.5} />
          Voltar ao estoque
        </Link>
      </PageHeader>

      <EstoqueTabs />
```

Como o botão "Voltar ao estoque" fica redundante com a aba "Posição" da nova `EstoqueTabs`, remover esse `<Link>` e o import não usado de `ArrowLeft` (mantém só `ShoppingBasket`).

- [ ] **Step 4: Verificação manual**

Rodar `npm run dev`, abrir `/estoque` e `/estoque/reposicao`: confirmar que a barra de abas aparece em ambas, com a aba correta marcada como ativa, e que navegar entre elas funciona.

- [ ] **Step 5: Commit**

```bash
git add components/estoque/EstoqueTabs.tsx "app/(app)/estoque/page.tsx" "app/(app)/estoque/reposicao/page.tsx"
git commit -m "feat: adiciona abas Posição/Reposição em Estoque"
```

---

### Task 2: Reorganização da sidebar (Cadastros novo, Movimentações e Estoque como itens diretos)

**Files:**
- Modify: `components/shell/nav-items.tsx`
- Modify: `lib/nav-catalogo.ts`

**Interfaces:**
- Consumes: nenhuma dependência de Task 1.
- Produces: `NAV: Bloco[]` com a nova estrutura (consumido por `NavConteudo`, já existente, sem mudança de assinatura).

- [ ] **Step 1: Reescrever os blocos de navegação em `nav-items.tsx`**

Substituir em `components/shell/nav-items.tsx:34-74`:

```tsx
const ITEM_DASHBOARD: Item = { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }
const ITEM_FINANCEIRO: Item = { href: '/financeiro/resultado', label: 'Financeiro', icon: DollarSign }
const ITEM_MOVIMENTACOES: Item = { href: '/movimentacoes', label: 'Movimentações', icon: ArrowRightLeft }
const ITEM_ESTOQUE: Item = { href: '/estoque', label: 'Estoque', icon: Boxes }

const GRUPO_CADASTROS: Grupo = {
  titulo: 'Cadastros',
  icone: ShoppingCart,
  itens: [
    { href: '/clientes', label: 'Clientes', icon: Users },
    { href: '/fornecedores', label: 'Fornecedores', icon: Truck },
    { href: '/produtos', label: 'Produtos', icon: Package },
  ],
}

const GRUPO_RELATORIOS: Grupo = {
  titulo: 'Relatórios',
  icone: BarChart3,
  itens: [
    { href: '/relatorios', label: 'Vendas por período', icon: BarChart3 },
    { href: '/relatorios/produto', label: 'Por produto', icon: Package },
    { href: '/relatorios/cliente', label: 'Por cliente', icon: Users },
  ],
}

// Ordem da sidebar (itens soltos e grupos intercalados).
export const NAV: Bloco[] = [
  { tipo: 'item', item: ITEM_DASHBOARD },
  { tipo: 'item', item: ITEM_MOVIMENTACOES },
  { tipo: 'grupo', grupo: GRUPO_CADASTROS },
  { tipo: 'item', item: ITEM_ESTOQUE },
  { tipo: 'item', item: ITEM_FINANCEIRO },
  { tipo: 'grupo', grupo: GRUPO_RELATORIOS },
]
```

Isso remove `GRUPO_VENDAS` e `GRUPO_ESTOQUE` (deixam de existir como grupos) e mantém `ITEM_FINANCEIRO` como já era.

- [ ] **Step 2: Ajustar `rotaAtiva` para o item Estoque**

Em `components/shell/nav-items.tsx:113-122`, `/estoque` era um item dentro de um grupo com match exato (para não acender junto com `/estoque/reposicao`, que era outro item irmão). Agora `Estoque` é um item solto que representa Posição + Reposição + Perdas — precisa acender em qualquer sub-rota, igual ao Financeiro:

```tsx
export function rotaAtiva(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  if (href === '/estoque') return pathname.startsWith('/estoque')
  if (href === '/relatorios') return pathname === '/relatorios'
  // Item Financeiro fica ativo em qualquer sub-rota /financeiro (as abas trocam a tela).
  if (href === '/financeiro/resultado') return pathname.startsWith('/financeiro')
  if (href === '/movimentacoes')
    return pathname === '/movimentacoes' || /^\/movimentacoes\/(?!nova)/.test(pathname)
  return pathname === href || pathname.startsWith(href + '/')
}
```

(única mudança real: a linha do `/estoque`, de `pathname === '/estoque'` para `pathname.startsWith('/estoque')`)

- [ ] **Step 3: Atualizar os `grupo` do `NAV_CATALOGO` em `lib/nav-catalogo.ts`**

Substituir em `lib/nav-catalogo.ts:16-29`:

```tsx
export const NAV_CATALOGO: NavCatalogoItem[] = [
  { href: '/dashboard', label: 'Dashboard', grupo: 'Geral' },
  { href: '/movimentacoes/nova', label: 'Nova Movimentação', grupo: 'Geral' },
  { href: '/movimentacoes', label: 'Movimentações', grupo: 'Vendas' },
  { href: '/clientes', label: 'Clientes', grupo: 'Cadastros' },
  { href: '/estoque', label: 'Posição de estoque', grupo: 'Estoque' },
  { href: '/estoque/reposicao', label: 'Reposição', grupo: 'Estoque' },
  { href: '/produtos', label: 'Produtos', grupo: 'Cadastros' },
  { href: '/fornecedores', label: 'Fornecedores', grupo: 'Cadastros' },
  { href: '/financeiro/resultado', label: 'Financeiro (resultado, contas, formas)', grupo: 'Financeiro' },
  { href: '/relatorios', label: 'Vendas por período', grupo: 'Relatórios' },
  { href: '/relatorios/produto', label: 'Vendas por produto', grupo: 'Relatórios' },
  { href: '/relatorios/cliente', label: 'Vendas por cliente', grupo: 'Relatórios' },
]
```

Só os `grupo` de `/clientes`, `/produtos`, `/fornecedores` mudam (de `'Vendas'`/`'Estoque'` para `'Cadastros'`). Os hrefs não mudam — nenhuma migração de permissões de cargo é necessária. `rotaPermitida` em `lib/nav-catalogo.ts:34-54` não precisa de nenhuma mudança (já trata `/financeiro/relatorios` como parte de `/relatorios`, e os demais hrefs continuam batendo exatamente como antes).

- [ ] **Step 4: Verificação manual**

Rodar `npm run dev`. Confirmar visualmente:
- Sidebar mostra: Dashboard, Movimentações (item direto), Cadastros (grupo com Clientes/Fornecedores/Produtos), Estoque (item direto), Financeiro (item direto), Relatórios (grupo).
- Clicar em Estoque ativa o item tanto em `/estoque` quanto em `/estoque/reposicao` e `/estoque/perdas`.
- Ir em Configurações → Cargos, abrir um cargo existente e confirmar que os checkboxes de `Clientes`/`Fornecedores`/`Produtos` aparecem agrupados sob "Cadastros" e continuam marcáveis.
- Criar/editar um cargo com `itens_visiveis` restrito a só `/movimentacoes` e confirmar (via login de um usuário nesse cargo, ou inspecionando `itemVisivel`) que só Movimentações aparece na sidebar.

- [ ] **Step 5: Commit**

```bash
git add components/shell/nav-items.tsx lib/nav-catalogo.ts
git commit -m "refactor: reorganiza sidebar em Cadastros + itens diretos (Movimentações, Estoque)"
```

---

### Task 3: Remover aba duplicada "Faturamento & ABC" do Financeiro

**Files:**
- Modify: `components/financeiro/FinanceiroTabs.tsx`

**Interfaces:**
- Consumes: nenhuma dependência das tasks anteriores.
- Produces: nenhuma (componente folha, sem consumidores além das páginas `/financeiro/*` que já o importam).

- [ ] **Step 1: Remover a entrada da aba**

Em `components/financeiro/FinanceiroTabs.tsx:12-19`, remover a linha do `/financeiro/relatorios`:

```tsx
const TABS = [
  { href: '/financeiro/resultado', label: 'Resultado' },
  { href: '/financeiro/a-pagar', label: 'A pagar' },
  { href: '/financeiro/a-receber', label: 'A receber' },
  { href: '/financeiro/custos-fixos', label: 'Custos Fixos' },
  { href: '/financeiro/formas-pagamento', label: 'Formas de pagamento' },
] as const
```

`RelatoriosTabs` (`components/relatorios/RelatoriosTabs.tsx`) não muda — continua com as 4 abas, incluindo "Faturamento & ABC" apontando para `/financeiro/relatorios`. A página `/financeiro/relatorios` (`app/(app)/financeiro/relatorios/page.tsx`) também não muda de lugar/URL.

- [ ] **Step 2: Verificação manual**

Rodar `npm run dev`. Abrir `/financeiro/resultado`: confirmar que a barra de abas mostra só 5 abas (sem "Faturamento & ABC"). Abrir `/relatorios`: confirmar que a barra de abas mostra as 4 abas normalmente, e que clicar em "Faturamento & ABC" abre `/financeiro/relatorios` corretamente (sem ficar preso lá, já que agora não há mais aba enganosa de volta no Financeiro).

- [ ] **Step 3: Commit**

```bash
git add components/financeiro/FinanceiroTabs.tsx
git commit -m "fix: remove aba duplicada Faturamento & ABC do Financeiro (fica só em Relatórios)"
```

---

### Task 4: Filtros de Categoria + Status de estoque em Produtos

**Files:**
- Modify: `app/(app)/produtos/page.tsx`

**Interfaces:**
- Consumes: `buscarPosicaoProdutos()` (já existente, retorna `Database['public']['Views']['v_posicao_estoque']['Row'][]`, com campos `categoria: string` e `status_estoque: string`). `Tabs`/`TabsList`/`TabsTrigger` de `@/components/ui/tabs` (mesma API usada em `app/(app)/estoque/page.tsx`: `<Tabs value={string} onValueChange={(v: string | null) => void}><TabsList><TabsTrigger value="...">label</TabsTrigger></TabsList></Tabs>`).
- Produces: nenhuma (página folha).

- [ ] **Step 1: Adicionar os imports e tipos de filtro**

Em `app/(app)/produtos/page.tsx`, adicionar ao bloco de imports (linha 7, junto ao `PageHeader`):

```tsx
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
```

Adicionar logo após a linha `type Produto = ...` (linha 25):

```tsx
type FiltroStatus = 'todos' | 'ok' | 'alerta' | 'critico' | 'ruptura'

const STATUS_OPCOES: Array<{ valor: FiltroStatus; label: string }> = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'ok', label: 'OK' },
  { valor: 'alerta', label: 'Alerta' },
  { valor: 'critico', label: 'Crítico' },
  { valor: 'ruptura', label: 'Ruptura' },
]
```

- [ ] **Step 2: Adicionar estado de filtro e derivar categorias**

Substituir o estado do componente (linhas 29-31):

```tsx
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('todas')
  const [status, setStatus] = useState<FiltroStatus>('todos')
```

Adicionar logo depois do `useEffect` de carregamento (após a linha 41, antes do `useMemo` de `filtrados`):

```tsx
  const categorias = useMemo(() => {
    const unicas = new Set(produtos.map((p) => p.categoria).filter(Boolean) as string[])
    return Array.from(unicas).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [produtos])
```

- [ ] **Step 3: Combinar busca + categoria + status no `filtrados`**

Substituir o `useMemo` de `filtrados` (linhas 43-53):

```tsx
  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return produtos.filter((p) => {
      if (t) {
        const bateBusca =
          p.nome.toLowerCase().includes(t) ||
          (p.marca ?? '').toLowerCase().includes(t) ||
          (p.categoria ?? '').toLowerCase().includes(t) ||
          (p.codigo_barras ?? '').toLowerCase().includes(t)
        if (!bateBusca) return false
      }
      if (categoria !== 'todas' && p.categoria !== categoria) return false
      if (status !== 'todos' && p.status_estoque !== status) return false
      return true
    })
  }, [produtos, busca, categoria, status])
```

- [ ] **Step 4: Renderizar os dois segmented controls**

Substituir o bloco de busca (linhas 67-85) por busca + filtros:

```tsx
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
            strokeWidth={1.5}
          />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, marca, categoria ou código"
            className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/30"
          />
        </div>

        <Tabs value={categoria} onValueChange={(v) => setCategoria(v ?? 'todas')}>
          <TabsList>
            <TabsTrigger value="todas">Todas categorias</TabsTrigger>
            {categorias.map((c) => (
              <TabsTrigger key={c} value={c}>
                {c}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Tabs value={status} onValueChange={(v) => setStatus((v ?? 'todos') as FiltroStatus)}>
          <TabsList>
            {STATUS_OPCOES.map((s) => (
              <TabsTrigger key={s.valor} value={s.valor}>
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {!loading && (
          <span className="shrink-0 font-mono text-xs tabular-nums text-text-muted">
            {filtrados.length} {filtrados.length === 1 ? 'item' : 'itens'}
          </span>
        )}
      </div>
```

- [ ] **Step 5: Ajustar o estado vazio para diferenciar "sem resultado por filtro" de "sem cadastro"**

O bloco atual (linhas 89-108) só verifica `busca` para decidir a mensagem. Trocar a condição para também cobrir os novos filtros — substituir `busca ? (` por uma variável `algumFiltroAtivo`:

```tsx
      {loading ? (
        <SkeletonLinhas colunas={6} linhas={8} />
      ) : filtrados.length === 0 ? (
        busca || categoria !== 'todas' || status !== 'todos' ? (
          <EstadoVazio
            icone={Search}
            titulo="Nenhum produto encontrado"
            descricao="Nada corresponde à busca ou aos filtros selecionados. Tente ajustar."
          />
        ) : (
          <EstadoVazio
            icone={Package}
            titulo="Nenhum produto cadastrado"
            descricao="Cadastre o primeiro para começar a vender."
            acao={
              <Link href="/produtos/novo" className={btnClass('primary')}>
                <Plus className="size-4" strokeWidth={1.5} />
                Novo produto
              </Link>
            }
          />
        )
      ) : (
```

- [ ] **Step 6: Verificação manual**

Rodar `npm run dev`, abrir `/produtos`:
- Selecionar uma categoria específica: só produtos dela aparecem.
- Selecionar "Crítico": só produtos com `status_estoque === 'critico'` aparecem.
- Combinar os dois (ex.: categoria X + Crítico): interseção correta.
- Combinar com busca por texto: os três filtros juntos.
- Voltar tudo para "Todas categorias" + "Todos": lista completa volta.

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/produtos/page.tsx"
git commit -m "feat: adiciona filtros de categoria e status de estoque em Produtos"
```

---

## Testes finais (após as 4 tasks)

- [ ] `npx tsc --noEmit` sem erros novos.
- [ ] `npx eslint . --quiet` sem erros novos.
- [ ] `npx next build` completa sem erros.
- [ ] Navegação completa pelo menu novo (todos os itens carregam a rota certa).
- [ ] Cargo com `itens_visiveis` restrito continua escondendo itens corretamente.
- [ ] `/estoque` e `/estoque/reposicao` mostram a mesma barra de abas, marcando a aba ativa certa.
- [ ] `/financeiro/resultado` sem "Faturamento & ABC"; `/relatorios` com a aba normalmente.
- [ ] Filtros de Produtos (categoria + status) combinados retornam a interseção correta.
- [ ] `git push` ao final (conforme preferência já registrada do usuário: sempre subir após mudanças).
