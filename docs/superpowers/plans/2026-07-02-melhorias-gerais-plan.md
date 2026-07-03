# Melhorias gerais do DepSys — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corrigir 3 bugs de relatório, criar os cargos Admin/Funcionário/Entregador com tela própria do entregador, e dar ao produto múltiplas embalagens de venda (unidade + fardo + caixa, cada uma com preço próprio) refletidas no PDV.

**Architecture:** Três blocos independentes. Bloco A são correções cirúrgicas em views/actions existentes. Bloco B reaproveita `/dashboard` como ponto de entrada por-cargo (evita mexer no redirect de auth) e consolida cargos via migration defensiva. Bloco C adiciona a tabela `produto_embalagens` (estoque continua em unidade base — só a UI e o `pedido_itens` ganham a noção de embalagem), com migration que converte os produtos atuais sem perda de dado.

**Tech Stack:** Next.js 16 App Router (Server Components + Server Actions), Supabase Postgres, TypeScript, Tailwind 4, `@base-ui/react`. Sem suite de testes — verificação por `npx tsc --noEmit`, `npx eslint . --quiet`, `npx next build` e teste manual via Playwright (o projeto tem `playwright` como devDependency; login de teste `renan@deposito.com` / `Deposito2026!`, seletores `#email`/`#senha`/`text=Entrar`).

**Spec:** `docs/superpowers/specs/2026-07-02-melhorias-gerais-design.md`

**Convenções do projeto (ver `CLAUDE.md`):** português com acentos, sem travessão no copy de usuário, commits pequenos com `git push` no fim, migrations em `supabase/migrations/YYYY-MM-DD-descricao.sql` aplicadas via o one-liner `node -e` documentado. `createServiceClient()` NÃO bypassa RLS com sessão ativa — escrita privilegiada usa função Postgres `security definer`.

---

## BLOCO A — Correções de relatório

### Task A1: Faturamento & ABC no mês certo (fuso)

**Files:**
- Create: `supabase/migrations/2026-07-03-faturamento-fuso-brasilia.sql`

**Contexto:** `v_faturamento_mensal` faz `date_trunc('month', data_pedido)` sem fuso; servidor em UTC joga venda do fim do dia pro mês seguinte. Bug confirmado na varredura: venda de 02/07 apareceu como "Junho".

**Step 1: Escrever a migration**

```sql
-- date_trunc sem fuso trunca em UTC; venda das 21h-23h59 (Brasil) cai no
-- mes seguinte. Converte pra America/Sao_Paulo antes de truncar, igual
-- ja e feito em lib/formatos.ts pro resto do sistema.
create or replace view public.v_faturamento_mensal as
  select local_id,
    date_trunc('month', data_pedido at time zone 'America/Sao_Paulo') as mes,
    count(id) as total_pedidos,
    sum(total) as receita_bruta,
    sum(desconto_total) as descontos,
    sum(total - desconto_total) as receita_liquida,
    round(sum(total) / nullif(count(id), 0)::numeric, 2) as ticket_medio
  from pedidos
  where status::text <> 'cancelada'::text
  group by local_id, date_trunc('month', data_pedido at time zone 'America/Sao_Paulo')
  order by date_trunc('month', data_pedido at time zone 'America/Sao_Paulo') desc;
```

**Step 2: Aplicar**

Run:
```bash
node -e "require('dotenv').config({path:'.env.local'}); const {Pool}=require('pg'); const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); pool.query(require('fs').readFileSync('./supabase/migrations/2026-07-03-faturamento-fuso-brasilia.sql','utf8')).then(()=>{console.log('ok');pool.end()}).catch(e=>{console.error(e.message);pool.end()})"
```
Expected: `ok`

**Step 3: Verificar o mês**

Run:
```bash
node -e "require('dotenv').config({path:'.env.local'}); const {Pool}=require('pg'); const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); pool.query(\"select to_char(mes,'YYYY-MM') mes, total_pedidos from v_faturamento_mensal order by mes desc limit 3\").then(r=>{console.log(JSON.stringify(r.rows));pool.end()}).catch(e=>{console.error(e.message);pool.end()})"
```
Expected: `mes` mostra `2026-07` (não `2026-06`) pras vendas de julho.

**Step 4: Commit**

```bash
git add supabase/migrations/2026-07-03-faturamento-fuso-brasilia.sql
git commit -m "fix: v_faturamento_mensal trunca mes no fuso de Brasilia"
```

---

### Task A2: Relatórios de venda consistentes com frete

**Files:**
- Modify: `lib/actions/relatorios.ts:8-39` (função `relatorioVendasPeriodo`)
- Create: `supabase/migrations/2026-07-03-vendas-sem-frete.sql`

**Contexto:** frete infla `pedidos.total`. "Por período"/"Por cliente"/"Formas de pagamento" somam `total` (com frete); "Por produto"/Curva ABC somam `pedido_itens.total` (sem frete). Regra definida: **relatório de venda/faturamento é mercadoria, exclui frete.** Fonte da verdade = subtotal (`total - frete`). Isso alinha os 5 relatórios com "Por produto"/ABC, que já estão certos — logo só mexem as 3 telas que hoje incluem frete.

**Step 1: Corrigir `relatorioVendasPeriodo` (usa `total`, trocar por `total - frete`)**

Em `lib/actions/relatorios.ts`, no `.select(...)` da função (linha ~14) trocar `'data_pedido, total'` por `'data_pedido, total, frete'`, e no map que soma receita (linha ~22-30) usar `(l.total - (l.frete ?? 0))` no lugar de `l.total`. Ajustar o tipo inline `{ data_pedido: string; total: number }` pra incluir `frete: number`.

**Step 2: Corrigir as RPCs `vendas_por_cliente` (soma `p.total`)**

`vendas_por_cliente` soma `p.total`. Recriar excluindo frete:

```sql
create or replace function public.vendas_por_cliente(p_local uuid, p_ini date, p_fim date)
returns table(cliente_id uuid, nome text, pedidos bigint, total numeric)
language sql stable as $$
  select c.id,
         coalesce(c.nome, 'Não identificado') as nome,
         count(p.id) as pedidos,
         sum(p.total - p.frete)::numeric as total
  from pedidos p
  left join clientes c on c.id = p.cliente_id
  where p.local_id = p_local
    and p.status = 'concluida'
    and p.data_pedido >= p_ini
    and p.data_pedido < (p_fim + 1)
  group by c.id, c.nome
  order by total desc;
$$;
```

(`vendas_por_produto` já soma `pedido_itens.total`, não muda.)

**Step 3: Aplicar migration**

Run:
```bash
node -e "require('dotenv').config({path:'.env.local'}); const {Pool}=require('pg'); const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); pool.query(require('fs').readFileSync('./supabase/migrations/2026-07-03-vendas-sem-frete.sql','utf8')).then(()=>{console.log('ok');pool.end()}).catch(e=>{console.error(e.message);pool.end()})"
```
Expected: `ok`

**Step 4: Formas de pagamento** — checar `buscarFormasPagamento` em `lib/actions/financeiro.ts`. Se somar `pedidos.total`, aplicar o mesmo `- frete`. (Ler a função antes de decidir; se já usa outra fonte, deixar como está e anotar no commit.)

**Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erro.

**Step 6: Verificar reconciliação**

Com a venda #0501 (total 196,40, frete 50), "Por período" deve mostrar **146,40** (igual "Por produto"). Rodar dev server + Playwright ou SQL direto pra confirmar que os 5 relatórios batem no mesmo número.

**Step 7: Commit**

```bash
git add lib/actions/relatorios.ts supabase/migrations/2026-07-03-vendas-sem-frete.sql
git commit -m "fix: relatorios de venda excluem frete (batem com Por produto/ABC)"
```

---

### Task A3: Reposição — status não-contraditório

**Files:**
- Modify: `lib/actions/estoque.ts:141-178` (`buscarReposicao`)
- Modify: `app/(app)/estoque/reposicao/page.tsx` (ou o componente que renderiza a linha — confirmar caminho com grep)

**Contexto:** produto com saldo acima do próprio mínimo mas abaixo do piso de 12 aparece "OK" **e** sugerindo compra. O piso é proposital; só o rótulo confunde.

**Step 1:** Em `buscarReposicao`, adicionar um campo derivado por linha indicando por que entrou na lista: `abaixo_piso` (true quando entrou só pelo piso de 12, não pelo status do produto). Retornar `{ ...p, sugestao_compra, motivo: status==='ok' ? 'piso' : 'estoque' }`.

**Step 2:** Na tela de reposição, quando `motivo==='piso'` e status é `ok`, mostrar um selo neutro tipo "Abaixo do piso de segurança" em vez do "OK" verde — deixa claro por que está sugerindo comprar. Reusar `StatusPill` (vocabulário fixo — ver `components/ui-kit/StatusPill.tsx`; se nenhum status servir, usar um texto simples, não inventar status novo na pill).

**Step 3:** `npx tsc --noEmit` e `npx eslint . --quiet` — sem erro.

**Step 4:** Testar local: abrir `/estoque/reposicao`, confirmar que Whisky Old Eight (saldo 11, min 3) não mostra mais "OK" cru ao lado de "+13".

**Step 5: Commit**

```bash
git add lib/actions/estoque.ts "app/(app)/estoque/reposicao/page.tsx"
git commit -m "fix: reposicao distingue 'abaixo do piso' de status OK"
```

---

## BLOCO B — Cargos + Entregador

### Task B1: Consolidar cargos em Funcionário

**Files:**
- Create: `supabase/migrations/2026-07-03-cargo-funcionario.sql`

**Contexto:** hoje Admin/Gerente/Caixa. Vira Admin/Funcionário/Entregador. Migration defensiva: só apaga Gerente/Caixa se não tiverem profile vinculado; converte um deles em Funcionário.

**Step 1: Escrever a migration**

```sql
-- Consolida Gerente+Caixa num cargo Funcionario (Pedidos, Movimentacoes,
-- Estoque, Cadastro -- sem Relatorios/Financeiro). Defensivo: so mexe em
-- cargos sem profile vinculado (hoje so o admin Renan tem profile).
do $$
declare
  v_funcionario_itens text[] := array[
    '/dashboard', '/movimentacoes/nova', '/pedidos', '/movimentacoes',
    '/estoque', '/estoque/reposicao', '/clientes', '/produtos', '/fornecedores'
  ];
  v_tem_profile boolean;
begin
  -- Se Gerente/Caixa tiverem profile vinculado, aborta (nao apaga acesso de ninguem).
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
    on conflict do nothing;
  end if;

  -- Cargo Entregador: sem itens na sidebar (a tela dele vive em /dashboard por cargo).
  insert into cargos (nome, admin, itens_visiveis, ativo)
  values ('Entregador', false, array[]::text[], true)
  on conflict do nothing;
end $$;
```

(Conferir o schema de `cargos` antes — se tiver `unique(nome)` o `on conflict` precisa do target; se não tiver, trocar por um `if not exists`.)

**Step 2: Aplicar**

Run: (mesmo one-liner `node -e`, apontando pro arquivo)
Expected: `ok`

**Step 3: Verificar**

Run:
```bash
node -e "require('dotenv').config({path:'.env.local'}); const {Pool}=require('pg'); const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); pool.query('select nome, admin, array_length(itens_visiveis,1) qtd from cargos order by nome').then(r=>{console.log(JSON.stringify(r.rows,null,2));pool.end()}).catch(e=>{console.error(e.message);pool.end()})"
```
Expected: Administrador, Entregador (0 itens), Funcionario (9 itens). Sem Gerente/Caixa.

**Step 4: Commit**

```bash
git add supabase/migrations/2026-07-03-cargo-funcionario.sql
git commit -m "feat: cargos consolidados em Admin/Funcionario/Entregador"
```

---

### Task B2: Helper `ehEntregador` + actions da tela de entregas

**Files:**
- Modify: `lib/actions/pedidos.ts` (adicionar `listarMinhasEntregas`)
- Modify: `lib/permissoes.ts` (adicionar `ehEntregador()` — confirmar caminho/nome do módulo de cargo)

**Step 1:** Em `lib/permissoes.ts`, adicionar helper que retorna true quando o cargo do usuário logado tem `nome === 'Entregador'`. Reusar `getCargoUsuario()` que já existe.

**Step 2:** Em `lib/actions/pedidos.ts`, adicionar:

```ts
// Entregas pendentes designadas ao usuario logado (tela do Entregador).
// So entrega (nao retirada), nao concluida, do local dele.
export async function listarMinhasEntregas() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const localId = await getLocalAtivoId()
  const { data, error } = await supabase
    .from('pedidos')
    .select(
      'id, numero_pedido, total, forma_pagamento, data_pedido, clientes(nome, telefone, endereco), local:locais(nome)',
    )
    .eq('local_id', localId)
    .eq('entregador_id', user.id)
    .eq('tipo_fulfillment', 'entrega')
    .eq('status', 'concluida')
    .is('concluido_em', null)
    .order('data_pedido', { ascending: false })
  if (error) throw error
  return data ?? []
}
```

(Conferir se `clientes.endereco` é jsonb com `{rua, numero, bairro, cidade}` — é, por `lib/actions/clientes.ts`. Conferir a FK de `locais` pro embed.)

**Step 3:** `npx tsc --noEmit` — sem erro.

**Step 4: Commit**

```bash
git add lib/actions/pedidos.ts lib/permissoes.ts
git commit -m "feat: action listarMinhasEntregas + helper ehEntregador"
```

---

### Task B3: Tela do Entregador em /dashboard por cargo

**Files:**
- Create: `components/entregador/TelaEntregador.tsx`
- Create: `components/entregador/CardEntrega.tsx`
- Modify: `app/(app)/dashboard/page.tsx` (branch por cargo no topo)
- Modify: `app/(app)/layout.tsx` (esconder sidebar/topbar quando entregador)

**Step 1:** `CardEntrega.tsx` (client component) — recebe uma entrega e renderiza: nº + cliente + `<Money>` do total + forma de pagamento; linha "De {local} → {endereço do cliente}" (se endereço vazio, "Endereço não cadastrado" em `text-warn`); botões **Ligar** (`<a href={`tel:${tel}`}>`) e **WhatsApp** (`<a href={`https://wa.me/55${telSóDígitos}`}>`) desabilitados/ocultos se sem telefone; e o `<FulfillmentAcoes>` já existente (reusar — ele já tem "saiu"/"entregue"). Layout card mobile-first, toque grande.

**Step 2:** `TelaEntregador.tsx` (server component) — cabeçalho simples (logo + nome + botão sair), chama `listarMinhasEntregas()`, mapeia em `<CardEntrega>`. Lista vazia → `<EstadoVazio>` "Nenhuma entrega pra você agora". Sem sidebar.

**Step 3:** Em `app/(app)/dashboard/page.tsx`, no topo: buscar cargo; se `ehEntregador()`, `return <TelaEntregador />` antes de qualquer query do dashboard normal.

**Step 4:** Em `app/(app)/layout.tsx`, quando o cargo é Entregador, não renderizar `<Sidebar>`/`<Topbar>` (a tela do entregador é self-contained). Guardar num `const entregador = cargo?.nome === 'Entregador'` e condicionar o shell. Cuidar pra `rotaPermitida` não redirecionar o entregador em loop — `/dashboard` já é sempre permitido (fail-safe), então ok; conferir que ele não consegue abrir `/movimentacoes` etc. (sem itens visíveis, `rotaPermitida` barra e manda pra `/dashboard`, que é a tela dele — comportamento correto).

**Step 5:** `npx tsc --noEmit` e `npx eslint . --quiet` — sem erro. `npx next build` — sem erro.

**Step 6: Testar local (Playwright):** criar um cargo/usuário Entregador de teste via SQL + uma entrega designada a ele, logar como ele, confirmar que cai direto na tela de entregas sem sidebar, que o card mostra endereço + botões, e que "marcar entregue" some o card. Limpar dados de teste depois.

**Step 7: Commit**

```bash
git add components/entregador "app/(app)/dashboard/page.tsx" "app/(app)/layout.tsx"
git commit -m "feat: tela do Entregador (entregas designadas, ligar/whatsapp, sem sidebar)"
```

---

### Task B4: Push e verificação do Bloco B em produção

**Step 1:** `git push`.
**Step 2:** Aguardar deploy Vercel (`gh api repos/Renan-Salles/controle-de-estoque-/commits/<sha>/status` ou poll na URL de produção).
**Step 3:** Re-testar em `https://depsys.vercel.app`: cargo Entregador cai na tela certa; cargos existentes (admin) seguem normais.

---

## BLOCO C — Múltiplas embalagens de venda

### Task C1: Tabela `produto_embalagens` + migration de dados

**Files:**
- Create: `supabase/migrations/2026-07-03-produto-embalagens.sql`

**Step 1: Escrever a migration**

```sql
-- Cada produto pode ser vendido em varias embalagens (unidade, fardo, caixa),
-- cada uma com seu preco. Estoque continua em unidade base -- 'unidades' diz
-- quantas unidades base uma embalagem fechada consome.
create table if not exists public.produto_embalagens (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete cascade,
  nome text not null,
  unidades numeric not null default 1 check (unidades >= 1),
  preco numeric not null default 0 check (preco >= 0),
  padrao boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_produto_embalagens_produto on public.produto_embalagens(produto_id);

alter table public.produto_embalagens enable row level security;
-- Mesma politica de leitura/escrita por local que produtos: via join no produto.
create policy "produto_embalagens acesso por local" on public.produto_embalagens
  for all using (
    exists (
      select 1 from public.produtos p
      where p.id = produto_embalagens.produto_id
        and public.pode_acessar_local(p.local_id)
    )
  );

-- Converte o catalogo atual: 1 embalagem "Unidade" (padrao) por produto +
-- se o produto tinha embalagem != 'unidade', uma segunda com o fator antigo.
insert into public.produto_embalagens (produto_id, nome, unidades, preco, padrao)
select id, 'Unidade', 1, preco_venda_padrao, true
from public.produtos;

insert into public.produto_embalagens (produto_id, nome, unidades, preco, padrao)
select id,
       initcap(embalagem) || ' ' || fator_conversao,
       fator_conversao,
       round(preco_venda_padrao * fator_conversao, 2),
       false
from public.produtos
where embalagem is not null and embalagem <> 'unidade' and coalesce(fator_conversao,1) > 1;
```

(Conferir o nome exato da função de RLS — o design menciona `pode_acessar_local(local_id)`. Se a assinatura diferir, ajustar. Ver uma policy existente de `produtos` como referência antes de escrever.)

**Step 2: Aplicar** (one-liner `node -e`) — Expected: `ok`

**Step 3: Verificar**

Run:
```bash
node -e "require('dotenv').config({path:'.env.local'}); const {Pool}=require('pg'); const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); pool.query(\"select pr.nome, pe.nome emb, pe.unidades, pe.preco, pe.padrao from produto_embalagens pe join produtos pr on pr.id=pe.produto_id order by pr.nome, pe.padrao desc limit 20\").then(r=>{console.log(JSON.stringify(r.rows,null,2));pool.end()}).catch(e=>{console.error(e.message);pool.end()})"
```
Expected: Skol → "Unidade" (1un, R$4,50, padrão) + "Fardo 12" (12un, R$54,00). Cada produto com ≥1 embalagem.

**Step 4: Regenerar tipos** (o projeto usa `types/database.types.ts`):

Run: conferir como os tipos são gerados (provável `supabase gen types` ou script). Se não houver pipeline automática, adicionar a tabela ao tipo manualmente ou confiar no `ignoreBuildErrors` já ligado. Anotar no commit qual caminho.

**Step 5: Commit**

```bash
git add supabase/migrations/2026-07-03-produto-embalagens.sql types/database.types.ts
git commit -m "feat: tabela produto_embalagens + conversao do catalogo atual"
```

---

### Task C2: Actions de embalagens

**Files:**
- Modify: `lib/actions/produtos.ts`

**Step 1:** Adicionar `listarEmbalagens(produtoId)` — SELECT ordenado por `padrao desc, unidades asc`.

**Step 2:** Adicionar `salvarEmbalagens(produtoId, embalagens[])` — recebe a lista completa da UI, faz replace transacional (delete das que sumiram + upsert). Garantir invariante: sempre existe exatamente 1 `padrao=true` e ao menos a "Unidade" (`unidades=1`). Validar com zod. Usar função Postgres `security definer` se a escrita precisar rodar fora da RLS — mas como é escrita do próprio dono logado (admin/funcionário) sobre produto do local dele, a RLS já cobre; usar `createClient()` normal.

**Step 3:** Ajustar `criarProduto` — ao criar um produto, criar automaticamente a embalagem "Unidade" padrão (via a mesma lógica; ou deixar o form mandar a lista de embalagens junto). Decisão: o form manda `embalagens[]` no payload; `criarProduto` insere o produto e depois as embalagens.

**Step 4:** `npx tsc --noEmit` — sem erro.

**Step 5: Commit**

```bash
git add lib/actions/produtos.ts
git commit -m "feat: actions listar/salvar embalagens de produto"
```

---

### Task C3: Cadastro de Produto com "Formas de venda"

**Files:**
- Modify: `app/(app)/produtos/ProdutoForm.tsx`
- Modify: `app/(app)/produtos/[id]/editar/page.tsx` (passar embalagens iniciais)

**Step 1:** No `ProdutoForm`, substituir a seção "Embalagem" (tipo + fator, hoje uma embalagem só) por seção **"Formas de venda"**: lista editável de embalagens. Primeira linha fixa "Unidade" (só preço editável). Botão "adicionar forma" cria linha com {nome, unidades, preço}. Cada linha removível (menos a Unidade). Manter o campo "Volume (ml)" separado (é da bebida, resolve o rótulo confuso 4d). Manter `estoque_minimo`/custo/margem como estão.

**Step 2:** No `salvar()`, montar `embalagens[]` do estado e mandar no payload de `criarProduto`/`atualizarProduto`; chamar `salvarEmbalagens` na edição.

**Step 3:** `editar/page.tsx` — carregar `listarEmbalagens(id)` e passar como `inicial.embalagens`.

**Step 4:** `npx tsc --noEmit` e `npx eslint . --quiet` — sem erro.

**Step 5: Testar local (Playwright):** cadastrar um produto novo com Unidade + 1 caixa, salvar, reabrir edição, conferir que as duas formas voltam certas. Editar um produto existente (ex. Skol) e conferir que as embalagens convertidas aparecem.

**Step 6: Commit**

```bash
git add "app/(app)/produtos/ProdutoForm.tsx" "app/(app)/produtos/[id]/editar/page.tsx"
git commit -m "feat: cadastro de produto com multiplas formas de venda"
```

---

### Task C4: Lista de Produtos mostra formas de venda (fix 4d)

**Files:**
- Modify: `app/(app)/produtos/page.tsx:180-240` (coluna Embalagem)
- Modify: `lib/actions/produtos.ts` (`buscarProdutos` — embutir contagem/preço das embalagens)

**Step 1:** `buscarProdutos` passa a trazer as embalagens (embed `produto_embalagens(nome, unidades, preco, padrao)`).

**Step 2:** Na lista, trocar a célula "Embalagem" (que mostrava "Fardo 500ml" confuso) por um resumo das formas — ex. "Unidade R$4,50 · Fardo 12 R$54,00" ou um contador "3 formas". Volume vira coluna/subtexto separado se couber.

**Step 3:** `npx tsc --noEmit` e `npx eslint . --quiet` — sem erro.

**Step 4: Commit**

```bash
git add "app/(app)/produtos/page.tsx" lib/actions/produtos.ts
git commit -m "fix: lista de produtos mostra formas de venda, separa volume"
```

---

### Task C5: PDV escolhe embalagem na venda

**Files:**
- Modify: `components/movimentacao/FormSaida.tsx`
- Modify: `components/pedido/BuscaProduto.tsx` (trazer embalagens junto do produto)
- Modify: `components/pedido/ListaItensPedido.tsx` (seletor de embalagem por linha)
- Modify: `types/index.ts` (`ItemPedido` ganha embalagem escolhida)

**Contexto:** hoje `FormSaida` tem `recalcularPorEmbalagem` + toggle "vender caixa fechada" (uma embalagem só). Trocar pelo seletor das embalagens cadastradas. **Backend não muda** — `registrarVenda` continua recebendo `{produto_id, quantidade (em unidade base), preco_unitario, total}`. A embalagem escolhida vira: `quantidade = qtdEmbalagens * embalagem.unidades`, `preco_unitario = embalagem.preco / embalagem.unidades`, `total = qtdEmbalagens * embalagem.preco`.

**Step 1:** `BuscaProduto`/`buscarProdutos` já trarão as embalagens (Task C4). Ao adicionar um produto na comanda, default = embalagem `padrao`.

**Step 2:** Em `ListaItensPedido`, cada linha ganha um seletor (dropdown/segmented) das embalagens daquele produto. Trocar a embalagem recalcula quantidade/preço/total (adaptar `recalcularPorEmbalagem`). Mostrar "= N unidades" e o preço batendo.

**Step 3:** `ItemPedido` (em `types/index.ts`) ganha `embalagemId`, `embalagemNome`, `embalagemUnidades`. A validação de estoque (que já existe em `registrarVenda`) usa `quantidade` em unidade base — continua funcionando sem mudança.

**Step 4:** `pedido_itens` guarda a embalagem: adicionar colunas `embalagem_nome text`, `embalagem_unidades numeric` (migration curta) e gravá-las em `registrarVenda`. Detalhe/recibo/romaneio passam a mostrar "1 Fardo 12 (12 un)" em vez de só "12 unidade". (Migration: `2026-07-03-pedido-itens-embalagem.sql`.)

**Step 5:** `npx tsc --noEmit`, `npx eslint . --quiet`, `npx next build` — sem erro.

**Step 6: Testar local (Playwright):** venda de balcão escolhendo "Fardo 12" de Skol → confirmar que baixa 12 do estoque (não 1), que o total = preço do fardo, e que o detalhe do pedido mostra a embalagem. Testar também unidade avulsa (comportamento de hoje). Limpar dados de teste + devolver estoque.

**Step 7: Commit**

```bash
git add components/movimentacao/FormSaida.tsx components/pedido/BuscaProduto.tsx components/pedido/ListaItensPedido.tsx types/index.ts lib/actions/pedidos.ts supabase/migrations/2026-07-03-pedido-itens-embalagem.sql
git commit -m "feat: PDV escolhe embalagem na venda, pedido_itens guarda a forma vendida"
```

---

### Task C6: Refino visual do PDV (Frente 3)

**Files:**
- Modify: `components/pedido/ListaItensPedido.tsx`, `components/movimentacao/FormSaida.tsx`

**Step 1:** Polir o seletor de embalagem: destaque visual da forma escolhida, "consome N un do estoque" explícito, aviso quando a quantidade em embalagem fechada excede o saldo. Melhorar toque/leitura no mobile (o balcão é rápido).

**Step 2:** `npx tsc --noEmit`, `npx eslint . --quiet` — sem erro.

**Step 3: Testar local** o fluxo completo no mobile viewport (Playwright 390px).

**Step 4: Commit**

```bash
git add components/pedido/ListaItensPedido.tsx components/movimentacao/FormSaida.tsx
git commit -m "polish: seletor de embalagem no PDV (consumo de estoque explicito, mobile)"
```

---

### Task C7: Verificação final e deploy do Bloco C

**Step 1:** `npx tsc --noEmit`, `npx eslint . --quiet`, `npx next build` — todos sem erro.
**Step 2:** Teste manual completo (Playwright): cadastrar produto multi-embalagem → vender em caixa fechada → conferir estoque baixado certo → conferir recibo/detalhe → conferir que os relatórios (corrigidos no Bloco A) contam a venda certa.
**Step 3:** `git push`, aguardar Vercel, re-testar em produção.

---

## Resumo dos blocos

- **Bloco A** (A1-A3): 3 bugs de relatório. Rápido, isolado, destrava confiança nos números.
- **Bloco B** (B1-B4): cargos + tela do entregador. Feature vertical fechada.
- **Bloco C** (C1-C7): múltiplas embalagens + PDV. A maior — migration de dados + cadastro + PDV + recibo.

Cada task é commitável sozinha. Push/verificação em produção ao fim de cada bloco (A e C fecham com deploy; B tem B4 dedicado).
