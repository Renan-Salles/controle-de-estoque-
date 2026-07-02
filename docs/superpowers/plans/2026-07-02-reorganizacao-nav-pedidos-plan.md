# Reorganização de navegação + tela de Pedidos Implementation Plan

> **Nota:** este projeto não tem suite de testes automatizada (ver
> `CLAUDE.md`). Verificação em cada passo é `npx tsc --noEmit`,
> `npx eslint . --quiet` e teste manual no browser — não TDD.

**Goal:** Sidebar em 3 grupos (Operação/Cadastro/Relatórios) que
expandem no lugar, Financeiro absorvido dentro de Relatórios, tela nova
de Pedidos (Em andamento/Concluídos) com controle de tempo de entrega,
sem duplicar/confundir navegação.

**Architecture:** `nav-items.tsx` ganha uma estrutura de grupos nova
(3 em vez de 2, com sub-rótulos dentro de Relatórios). As 9 páginas que
hoje moram sob `/financeiro/*` continuam nas mesmas URLs (só saem do
grupo próprio "Financeiro" e entram no catálogo de `Relatórios`) —
evita ter que mover arquivos e quebrar links. `/pedidos` é uma página
nova com abas; `/movimentacoes` perde os filtros de
fulfillment (viram exclusividade de `/pedidos`). Migration adiciona
uma coluna; uma server action e um botão novo cobrem o tempo de
entrega.

**Tech Stack:** Next.js 16 App Router (Server Components), Supabase,
TypeScript, Tailwind.

Spec completa: `docs/superpowers/specs/2026-07-02-reorganizacao-nav-pedidos-design.md`

---

### Task 1: Migration `saiu_entrega_em`

**Files:**
- Create: `supabase/migrations/2026-07-02-pedidos-saiu-entrega.sql`

**Passo 1:** Conteúdo da migration:

```sql
-- Tempo de entrega: quando o entregador saiu (novo) ate quando
-- confirmou a entrega (concluido_em, ja existe). So faz sentido pra
-- tipo_fulfillment='entrega' -- retirada nao tem trajeto.
alter table public.pedidos
  add column if not exists saiu_entrega_em timestamptz;
```

**Passo 2:** Aplicar:
```bash
node -e "require('dotenv').config({path:'.env.local'}); const {Pool}=require('pg'); const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); pool.query(require('fs').readFileSync('./supabase/migrations/2026-07-02-pedidos-saiu-entrega.sql','utf8')).then(()=>{console.log('ok');pool.end()}).catch(e=>{console.error(e.message);pool.end()})"
```
Expected: `ok`

**Passo 3:** Commit:
```bash
git add supabase/migrations/2026-07-02-pedidos-saiu-entrega.sql
git commit -m "feat: coluna saiu_entrega_em em pedidos"
```

---

### Task 2: Server actions — marcar saída + listar Pedidos

**Files:**
- Modify: `lib/actions/pedidos.ts`

**Passo 1:** Adicionar perto de `marcarPagoPedido`/`marcarConcluidoPedido`:

```ts
// Marca que o entregador saiu para a entrega (so tipo_fulfillment
// 'entrega' -- retirada nao tem trajeto). Junto com concluido_em da
// pra calcular quanto tempo a entrega levou.
export async function marcarSaiuEntregaPedido(pedidoId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nao autenticado' }

  const serviceClient = await createServiceClient()
  const { error, count } = await (serviceClient.from('pedidos') as any)
    .update({ saiu_entrega_em: new Date().toISOString() }, { count: 'exact' })
    .eq('id', pedidoId)
    .eq('tipo_fulfillment', 'entrega')
  if (error) return { error: error.message }
  if (count === 0) return { error: 'Pedido nao encontrado ou nao e uma entrega.' }

  revalidatePath(`/pedidos/${pedidoId}`)
  revalidatePath('/pedidos')
  return { success: true as const }
}

// Aba "Em andamento" de /pedidos: mesmo criterio que ja usava
// contarPedidosPendentes(), agora retornando as linhas tambem.
export async function listarPedidosEmAndamento() {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, numero_pedido, tipo_fulfillment, data_pedido, saiu_entrega_em, clientes(nome), entregador:profiles!pedidos_entregador_id_fkey(nome)')
    .eq('local_id', localId)
    .eq('status', 'concluida')
    .in('tipo_fulfillment', ['entrega', 'retirada'])
    .is('concluido_em', null)
    .order('data_pedido', { ascending: false })
  if (error) throw error
  return data ?? []
}

// Aba "Concluidos" de /pedidos: historico operacional (quem entregou,
// quanto tempo levou) -- sem valor/pagamento, isso e papel do extrato
// em Movimentacoes.
export async function listarPedidosConcluidos() {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, numero_pedido, tipo_fulfillment, data_pedido, concluido_em, saiu_entrega_em, clientes(nome), entregador:profiles!pedidos_entregador_id_fkey(nome)')
    .eq('local_id', localId)
    .eq('status', 'concluida')
    .not('concluido_em', 'is', null)
    .order('concluido_em', { ascending: false })
    .limit(200)
  if (error) throw error
  return data ?? []
}
```

**Passo 2:** `npx tsc --noEmit` — esperado: sem erro.

**Passo 3:** Commit:
```bash
git add lib/actions/pedidos.ts
git commit -m "feat: acoes de saiu-para-entrega e listagem de Pedidos"
```

---

### Task 3: Botão "Marcar que saiu para entrega"

**Files:**
- Modify: `components/movimentacao/FulfillmentAcoes.tsx`

**Passo 1:** Import `marcarSaiuEntregaPedido` junto dos outros dois.
Adicionar prop `saiuEntregaEm: string | null` na assinatura do
componente. Adicionar `useTransition` própria
(`pendenteSaiu`/`startSaiu`) e uma função `confirmarSaiu()` no mesmo
padrão de `confirmarPago`/`confirmarConcluido`. Botão só renderiza
quando `tipoFulfillment === 'entrega' && !saiuEntregaEm && !concluidoEm`
(antes dos outros dois, ou junto — mesma `<div className="flex ...">`).

**Passo 2:** No caller (tela de detalhe do pedido,
`app/(app)/pedidos/[id]/page.tsx` — confirmar caminho exato antes de
editar), passar a nova prop `saiuEntregaEm={pedido.saiu_entrega_em}` e
incluir `saiu_entrega_em` no `select` da query que busca o pedido.

**Passo 3:** `npx tsc --noEmit` e `npx eslint . --quiet` — sem erro.

**Passo 4:** Testar local: criar venda tipo entrega, abrir o pedido,
clicar "Marcar que saiu para entrega", ver o botão sumir e (se já
tiver UI pra mostrar) o horário aparecer. Confirmar entrega depois,
funciona igual antes.

**Passo 5:** Commit:
```bash
git add components/movimentacao/FulfillmentAcoes.tsx "app/(app)/pedidos/[id]/page.tsx"
git commit -m "feat: botao Marcar que saiu para entrega"
```

---

### Task 4: Página `/pedidos` (Em andamento | Concluídos)

**Files:**
- Create: `app/(app)/pedidos/page.tsx` (hoje é um redirect stub —
  vira a página de verdade)
- Create: `components/pedido/PedidosTabs.tsx` (se necessário, ou
  segmented control simples inline)

**Passo 1:** Estrutura da página (Server Component): lê
`searchParams.aba` (`'andamento' | 'concluidos'`, default
`'andamento'`), chama `listarPedidosEmAndamento()` ou
`listarPedidosConcluidos()` conforme a aba, renderiza:
- Segmented control "Em andamento" / "Concluídos" no topo (`Link` com
  `?aba=`, mesmo padrão visual dos filtros de `/movimentacoes`)
- Tabela reaproveitando `components/ui-kit/tabela` (`Tabela`,
  `TabelaHead` etc, igual o resto do sistema)
- Colunas em Andamento: nº, tipo (badge `rotuloFulfillment`), local,
  cliente, saiu às (`formatarData` + hora, ou "—"), link pro detalhe
- Colunas em Concluídos: nº, tipo, local, cliente, entregador, saiu
  às, confirmado às, **duração** (calculada em JS: se `saiu_entrega_em`
  e `concluido_em` existem, `Math.round((concluido - saiu) / 60000)`
  minutos, formatado tipo "23 min" ou "1h 12min"; senão "—")
- `EstadoVazio` quando a lista vier vazia (mensagens diferentes por
  aba, mesmo padrão de `/movimentacoes`)

**Passo 2:** `npx tsc --noEmit` e `npx eslint . --quiet` — sem erro.

**Passo 3:** Testar local: criar venda entrega, ver aparecer em "Em
andamento"; marcar saiu + confirmar; ver aparecer em "Concluídos" com
duração calculada certa.

**Passo 4:** Commit:
```bash
git add "app/(app)/pedidos/page.tsx" components/pedido/
git commit -m "feat: pagina de Pedidos com Em andamento e Concluidos"
```

---

### Task 5: Simplificar `/movimentacoes` (tira os filtros de fulfillment)

**Files:**
- Modify: `app/(app)/movimentacoes/page.tsx`

**Passo 1:** Remover do array `FILTROS` e do tipo `FiltroChave` e de
`CHAVES_VALIDAS`: `'pendentes'`, `'aguardando-entrega'`,
`'aguardando-retirada'` (essas telas agora vivem em `/pedidos`).
Remover os `else if` correspondentes no cálculo de `linhas` e as
mensagens de `EstadoVazio` desses casos. Fica só `Todas / Vendas /
Entradas`.

**Passo 2:** `npx tsc --noEmit` — sem erro.

**Passo 3:** Commit:
```bash
git add "app/(app)/movimentacoes/page.tsx"
git commit -m "refactor: movimentacoes perde filtros de fulfillment (mudaram pra /pedidos)"
```

---

### Task 6: Sidebar — 3 grupos novos

**Files:**
- Modify: `components/shell/nav-items.tsx`

**Passo 1:** Trocar `GRUPO_CADASTROS`/`ITEM_ESTOQUE`/`ITEM_MOVIMENTACOES`
soltos e `GRUPO_RELATORIOS` pela nova estrutura:

```ts
const ITEM_PEDIDOS: Item = { href: '/pedidos', label: 'Pedidos', icon: PackageCheck }
const ITEM_MOVIMENTACOES: Item = { href: '/movimentacoes', label: 'Movimentações', icon: ArrowRightLeft }
const ITEM_ESTOQUE: Item = { href: '/estoque', label: 'Estoque', icon: Boxes }

const GRUPO_OPERACAO: Grupo = {
  titulo: 'Operação',
  icone: ArrowRightLeft, // conferir icone livre, nao repetir Boxes/ShoppingCart ja usados
  itens: [ITEM_PEDIDOS, ITEM_MOVIMENTACOES, ITEM_ESTOQUE],
}

const GRUPO_CADASTRO: Grupo = {
  titulo: 'Cadastro',
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
    { href: '/relatorios', label: 'Por período', icon: BarChart3 },
    { href: '/relatorios/produto', label: 'Por produto', icon: Package },
    { href: '/relatorios/cliente', label: 'Por cliente', icon: Users },
    { href: '/financeiro/relatorios', label: 'Faturamento & ABC', icon: TrendingUp },
    { href: '/financeiro/resultado', label: 'Resultado', icon: DollarSign },
    { href: '/financeiro/a-pagar', label: 'A pagar', icon: CreditCard },
    { href: '/financeiro/a-receber', label: 'A receber', icon: HandCoins },
    { href: '/financeiro/custos-fixos', label: 'Custos Fixos', icon: Receipt },
    { href: '/financeiro/formas-pagamento', label: 'Formas de pagamento', icon: CalendarRange },
  ],
}

export const NAV: Bloco[] = [
  { tipo: 'item', item: ITEM_DASHBOARD },
  { tipo: 'grupo', grupo: GRUPO_OPERACAO },
  { tipo: 'grupo', grupo: GRUPO_CADASTRO },
  { tipo: 'grupo', grupo: GRUPO_RELATORIOS },
]
```

Conferir imports de ícone (`TrendingUp`, `CreditCard`, `HandCoins`
já existem no projeto — checar `app/(app)/dashboard/page.tsx` e
`app/(app)/financeiro/relatorios/page.tsx` antes de importar de novo,
evitar duplicar declaração).

**Passo 2:** Sub-rótulo visual dentro do grupo Relatórios (separador
"VENDAS"/"FINANCEIRO"): como `GrupoColapsavel` hoje só itera
`grupo.itens` numa lista plana, adicionar um índice de corte (ex.
`grupo.tituloSecao?: string` num novo campo por item, ou renderizar um
`<p>` de separador manualmente comparando se é o primeiro item cujo
`href` começa com `/financeiro`). Solução mais simples: em
`GrupoColapsavel`, ao mapear `grupo.itens`, inserir um rótulo
`<p className="...uppercase text-[10px] text-text-muted...">FINANCEIRO</p>`
imediatamente antes do item cujo `href === '/financeiro/relatorios'`
(primeiro item financeiro da lista) — sem precisar mudar o tipo `Item`.

**Passo 3:** Remover o item especial `ITEM_PEDIDOS_PENDENTES` e toda a
lógica de `pendentesAtivo`/`useSearchParams`/renderização condicional
extra em `NavConteudo` que foi adicionada pra ele — o novo `ITEM_PEDIDOS`
(`/pedidos`, sem query string) já resolve via `rotaAtiva()` normal, não
precisa mais do tratamento especial. Remover também o `selo`/badge de
contagem de pendentes da sidebar (ou adaptar pra contar
`listarPedidosEmAndamento()` e mostrar no item `Pedidos` — decisão:
manter o selo, agora no item `Pedidos` normal, reaproveitando
`contarPedidosPendentes()` que já existe em `lib/actions/pedidos.ts`).

**Passo 4:** `npx tsc --noEmit` e `npx eslint . --quiet` — sem erro.

**Passo 5:** Commit:
```bash
git add components/shell/nav-items.tsx
git commit -m "feat: sidebar reorganizada em Operacao/Cadastro/Relatorios"
```

---

### Task 7: Catálogo de permissões + remoção das abas internas redundantes

**Files:**
- Modify: `lib/nav-catalogo.ts`
- Modify: as 5 páginas em `app/(app)/financeiro/*` e as 4 em
  `app/(app)/relatorios/*` (remover `<FinanceiroTabs />`/`<RelatoriosTabs />`)
- Delete (se não usados em mais nenhum lugar após a remoção):
  `components/financeiro/FinanceiroTabs.tsx`,
  `components/relatorios/RelatoriosTabs.tsx`

**Passo 1:** Em `NAV_CATALOGO`, adicionar `{ href: '/pedidos', label:
'Pedidos', grupo: 'Operação' }`. Ajustar o `grupo` dos itens que já
existem (`Movimentações`, `Estoque`, `Posição de estoque`,
`Reposição`) pra `'Operação'`, os de cadastro pra `'Cadastro'`, e os 4
relatórios + as 5 entradas de financeiro (que já existem no catálogo,
conferir nomes exatos) pra `'Relatórios'`. É só o campo `grupo`
(usado pra desenhar a tela de configuração de Cargos) — não muda
`href` de nada.

**Passo 2:** Em cada uma das 9 páginas (5 financeiro + 4 relatórios),
remover a linha `<FinanceiroTabs />` ou `<RelatoriosTabs />` (a
navegação agora é só pela sidebar). Conferir que cada página ainda tem
um `<PageHeader>` ou título próprio depois de tirar a barra de abas.

**Passo 3:** Se depois de tirar os dois usos, `FinanceiroTabs.tsx` e
`RelatoriosTabs.tsx` não forem mais importados em lugar nenhum
(`grep -rn "FinanceiroTabs\|RelatoriosTabs" app/ components/`), apagar
os dois arquivos.

**Passo 4:** `npx tsc --noEmit` e `npx eslint . --quiet` — sem erro.

**Passo 5:** Commit:
```bash
git add lib/nav-catalogo.ts "app/(app)/financeiro" "app/(app)/relatorios" components/financeiro components/relatorios
git commit -m "refactor: financeiro entra no catalogo de Relatorios, tira abas internas redundantes"
```

---

### Task 8: Verificação final e deploy

**Passo 1:** `npx tsc --noEmit`, `npx eslint . --quiet`, `npx next build`
— todos sem erro.

**Passo 2:** Teste manual local completo: abrir cada um dos 3 grupos
na sidebar, clicar em cada sub-item, conferir que abre a tela certa
sem pular de contexto pra outro lugar inesperado. Fluxo de entrega
ponta a ponta (criar venda entrega → aparece em Pedidos/Em andamento →
marcar saiu → marcar confirmado → aparece em Pedidos/Concluídos com
duração certa). Conferir que Movimentações continua mostrando
entrada+saída sem filtro de fulfillment.

**Passo 3:** `git push`.

**Passo 4:** Aguardar deploy Vercel (`gh api
repos/Renan-Salles/controle-de-estoque-/commits/<sha>/status`), repetir
o roteiro de teste manual direto em `https://depsys.vercel.app`.
