# Pedidos pendentes + CPF opcional Implementation Plan

> **Nota:** este projeto não tem suite de testes automatizada (ver
> `CLAUDE.md`). Verificação em cada passo é `npx tsc --noEmit`,
> `npx eslint . --quiet` e teste manual no browser — não TDD com testes
> unitários.

**Goal:** Deixar claro que CPF/CNPJ é opcional no cadastro de cliente, e
dar visibilidade real a pedidos de entrega/retirada ainda não
confirmados (botão de destaque na sidebar + card no Dashboard).

**Architecture:** Uma função server-side conta pedidos pendentes
(reaproveita o critério que já existe nos filtros de `/movimentacoes`);
o layout busca essa contagem a cada navegação e repassa como prop pra
Sidebar/MobileNav (selo) e o Dashboard busca a mesma contagem pro card.
Nenhuma tabela nova, nenhuma dependência nova.

**Tech Stack:** Next.js 16 App Router (Server Components), Supabase,
TypeScript, Tailwind.

Spec completa: `docs/superpowers/specs/2026-07-02-pedidos-pendentes-design.md`

---

### Task 1: CPF/CNPJ — rótulo opcional

**Files:**
- Modify: `app/(app)/clientes/ClienteForm.tsx`

**Passo 1:** Trocar `<Campo label="CPF / CNPJ">` por
`<Campo label="CPF / CNPJ (opcional)">` (linha ~149).

**Passo 2:** `npx tsc --noEmit` — esperado: sem erro.

**Passo 3:** Commit:
```bash
git add "app/(app)/clientes/ClienteForm.tsx"
git commit -m "feat: rotulo deixa claro que CPF/CNPJ e opcional"
```

---

### Task 2: `contarPedidosPendentes()`

**Files:**
- Modify: `lib/actions/pedidos.ts`

**Passo 1:** Adicionar, perto de `listarVendas()`:

```ts
// Pedidos de entrega/retirada ainda nao confirmados como
// entregues/retirados, do local ativo. Mesmo criterio dos filtros
// "Aguardando entrega/retirada" em /movimentacoes, somado.
export async function contarPedidosPendentes(): Promise<number> {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('pedidos')
    .select('id', { count: 'exact', head: true })
    .eq('local_id', localId)
    .eq('status', 'concluida')
    .in('tipo_fulfillment', ['entrega', 'retirada'])
    .is('concluido_em', null)
  if (error) throw error
  return count ?? 0
}
```

**Passo 2:** `npx tsc --noEmit` — esperado: sem erro.

**Passo 3:** Testar direto (sanity check rápido via script, fora do
repo) contra o banco real: criar uma venda `entrega` sem confirmar,
chamar a função (via UI depois, ou conferir a query manualmente),
conferir que conta 1; confirmar a entrega, conferir que volta a 0.
Isso é validado de verdade na Task 4 (dashboard) e Task 5 (sidebar), que
consomem essa função — não precisa de script isolado aqui.

**Passo 4:** Commit:
```bash
git add lib/actions/pedidos.ts
git commit -m "feat: contarPedidosPendentes conta entrega/retirada nao confirmados"
```

---

### Task 3: Filtro `pendentes` em `/movimentacoes`

**Files:**
- Modify: `app/(app)/movimentacoes/page.tsx`

**Passo 1:** Localizar o bloco de filtros (`FiltroChave`,
`CHAVES_VALIDAS`, e o `if/else if` que monta `linhas`). Adicionar
`'pendentes'` como chave válida e o rótulo `{ chave: 'pendentes',
rotulo: 'Pedidos em andamento' }` na lista de filtros exibidos.

**Passo 2:** No `if/else if` que decide `linhas`, adicionar antes dos
filtros de entrega/retirada existentes:

```ts
else if (filtroAtivo === 'pendentes') {
  linhas = linhasVenda.filter(
    (l) => (l.tipoFulfillment === 'entrega' || l.tipoFulfillment === 'retirada') && !l.concluidoEm,
  )
}
```

**Passo 3:** No bloco de `EstadoVazio` (mensagem quando a lista filtrada
vem vazia), adicionar o caso `pendentes` com mensagem tipo "Nenhum
pedido em andamento".

**Passo 4:** `npx tsc --noEmit` e `npx eslint . --quiet` — esperado: sem
erro.

**Passo 5:** Testar local: `npm run dev`, logar, criar uma venda tipo
entrega sem confirmar, ir em `/movimentacoes?filtro=pendentes`, ver a
venda aparecer. Confirmar a entrega, recarregar, ver ela sumir da lista.

**Passo 6:** Commit:
```bash
git add "app/(app)/movimentacoes/page.tsx"
git commit -m "feat: filtro Pedidos em andamento une entrega+retirada pendentes"
```

---

### Task 4: Card no Dashboard

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`

**Passo 1:** Importar `contarPedidosPendentes` de
`@/lib/actions/pedidos`. Adicionar à `Promise.all` já existente que
busca `stats`, `dre`, `resumoFiado` etc.

**Passo 2:** Copiar o padrão visual do banner de "N produtos com estoque
crítico" já existente na página (mesmo componente/classe), trocando
texto pro pedidos pendentes e o link pra
`/movimentacoes?filtro=pendentes`. Só renderiza quando a contagem é > 0
(igual o banner de estoque crítico já faz).

**Passo 3:** `npx tsc --noEmit` — esperado: sem erro.

**Passo 4:** Testar local: com uma venda de entrega pendente criada,
abrir `/dashboard`, ver o card aparecer com a contagem certa e o link
funcionando. Confirmar a entrega, recarregar o dashboard, ver o card
sumir (contagem virou 0).

**Passo 5:** Commit:
```bash
git add "app/(app)/dashboard/page.tsx"
git commit -m "feat: card de pedidos pendentes no Dashboard"
```

---

### Task 5: Botão "Pedidos em andamento" na sidebar

**Files:**
- Modify: `components/shell/nav-items.tsx`
- Modify: `components/shell/Sidebar.tsx`
- Modify: `components/shell/MobileNav.tsx`
- Modify: `app/(app)/layout.tsx`

**Passo 1:** Em `nav-items.tsx`, adicionar
`ITEM_PEDIDOS_PENDENTES: Item = { href: '/movimentacoes?filtro=pendentes', label: 'Pedidos em andamento', icon: ClipboardList }`
(ou ícone equivalente já usado no projeto — conferir import do
`lucide-react` já presente no arquivo). Adicionar esse item no array
`NAV`, logo depois do `ITEM_DASHBOARD`.

**Passo 2:** O tipo `Item` hoje é `{ href, label, icon }`. Como só ESSE
item precisa de selo, não vale generalizar o tipo — mais simples:
`Sidebar`/`MobileNav` recebem uma prop nova `pedidosPendentes?: number`
e, ao renderizar o item cujo `href` é `/movimentacoes?filtro=pendentes`,
desenham o número ao lado do label quando `pedidosPendentes > 0`
(nenhum selo quando é 0 — não virar ruído permanente).

**Passo 3:** Em `app/(app)/layout.tsx` (onde `Sidebar`/`MobileNav` já
são renderizados com `localNome`/`itensVisiveis`/`isAdmin`), chamar
`contarPedidosPendentes()` junto das outras buscas que já rodam ali, e
passar como `pedidosPendentes={contagem}` pros dois componentes.

**Passo 4:** `npx tsc --noEmit` e `npx eslint . --quiet` — esperado: sem
erro.

**Passo 5:** Testar local: com uma venda de entrega pendente, ver o
selo aparecer na sidebar (desktop) e no menu mobile, clicar e cair em
`/movimentacoes` já com o filtro "Pedidos em andamento" ativo.
Confirmar a entrega, navegar pra outra tela, ver o selo sumir.

**Passo 6:** Commit:
```bash
git add components/shell/nav-items.tsx components/shell/Sidebar.tsx components/shell/MobileNav.tsx "app/(app)/layout.tsx"
git commit -m "feat: botao Pedidos em andamento na sidebar com selo de contagem"
```

---

### Task 6: Verificação final e deploy

**Passo 1:** `npx tsc --noEmit`, `npx eslint . --quiet`, `npx next build`
— todos sem erro.

**Passo 2:** `git push`.

**Passo 3:** Aguardar deploy Vercel (`gh api
repos/Renan-Salles/controle-de-estoque-/commits/<sha>/status`), depois
repetir o roteiro de teste manual (Tasks 3-5) direto em
`https://depsys.vercel.app`.
