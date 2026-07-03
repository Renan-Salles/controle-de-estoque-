# Backlog pós-teste (nav Fiado, fiado parcial, endereço livre, turno do entregador) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar os 4 itens da spec `docs/superpowers/specs/2026-07-03-backlog-pos-teste-design.md`: mover "Fiado" pro menu Operação, permitir fiado parcial (parte paga na hora + resto fiado), permitir endereço de entrega em texto livre quando não há cliente cadastrado, e dar à tela do entregador saudação por horário + controle de expediente + estimativa de tempo.

**Architecture:** Next.js 16 App Router (Server Components + Server Actions) sobre Supabase Postgres. Cada sub-projeto é aditivo (novas colunas/tabela, nunca reescreve dado existente) e reaproveita padrões já estabelecidos no repo (zod nas actions, `as any` nos writes do Supabase — ver Global Constraints, `FormSection`/`Campo` pros formulários, `getLocalAtivoId()` pra escopo de local).

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase (Postgres + `@supabase/ssr`), Tailwind 4, `@base-ui/react` (Select), zod, sonner (toast), lucide-react.

## Global Constraints

- Português correto, com acentos — nunca simplificar pra ASCII. Sem travessão (—) em copy voltado pro usuário (labels, toasts, dashboards) — pode usar travessão só em comentário de código.
- Toda migration em `supabase/migrations/YYYY-MM-DD-descricao.sql`, aplicada com o comando `node -e` de uma linha documentado no `CLAUDE.md` da raiz (usa `pg.Pool` contra `DATABASE_URL` de `.env.local`). Rodar exatamente esse comando após criar cada arquivo de migration, na ordem em que os tasks aparecem aqui.
- Writes do Supabase nesta base sempre passam por `(supabase.from('tabela') as any).insert(...)` (o client gerado tem inferência `never` sistêmica — ver `next.config.ts` com `ignoreBuildErrors: true`). Seguir esse padrão em todo insert/update novo, não tentar "corrigir" a tipagem.
- **Sem suite de testes automatizada neste projeto** (confirmado em `CLAUDE.md`). Onde a skill de referência pediria "escreva o teste, rode, veja falhar, implemente, rode de novo", os passos aqui usam a verificação real deste repo: `npx tsc --noEmit` (sempre, toda task) + um passo manual concreto (SQL via `node -e` com `pg.Pool`, ou clique-a-clique no navegador com resultado esperado exato). Rode `npx tsc --noEmit` a cada task antes de commitar — zero erro novo introduzido.
- `getLocalAtivoId()` (`lib/local.ts`) é a única fonte de "qual local", nunca hardcodar. Toda query/insert que já existia devia continuar filtrando por local — não remover esses filtros ao editar.
- Commits pequenos, um por task, sempre terminando em `git push origin main` (convenção já em uso nesta sessão).

---

## Sub-projeto 1 — Nav: mover Fiado pra Operação

### Task 1: Mover item "Fiado" do grupo Relatórios pro grupo Operação

**Files:**
- Modify: `components/shell/nav-items.tsx:46-87` (grupos `GRUPO_OPERACAO` e `GRUPO_RELATORIOS`)
- Modify: `lib/nav-catalogo.ts:16-38` (`NAV_CATALOGO`, item `/financeiro/a-receber`)

**Interfaces:**
- Consumes: nenhuma (mudança isolada de dados estáticos de navegação).
- Produces: item de menu `/financeiro/a-receber` continua existindo com o mesmo `href`; só mudam `label` (de "A receber" pra "Fiado") e a que grupo pertence. Nenhuma outra task depende disso.

- [ ] **Step 1: Remover "A receber" de `GRUPO_RELATORIOS` e adicionar "Fiado" em `GRUPO_OPERACAO`**

Em `components/shell/nav-items.tsx`, editar o bloco `GRUPO_OPERACAO` (linhas 46-52) de:

```ts
const ITEM_CAIXA: Item = { href: '/caixa', label: 'Caixa', icon: Landmark }

const GRUPO_OPERACAO: Grupo = {
  titulo: 'Operação',
  icone: ArrowRightLeft,
  itens: [ITEM_PEDIDOS, ITEM_MOVIMENTACOES, ITEM_ESTOQUE, ITEM_CAIXA],
}
```

para:

```ts
const ITEM_CAIXA: Item = { href: '/caixa', label: 'Caixa', icon: Landmark }
const ITEM_FIADO: Item = { href: '/financeiro/a-receber', label: 'Fiado', icon: HandCoins }

const GRUPO_OPERACAO: Grupo = {
  titulo: 'Operação',
  icone: ArrowRightLeft,
  itens: [ITEM_PEDIDOS, ITEM_MOVIMENTACOES, ITEM_ESTOQUE, ITEM_CAIXA, ITEM_FIADO],
}
```

E editar `GRUPO_RELATORIOS` (linhas 69-87) removendo a linha do "A receber":

```ts
const GRUPO_RELATORIOS: Grupo = {
  titulo: 'Relatórios',
  icone: BarChart3,
  itens: [
    { href: '/relatorios', label: 'Por período', icon: BarChart3 },
    { href: '/relatorios/produto', label: 'Por produto', icon: Package },
    { href: '/relatorios/cliente', label: 'Por cliente', icon: Users },
    { href: '/relatorios/entregadores', label: 'Entregadores', icon: Truck },
    { href: '/relatorios/locais', label: 'Entre locais', icon: Store },
    { href: '/financeiro/relatorios', label: 'Faturamento & ABC', icon: TrendingUp },
    { href: '/financeiro/resultado', label: 'Resultado', icon: DollarSign },
    { href: '/financeiro/a-pagar', label: 'A pagar', icon: ArrowUpFromLine },
    { href: '/financeiro/custos-fixos', label: 'Custos Fixos', icon: ReceiptText },
    { href: '/financeiro/formas-pagamento', label: 'Formas de pagamento', icon: Wallet },
  ],
}
```

(a diferença é a remoção da linha `{ href: '/financeiro/a-receber', label: 'A receber', icon: HandCoins },`; o import de `HandCoins` no topo do arquivo continua usado, agora por `ITEM_FIADO`).

- [ ] **Step 2: Atualizar o catálogo de permissões**

Em `lib/nav-catalogo.ts`, trocar a linha (dentro de `NAV_CATALOGO`):

```ts
  { href: '/financeiro/a-receber', label: 'Vendas por período', grupo: 'Relatórios' },
```

Atenção: o `label` atual desse item específico no catálogo já está (corretamente) como `'A receber'`, não copie o label de outro item por engano. O diff real é:

De:
```ts
  { href: '/financeiro/a-receber', label: 'A receber', grupo: 'Relatórios' },
```
Para:
```ts
  { href: '/financeiro/a-receber', label: 'Fiado', grupo: 'Operação' },
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: nenhum erro novo (o arquivo compilava limpo antes desta mudança).

- [ ] **Step 4: Verificação manual no navegador**

Com o dev server rodando (`npm run dev`), logado como admin:
1. Abrir a sidebar — o grupo "Operação" deve mostrar, nessa ordem: Pedidos, Movimentações, Estoque, Caixa, Fiado.
2. O grupo "Relatórios" > sub-rótulo "Financeiro" não deve mais ter "A receber" na lista.
3. Clicar em "Fiado" deve abrir a mesma tela de sempre (`/financeiro/a-receber`, título "Fiado / A receber"), comportamento inalterado.
4. Abrir `/configuracoes/cargos`, conferir que o checkbox antes rotulado algo relacionado a "A receber" agora aparece como "Fiado" na seção de permissões (não precisa estar sob um sub-cabeçalho "Operação" ali — só o rótulo mudou).

- [ ] **Step 5: Commit**

```bash
git add components/shell/nav-items.tsx lib/nav-catalogo.ts
git commit -m "feat: move item Fiado para o grupo Operacao do menu"
git push origin main
```

---

## Sub-projeto 2 — Fiado parcial

### Task 2: Migration — colunas de fiado parcial em `pedidos`

**Files:**
- Create: `supabase/migrations/2026-07-03-fiado-parcial.sql`

**Interfaces:**
- Produces: colunas `pedidos.valor_pago_agora` (numeric, not null, default 0) e `pedidos.forma_pagamento_parcial` (varchar, nullable, check nas 4 formas à vista). Usadas por todas as tasks seguintes deste sub-projeto.

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- Fiado parcial: parte da venda pode ser paga na hora (numa forma a vista)
-- e o resto vira fiado. contas_receber ja tem valor/valor_pago prontos pra
-- isso -- so faltava o pedido guardar quanto e em que forma entrou na hora.
alter table public.pedidos
  add column if not exists valor_pago_agora numeric not null default 0;

alter table public.pedidos
  add column if not exists forma_pagamento_parcial varchar(20);

alter table public.pedidos
  drop constraint if exists pedidos_forma_pagamento_parcial_check;

alter table public.pedidos
  add constraint pedidos_forma_pagamento_parcial_check
  check (forma_pagamento_parcial in ('dinheiro', 'pix', 'cartao_debito', 'cartao_credito') or forma_pagamento_parcial is null);
```

- [ ] **Step 2: Aplicar a migration**

Run:
```bash
node -e "require('dotenv').config({path:'.env.local'}); const {Pool}=require('pg'); const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); pool.query(require('fs').readFileSync('./supabase/migrations/2026-07-03-fiado-parcial.sql','utf8')).then(()=>{console.log('ok');pool.end()}).catch(e=>{console.error(e.message);pool.end()})"
```
Expected: imprime `ok`.

- [ ] **Step 3: Confirmar as colunas no banco**

Run:
```bash
node -e "require('dotenv').config({path:'.env.local'}); const {Pool}=require('pg'); const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); pool.query(\"select column_name, data_type, column_default from information_schema.columns where table_name='pedidos' and column_name in ('valor_pago_agora','forma_pagamento_parcial')\").then(r=>{console.log(JSON.stringify(r.rows,null,2));pool.end()}).catch(e=>{console.error(e.message);pool.end()})"
```
Expected: 2 linhas — `valor_pago_agora` (numeric, default `0`), `forma_pagamento_parcial` (character varying, default null).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/2026-07-03-fiado-parcial.sql
git commit -m "feat: colunas de fiado parcial em pedidos"
git push origin main
```

### Task 3: `registrarVenda` aceita e grava fiado parcial

**Files:**
- Modify: `lib/actions/pedidos.ts:19-174` (`VendaSchema`, `registrarVenda`)

**Interfaces:**
- Consumes: colunas da Task 2.
- Produces: `registrarVenda(data)` passa a aceitar `valor_pago_agora?: number` e `forma_pagamento_parcial?: 'dinheiro'|'pix'|'cartao_debito'|'cartao_credito'` no payload. Usado pela Task 4 (FormSaida).

- [ ] **Step 1: Adicionar os 2 campos ao `VendaSchema`**

Em `lib/actions/pedidos.ts`, editar `VendaSchema` (linhas 19-37) de:

```ts
const VendaSchema = z.object({
  // Cliente opcional: venda de balcao pode nao ter cliente identificado.
  // Fiado exige cliente (validado abaixo, pois depende de outro campo).
  cliente_id: z.string().uuid().nullable().optional(),
  forma_pagamento: z.enum(['dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'fiado']),
  prazo_dias: z.number().int().min(1).max(180).optional(),
  observacoes: z.string().optional(),
  canal: z.enum(['telefone', 'whatsapp', 'balcao']).default('balcao'),
  itens: z.array(ItemSchema).min(1, 'Adicione pelo menos 1 item'),
  tipo_fulfillment: z.enum(['balcao', 'entrega', 'retirada']).default('balcao'),
  entregador_id: z.string().uuid().nullable().optional(),
  frete: z.number().min(0).default(0),
  pago: z.boolean().optional(),
  // Desconto em R$ sobre a mercadoria (nao sobre o frete). Valida contra o
  // subtotal mais abaixo (depende dos itens).
  desconto: z.number().min(0).default(0),
  // Quanto o cliente entregou em dinheiro (pro cupom mostrar o troco).
  valor_recebido: z.number().min(0).optional(),
})
```

para:

```ts
const VendaSchema = z.object({
  // Cliente opcional: venda de balcao pode nao ter cliente identificado.
  // Fiado exige cliente (validado abaixo, pois depende de outro campo).
  cliente_id: z.string().uuid().nullable().optional(),
  forma_pagamento: z.enum(['dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'fiado']),
  prazo_dias: z.number().int().min(1).max(180).optional(),
  observacoes: z.string().optional(),
  canal: z.enum(['telefone', 'whatsapp', 'balcao']).default('balcao'),
  itens: z.array(ItemSchema).min(1, 'Adicione pelo menos 1 item'),
  tipo_fulfillment: z.enum(['balcao', 'entrega', 'retirada']).default('balcao'),
  entregador_id: z.string().uuid().nullable().optional(),
  frete: z.number().min(0).default(0),
  pago: z.boolean().optional(),
  // Desconto em R$ sobre a mercadoria (nao sobre o frete). Valida contra o
  // subtotal mais abaixo (depende dos itens).
  desconto: z.number().min(0).default(0),
  // Quanto o cliente entregou em dinheiro (pro cupom mostrar o troco).
  valor_recebido: z.number().min(0).optional(),
  // Fiado parcial: quanto ja entrou na hora (numa forma a vista) e em qual
  // forma. So faz sentido quando forma_pagamento = 'fiado'; validado abaixo
  // porque depende de outro campo do mesmo objeto.
  valor_pago_agora: z.number().min(0).optional(),
  forma_pagamento_parcial: z.enum(['dinheiro', 'pix', 'cartao_debito', 'cartao_credito']).optional(),
  // Endereco de entrega em texto livre (sub-projeto 3, ja incluido aqui
  // porque e o mesmo objeto de payload).
  endereco_entrega: z
    .object({
      rua: z.string().optional(),
      numero: z.string().optional(),
      bairro: z.string().optional(),
      cidade: z.string().optional(),
    })
    .optional(),
})
```

- [ ] **Step 2: Validar e usar os campos em `registrarVenda`**

Editar o início de `registrarVenda` (logo após as validações já existentes, linhas 42-49) de:

```ts
export async function registrarVenda(data: unknown) {
  const parsed = VendaSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  if (parsed.data.forma_pagamento === 'fiado' && !parsed.data.cliente_id) {
    return { error: 'Selecione um cliente para venda fiado' }
  }
  if (parsed.data.tipo_fulfillment === 'entrega' && !parsed.data.entregador_id) {
    return { error: 'Escolha quem vai entregar' }
  }
```

para:

```ts
export async function registrarVenda(data: unknown) {
  const parsed = VendaSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  if (parsed.data.forma_pagamento === 'fiado' && !parsed.data.cliente_id) {
    return { error: 'Selecione um cliente para venda fiado' }
  }
  if (parsed.data.tipo_fulfillment === 'entrega' && !parsed.data.entregador_id) {
    return { error: 'Escolha quem vai entregar' }
  }
  const valorPagoAgora = parsed.data.forma_pagamento === 'fiado' ? (parsed.data.valor_pago_agora ?? 0) : 0
  if (valorPagoAgora > 0 && !parsed.data.forma_pagamento_parcial) {
    return { error: 'Escolha em qual forma o valor pago agora entrou' }
  }
```

Depois, no cálculo de `total` (linha 62), adicionar logo abaixo a validação de que `valorPagoAgora` não passa do total:

```ts
  const total = +(subtotal + frete - desconto).toFixed(2)
  if (valorPagoAgora > total) {
    return { error: 'Valor pago agora não pode ser maior que o total da venda' }
  }
```

- [ ] **Step 3: Gravar as 2 colunas no insert de `pedidos`**

No bloco de `.insert({...})` em `pedidos` (linhas 117-139), adicionar as 2 colunas novas (e a de endereço, já que o schema já as define — sub-projeto 3 usa o mesmo insert). Trecho atual:

```ts
    .insert({
      cliente_id: parsed.data.cliente_id ?? null,
      atendente_id: user.id,
      local_id: localId,
      status: 'concluida',
      forma_pagamento,
      prazo_pagamento_dias: prazoDias,
      data_vencimento: dataVencimento,
      observacoes: parsed.data.observacoes || null,
      canal: parsed.data.canal,
      tipo_fulfillment,
      entregador_id: tipo_fulfillment === 'entrega' ? parsed.data.entregador_id : null,
      frete,
      pago,
      concluido_em: concluidoEm,
      subtotal,
      desconto_total: desconto,
      valor_recebido:
        forma_pagamento === 'dinheiro' && parsed.data.valor_recebido != null && parsed.data.valor_recebido > 0
          ? parsed.data.valor_recebido
          : null,
      total,
    })
```

vira:

```ts
    .insert({
      cliente_id: parsed.data.cliente_id ?? null,
      atendente_id: user.id,
      local_id: localId,
      status: 'concluida',
      forma_pagamento,
      prazo_pagamento_dias: prazoDias,
      data_vencimento: dataVencimento,
      observacoes: parsed.data.observacoes || null,
      canal: parsed.data.canal,
      tipo_fulfillment,
      entregador_id: tipo_fulfillment === 'entrega' ? parsed.data.entregador_id : null,
      frete,
      pago,
      concluido_em: concluidoEm,
      subtotal,
      desconto_total: desconto,
      valor_recebido:
        forma_pagamento === 'dinheiro' && parsed.data.valor_recebido != null && parsed.data.valor_recebido > 0
          ? parsed.data.valor_recebido
          : null,
      valor_pago_agora: valorPagoAgora,
      forma_pagamento_parcial: valorPagoAgora > 0 ? parsed.data.forma_pagamento_parcial : null,
      endereco_entrega:
        tipo_fulfillment === 'entrega' && !parsed.data.cliente_id && parsed.data.endereco_entrega
          ? parsed.data.endereco_entrega
          : null,
      total,
    })
```

- [ ] **Step 4: `contas_receber` nasce com `valor_pago` já preenchido**

No bloco `if (forma_pagamento === 'fiado') { ... }` (linhas 160-174), trocar:

```ts
  if (forma_pagamento === 'fiado') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: errReceber } = await (serviceClient.from('contas_receber') as any).insert({
      pedido_id: venda.id,
      cliente_id: parsed.data.cliente_id,
      descricao: `Venda #${String(venda.numero_pedido).padStart(4, '0')}`,
      valor: total,
      valor_pago: 0,
      status: 'aberto',
      data_emissao: hoje,
      data_vencimento: dataVencimento,
      forma_pagamento: 'fiado',
    })
    if (errReceber) return { error: errReceber.message }
  }
```

para:

```ts
  if (forma_pagamento === 'fiado') {
    const restante = +(total - valorPagoAgora).toFixed(2)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: errReceber } = await (serviceClient.from('contas_receber') as any).insert({
      pedido_id: venda.id,
      cliente_id: parsed.data.cliente_id,
      descricao: `Venda #${String(venda.numero_pedido).padStart(4, '0')}`,
      valor: total,
      valor_pago: valorPagoAgora,
      status: restante <= 0 ? 'pago' : 'aberto',
      data_emissao: hoje,
      data_pagamento: restante <= 0 ? hoje : null,
      data_vencimento: dataVencimento,
      forma_pagamento: 'fiado',
    })
    if (errReceber) return { error: errReceber.message }
  }
```

(o limite de crédito, calculado logo acima em `registrarVenda`, soma `valor - valor_pago` das contas abertas do cliente — já funciona sem mudança nenhuma, porque agora `valor_pago` nasce correto).

- [ ] **Step 5: Selecionar as novas colunas em `buscarPedidoParaCupom`**

Em `buscarPedidoParaCupom` (linhas 216-229), trocar o `.select(...)` de:

```ts
    .select(`
      numero_pedido, data_pedido, total, subtotal, desconto_total, frete, valor_recebido, forma_pagamento, prazo_pagamento_dias, observacoes,
      locais(nome),
      clientes(nome, telefone, endereco),
      pedido_itens(quantidade_pedida, preco_unitario, total, embalagem_nome, embalagem_unidades, produtos(nome, embalagem))
    `)
```

para:

```ts
    .select(`
      numero_pedido, data_pedido, total, subtotal, desconto_total, frete, valor_recebido, forma_pagamento, prazo_pagamento_dias, observacoes, valor_pago_agora, forma_pagamento_parcial,
      locais(nome),
      clientes(nome, telefone, endereco),
      pedido_itens(quantidade_pedida, preco_unitario, total, embalagem_nome, embalagem_unidades, produtos(nome, embalagem))
    `)
```

- [ ] **Step 6: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: nenhum erro novo.

- [ ] **Step 7: Verificação manual via SQL**

Com o dev server rodando, registrar (pelo navegador, em `/movimentacoes/nova`, mesmo sem a UI da Task 4 ainda — dá pra fazer via `fetch` no console do navegador, ou simplesmente pular esta verificação por SQL direto e confiar na verificação da Task 4, que já cobre o fluxo completo pela UI). Caso queira confirmar só a coluna nova sem esperar a Task 4, rode direto:

```bash
node -e "require('dotenv').config({path:'.env.local'}); const {Pool}=require('pg'); const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); pool.query(\"select column_default from information_schema.columns where table_name='pedidos' and column_name='valor_pago_agora'\").then(r=>{console.log(JSON.stringify(r.rows));pool.end()}).catch(e=>{console.error(e.message);pool.end()})"
```
Expected: `[{"column_default":"0"}]` — confirma que o default está ativo (toda venda antiga e nova sem fiado parcial continua com `valor_pago_agora = 0`, comportamento idêntico a antes).

- [ ] **Step 8: Commit**

```bash
git add lib/actions/pedidos.ts
git commit -m "feat: registrarVenda aceita fiado parcial e endereco de entrega livre"
git push origin main
```

### Task 4: UI do FormSaida — checkbox de fiado parcial

**Files:**
- Modify: `components/movimentacao/FormSaida.tsx`

**Interfaces:**
- Consumes: `registrarVenda` com os campos `valor_pago_agora`/`forma_pagamento_parcial` (Task 3).
- Produces: nenhuma outra task depende diretamente desta UI.

- [ ] **Step 1: Novo estado**

Em `components/movimentacao/FormSaida.tsx`, logo abaixo da declaração de `recebido` (linha 145: `const [recebido, setRecebido] = useState('')`), adicionar:

```ts
  const [pagouParte, setPagouParte] = useState(false)
  const [valorPagoAgora, setValorPagoAgora] = useState('')
  const [formaPagamentoParcial, setFormaPagamentoParcial] = useState<
    'dinheiro' | 'pix' | 'cartao_debito' | 'cartao_credito'
  >('dinheiro')
```

- [ ] **Step 2: Enviar os campos no payload de `registrar`**

Dentro de `registrar` (linhas 173-227), no objeto passado a `registrarVenda`, adicionar 2 propriedades logo após `valor_recebido`:

```ts
      valor_recebido:
        formaPagamento === 'dinheiro' && recebidoNum > 0 ? recebidoNum : undefined,
      valor_pago_agora:
        formaPagamento === 'fiado' && pagouParte ? Number(valorPagoAgora) || 0 : undefined,
      forma_pagamento_parcial:
        formaPagamento === 'fiado' && pagouParte ? formaPagamentoParcial : undefined,
    })
```

E adicionar `pagouParte, valorPagoAgora, formaPagamentoParcial` no array de dependências do `useCallback` de `registrar` (linha 227):

```ts
  }, [cliente, itens, formaPagamento, prazoDias, observacoes, tipoFulfillment, entregadorId, freteNum, jaPago, descontoNum, recebidoNum, pagouParte, valorPagoAgora, formaPagamentoParcial])
```

- [ ] **Step 3: Resetar em `novaVenda()`**

Em `novaVenda()` (linhas 387-402), adicionar ao final:

```ts
    setPagouParte(false)
    setValorPagoAgora('')
    setFormaPagamentoParcial('dinheiro')
  }
```

- [ ] **Step 4: Checkbox + campos condicionais na UI**

No bloco `{formaPagamento === 'fiado' && ( ... )}` (linhas 880-905), dentro do `<>` que já mostra prazo/vencimento, adicionar o checkbox e os campos logo depois do parágrafo "Vence em ...". Trecho atual desse `<>`:

```tsx
                <>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Prazo para pagamento (dias)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={prazoDias}
                    onChange={(e) => setPrazoDias(e.target.value)}
                    className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-ring/50"
                  />
                  <p className="text-xs text-text-muted">
                    Vence em{' '}
                    {formatarData(addDias(hojeBrasil(), Number(prazoDias) || 0))}
                  </p>
                </>
```

vira:

```tsx
                <>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Prazo para pagamento (dias)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={prazoDias}
                    onChange={(e) => setPrazoDias(e.target.value)}
                    className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-ring/50"
                  />
                  <p className="text-xs text-text-muted">
                    Vence em{' '}
                    {formatarData(addDias(hojeBrasil(), Number(prazoDias) || 0))}
                  </p>

                  <label className="mt-2 flex items-center gap-2 text-sm text-text">
                    <input
                      type="checkbox"
                      checked={pagouParte}
                      onChange={(e) => setPagouParte(e.target.checked)}
                      className="size-4 rounded border-border"
                    />
                    Cliente já pagou uma parte?
                  </label>

                  {pagouParte && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <div className="inline-flex h-9 flex-1 items-center rounded-lg border border-border bg-surface pl-2">
                          <span className="font-mono text-xs text-text-muted">R$</span>
                          <input
                            type="number"
                            min={0}
                            max={total}
                            step="0.01"
                            value={valorPagoAgora}
                            onChange={(e) => setValorPagoAgora(e.target.value)}
                            placeholder="0,00"
                            className="h-9 w-full bg-transparent px-2 text-sm text-text outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            aria-label="Valor pago agora"
                          />
                        </div>
                        <Select
                          value={formaPagamentoParcial}
                          onValueChange={(v) => v && setFormaPagamentoParcial(v as typeof formaPagamentoParcial)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue>{(v: string) => rotuloPagamento(v)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dinheiro">Dinheiro</SelectItem>
                            <SelectItem value="pix">Pix</SelectItem>
                            <SelectItem value="cartao_debito">Cartão débito</SelectItem>
                            <SelectItem value="cartao_credito">Cartão crédito</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs text-text-muted">
                        Vai ficar fiado:{' '}
                        {formatarReal(Math.max(total - (Number(valorPagoAgora) || 0), 0))}, vencimento em{' '}
                        {formatarData(addDias(hojeBrasil(), Number(prazoDias) || 0))}
                      </p>
                    </div>
                  )}
                </>
```

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: nenhum erro novo.

- [ ] **Step 6: Verificação manual no navegador**

Em `/movimentacoes/nova`:
1. Selecionar um cliente cadastrado (qualquer um), adicionar 1 produto de R$50 (ajustar preço unitário se precisar pra fechar valor redondo).
2. Escolher forma de pagamento "Fiado" — aparece o prazo de sempre.
3. Marcar "Cliente já pagou uma parte?" — aparecem o campo de valor e o select de forma.
4. Digitar `20` no valor e deixar "Dinheiro" selecionado — o texto abaixo deve dizer "Vai ficar fiado: R$ 30,00, vencimento em [data + prazo]".
5. Registrar a venda. Deve funcionar sem erro (task 3 já grava tudo).
6. Ir em `/financeiro/a-receber` — a conta desse pedido deve aparecer com valor em aberto de R$30,00 (não R$50,00).

- [ ] **Step 7: Commit**

```bash
git add components/movimentacao/FormSaida.tsx
git commit -m "feat: FormSaida permite marcar fiado parcial"
git push origin main
```

### Task 5: Caixa (`resumoDoDia`) soma o valor pago na hora

**Files:**
- Modify: `lib/actions/caixa.ts:20-47`

**Interfaces:**
- Consumes: `pedidos.valor_pago_agora`/`forma_pagamento_parcial` (Task 2).
- Produces: `resumoDoDia()` continua com a mesma assinatura/retorno (`ResumoDia`), só o cálculo interno muda.

- [ ] **Step 1: Somar `valor_pago_agora` por forma, além do `total` de vendas à vista**

Trocar `resumoDoDia()` de:

```ts
export async function resumoDoDia(): Promise<ResumoDia> {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const hoje = hojeBrasil()

  const { data, error } = await supabase
    .from('pedidos')
    .select('forma_pagamento, total')
    .eq('local_id', localId)
    .eq('status', 'concluida')
    .eq('pago', true)
    .gte('data_pedido', `${hoje}T00:00:00-03:00`)
    .lte('data_pedido', `${hoje}T23:59:59.999-03:00`)
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as { forma_pagamento: string; total: number }[]
  const soma = (forma: string) =>
    rows.filter((r) => r.forma_pagamento === forma).reduce((a, r) => a + Number(r.total ?? 0), 0)

  return {
    data: hoje,
    dinheiro: soma('dinheiro'),
    pix: soma('pix'),
    debito: soma('cartao_debito'),
    credito: soma('cartao_credito'),
    totalVendas: rows.length,
  }
}
```

para:

```ts
export async function resumoDoDia(): Promise<ResumoDia> {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const hoje = hojeBrasil()

  const { data, error } = await supabase
    .from('pedidos')
    .select('forma_pagamento, total, pago, valor_pago_agora, forma_pagamento_parcial')
    .eq('local_id', localId)
    .eq('status', 'concluida')
    .gte('data_pedido', `${hoje}T00:00:00-03:00`)
    .lte('data_pedido', `${hoje}T23:59:59.999-03:00`)
  if (error) throw new Error(error.message)

  type Linha = {
    forma_pagamento: string
    total: number
    pago: boolean
    valor_pago_agora: number | null
    forma_pagamento_parcial: string | null
  }
  const rows = (data ?? []) as Linha[]

  // Vendas totalmente a vista e pagas (comportamento de sempre) + a fatia
  // paga na hora de vendas fiado parciais (forma_pagamento_parcial), que
  // entram no caixa mesmo com forma_pagamento = 'fiado' e pago = false.
  const soma = (forma: string) =>
    rows.filter((r) => r.pago && r.forma_pagamento === forma).reduce((a, r) => a + Number(r.total ?? 0), 0) +
    rows
      .filter((r) => r.forma_pagamento === 'fiado' && r.forma_pagamento_parcial === forma)
      .reduce((a, r) => a + Number(r.valor_pago_agora ?? 0), 0)

  const totalVendas = rows.filter((r) => r.pago).length

  return {
    data: hoje,
    dinheiro: soma('dinheiro'),
    pix: soma('pix'),
    debito: soma('cartao_debito'),
    credito: soma('cartao_credito'),
    totalVendas,
  }
}
```

Nota: antes o filtro `.eq('pago', true)` acontecia na query; agora ele acontece em memória (`r.pago`) porque a mesma linha de dados também precisa alimentar a soma de `valor_pago_agora` de pedidos fiado que podem ter `pago = false`. `totalVendas` mantém a mesma semântica de antes (conta só vendas com `pago = true`).

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: nenhum erro novo.

- [ ] **Step 3: Verificação manual**

1. Repetir o fluxo da Task 4 (venda fiado de R$50 com R$20 pago em dinheiro).
2. Ir em `/caixa` — "Dinheiro esperado" (ou o card equivalente do resumo do dia) deve incluir os R$20, mesmo o pedido não estando com `pago = true`.
3. Fechar o caixa com o valor contado batendo (contado = esperado) e confirmar que a diferença calculada é R$0,00.

- [ ] **Step 4: Commit**

```bash
git add lib/actions/caixa.ts
git commit -m "feat: caixa do dia soma valor pago na hora de fiado parcial"
git push origin main
```

### Task 6: Formas de pagamento (`buscarFormasPagamento`) soma o valor pago na hora

**Files:**
- Modify: `lib/actions/financeiro.ts:50-85`

**Interfaces:**
- Consumes: `pedidos.valor_pago_agora`/`forma_pagamento_parcial` (Task 2).
- Produces: `buscarFormasPagamento(periodo)` mantém a mesma assinatura/retorno.

- [ ] **Step 1: Mesma soma da Task 5, aplicada aqui**

Trocar `buscarFormasPagamento` de:

```ts
export async function buscarFormasPagamento(periodo: 'mes' | 'tudo' = 'mes') {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  let query = supabase
    .from('pedidos')
    .select('forma_pagamento, total, data_pedido')
    .eq('status', 'concluida')
    .eq('local_id', localId)

  if (periodo === 'mes') {
    const inicioMes = `${mesAtualBrasil()}-01`
    query = query.gte('data_pedido', `${inicioMes}T00:00:00`)
  }

  const { data, error } = await query
  if (error) throw error

  const rows = (data ?? []) as { forma_pagamento: string; total: number }[]
  const formas = ['dinheiro', 'pix', 'cartao_debito', 'cartao_credito'] as const
  const resumo = formas.map((f) => {
    const dela = rows.filter((r) => r.forma_pagamento === f)
    const valor = dela.reduce((a, r) => a + Number(r.total ?? 0), 0)
    return { forma: f, valor, quantidade: dela.length }
  })
  const totalGeral = resumo.reduce((a, r) => a + r.valor, 0)
  const totalVendas = rows.length

  return {
    resumo: resumo.map((r) => ({
      ...r,
      pct: totalGeral > 0 ? (r.valor / totalGeral) * 100 : 0,
    })),
    totalGeral,
    totalVendas,
  }
}
```

para:

```ts
export async function buscarFormasPagamento(periodo: 'mes' | 'tudo' = 'mes') {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  let query = supabase
    .from('pedidos')
    .select('forma_pagamento, total, data_pedido, valor_pago_agora, forma_pagamento_parcial')
    .eq('status', 'concluida')
    .eq('local_id', localId)

  if (periodo === 'mes') {
    const inicioMes = `${mesAtualBrasil()}-01`
    query = query.gte('data_pedido', `${inicioMes}T00:00:00`)
  }

  const { data, error } = await query
  if (error) throw error

  type Linha = {
    forma_pagamento: string
    total: number
    valor_pago_agora: number | null
    forma_pagamento_parcial: string | null
  }
  const rows = (data ?? []) as Linha[]
  const formas = ['dinheiro', 'pix', 'cartao_debito', 'cartao_credito'] as const
  const resumo = formas.map((f) => {
    const dela = rows.filter((r) => r.forma_pagamento === f)
    const parciais = rows.filter((r) => r.forma_pagamento === 'fiado' && r.forma_pagamento_parcial === f)
    const valor =
      dela.reduce((a, r) => a + Number(r.total ?? 0), 0) +
      parciais.reduce((a, r) => a + Number(r.valor_pago_agora ?? 0), 0)
    return { forma: f, valor, quantidade: dela.length + parciais.length }
  })
  const totalGeral = resumo.reduce((a, r) => a + r.valor, 0)
  const totalVendas = rows.length

  return {
    resumo: resumo.map((r) => ({
      ...r,
      pct: totalGeral > 0 ? (r.valor / totalGeral) * 100 : 0,
    })),
    totalGeral,
    totalVendas,
  }
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: nenhum erro novo.

- [ ] **Step 3: Verificação manual**

Ir em `/financeiro/formas-pagamento` (período "Este mês"), conferir que o card "Dinheiro" inclui os R$20 do teste da Task 4/5 sem duplicar (a venda fiado em si não aparece nos cards de dinheiro/pix/débito/crédito, só a fatia paga na hora).

- [ ] **Step 4: Commit**

```bash
git add lib/actions/financeiro.ts
git commit -m "feat: relatorio de formas de pagamento soma valor pago na hora de fiado parcial"
git push origin main
```

### Task 7: Cupom e tela do pedido mostram o fiado parcial

**Files:**
- Modify: `components/romaneio/CupomFiscal.tsx:4-37, 216-222`
- Modify: `app/(app)/pedidos/[id]/page.tsx:22-52, 85-91, 260-272`

**Interfaces:**
- Consumes: campos `valor_pago_agora`/`forma_pagamento_parcial` já selecionados pela Task 3 (`buscarPedidoParaCupom`) e a query do pedido (editada nesta task).

- [ ] **Step 1: `CupomData` ganha os 2 campos**

Em `components/romaneio/CupomFiscal.tsx`, adicionar ao `interface CupomData` (logo após `valor_recebido?: number | null`):

```ts
  valor_recebido?: number | null
  valor_pago_agora?: number | null
  forma_pagamento_parcial?: string | null
```

- [ ] **Step 2: Mostrar as 2 linhas no lugar da linha única "PGTO: Fiado (N dias)"**

Trocar o bloco de pagamento (linhas 216-222) de:

```tsx
      {/* Pagamento */}
      <div style={{ fontSize: '10px' }}>
        <div>PGTO: {rotuloPagamento(data.forma_pagamento)} ({prazo})</div>
        {data.observacoes && (
          <div style={{ marginTop: '4px', color: '#444' }}>OBS: {data.observacoes}</div>
        )}
      </div>
```

para:

```tsx
      {/* Pagamento */}
      <div style={{ fontSize: '10px' }}>
        {data.forma_pagamento === 'fiado' && Number(data.valor_pago_agora ?? 0) > 0 ? (
          <>
            <div>
              Pago agora: {formatarReal(Number(data.valor_pago_agora))} (
              {rotuloPagamento(data.forma_pagamento_parcial ?? '')})
            </div>
            <div>
              Fiado: {formatarReal(data.total - Number(data.valor_pago_agora))} ({prazo})
            </div>
          </>
        ) : (
          <div>PGTO: {rotuloPagamento(data.forma_pagamento)} ({prazo})</div>
        )}
        {data.observacoes && (
          <div style={{ marginTop: '4px', color: '#444' }}>OBS: {data.observacoes}</div>
        )}
      </div>
```

- [ ] **Step 3: Tela do pedido (`/pedidos/[id]`) mostra a mesma quebra**

Em `app/(app)/pedidos/[id]/page.tsx`, adicionar `valor_pago_agora` e `forma_pagamento_parcial` ao tipo `VendaComRelacoes` (logo após `forma_pagamento: string`):

```ts
  forma_pagamento: string
  valor_pago_agora: number
  forma_pagamento_parcial: string | null
```

Adicionar as 2 colunas na query `.select(...)` (linha 88), no mesmo lugar onde já está `forma_pagamento`:

```ts
    .select(
      `id, numero_pedido, status, total, subtotal, data_pedido, forma_pagamento, valor_pago_agora, forma_pagamento_parcial, prazo_pagamento_dias, data_vencimento, observacoes, tipo_fulfillment, frete, pago, concluido_em, saiu_entrega_em, entregador:profiles!pedidos_entregador_id_fkey(nome, telefone), clientes(nome, telefone, endereco), pedido_itens(quantidade_pedida, preco_unitario, total, embalagem_nome, embalagem_unidades, produtos(nome, embalagem))`,
    )
```

E trocar o bloco `<LinhaDado icone={CreditCard} rotulo="Pagamento" .../>` (linhas 261-265) mais o bloco de vencimento logo abaixo (linhas 266-272) de:

```tsx
        <LinhaDado
          icone={CreditCard}
          rotulo="Pagamento"
          valor={rotuloPagamento(venda.forma_pagamento)}
        />
        {venda.forma_pagamento === 'fiado' && venda.data_vencimento && (
          <LinhaDado
            icone={Clock}
            rotulo="Vencimento"
            valor={`${formatarData(venda.data_vencimento)} (${venda.prazo_pagamento_dias} dias)`}
          />
        )}
```

para:

```tsx
        <LinhaDado
          icone={CreditCard}
          rotulo="Pagamento"
          valor={
            venda.forma_pagamento === 'fiado' && Number(venda.valor_pago_agora) > 0 ? (
              <>
                {rotuloPagamento(venda.forma_pagamento_parcial ?? '')} (pago agora):{' '}
                <Money valor={venda.valor_pago_agora} /> · Fiado:{' '}
                <Money valor={venda.total - Number(venda.valor_pago_agora)} />
              </>
            ) : (
              rotuloPagamento(venda.forma_pagamento)
            )
          }
        />
        {venda.forma_pagamento === 'fiado' && venda.data_vencimento && (
          <LinhaDado
            icone={Clock}
            rotulo="Vencimento"
            valor={`${formatarData(venda.data_vencimento)} (${venda.prazo_pagamento_dias} dias)`}
          />
        )}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: nenhum erro novo.

- [ ] **Step 5: Verificação manual**

1. Registrar outra venda fiado parcial (R$40 total, R$15 pago em Pix agora).
2. Na tela de sucesso, abrir "Ver cupom" — deve mostrar 2 linhas: "Pago agora: R$ 15,00 (Pix)" e "Fiado: R$ 25,00 (7 dias)" (ou o prazo escolhido).
3. Abrir `/pedidos/[id]` desse pedido — a linha "Pagamento" deve mostrar "Pix (pago agora): R$ 15,00 · Fiado: R$ 25,00".

- [ ] **Step 6: Commit**

```bash
git add components/romaneio/CupomFiscal.tsx "app/(app)/pedidos/[id]/page.tsx"
git commit -m "feat: cupom e tela do pedido mostram fiado parcial"
git push origin main
```

---

## Sub-projeto 3 — Endereço de entrega em texto livre

### Task 8: Migration — `endereco_entrega` em `pedidos`

**Files:**
- Create: `supabase/migrations/2026-07-03-endereco-entrega-livre.sql`

- [ ] **Step 1: Criar a migration**

```sql
-- Endereco de entrega em texto livre: usado quando a venda e tipo Entrega
-- mas nao tem cliente cadastrado (o formulario nao tinha onde digitar isso
-- antes). Mesmo formato jsonb de clientes.endereco, pra reaproveitar a
-- formatacao e a busca de taxa por bairro ja existentes.
alter table public.pedidos
  add column if not exists endereco_entrega jsonb;
```

- [ ] **Step 2: Aplicar**

Run:
```bash
node -e "require('dotenv').config({path:'.env.local'}); const {Pool}=require('pg'); const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); pool.query(require('fs').readFileSync('./supabase/migrations/2026-07-03-endereco-entrega-livre.sql','utf8')).then(()=>{console.log('ok');pool.end()}).catch(e=>{console.error(e.message);pool.end()})"
```
Expected: imprime `ok`.

Nota: a coluna `endereco_entrega` já é aceita e gravada pelo `registrarVenda` desde a Task 3 (o schema/insert já previam esse campo desde aquele momento) — esta task só cria a coluna que faltava no banco. Sem essa migration aplicada, o insert da Task 3 já rodava sem erro (Postgres ignora silenciosamente uma chave a mais? **Não** — na verdade o insert falharia com "column does not exist" se alguém já tivesse mandado esse campo antes desta migration. Como a UI que envia esse campo só é criada na Task 9, não há problema de ordem: rode esta task antes de mexer na UI.)

- [ ] **Step 3: Confirmar a coluna**

Run:
```bash
node -e "require('dotenv').config({path:'.env.local'}); const {Pool}=require('pg'); const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); pool.query(\"select column_name, data_type from information_schema.columns where table_name='pedidos' and column_name='endereco_entrega'\").then(r=>{console.log(JSON.stringify(r.rows));pool.end()}).catch(e=>{console.error(e.message);pool.end()})"
```
Expected: `[{"column_name":"endereco_entrega","data_type":"jsonb"}]`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/2026-07-03-endereco-entrega-livre.sql
git commit -m "feat: coluna endereco_entrega em pedidos"
git push origin main
```

### Task 9: FormSaida — campos de endereço quando não há cliente

**Files:**
- Modify: `components/movimentacao/FormSaida.tsx`

**Interfaces:**
- Consumes: `taxaPorBairro` (já importado no arquivo), `registrarVenda` com `endereco_entrega` (Task 3).

- [ ] **Step 1: Novo estado**

Logo abaixo do bloco adicionado na Task 4 Step 1, adicionar:

```ts
  const [enderecoRua, setEnderecoRua] = useState('')
  const [enderecoNumero, setEnderecoNumero] = useState('')
  const [enderecoBairro, setEnderecoBairro] = useState('')
  const [enderecoCidade, setEnderecoCidade] = useState('')
```

- [ ] **Step 2: Helper de sugestão de frete a partir do bairro digitado**

Logo abaixo da função `sugerirFrete` já existente (linhas 470-481), adicionar:

```ts
  // Mesma logica de sugerirFrete, mas a partir do bairro digitado a mao (sem
  // cliente cadastrado) em vez do endereco de um ClienteResumo.
  function sugerirFreteBairro(bairro: string) {
    if (!bairro.trim()) return
    taxaPorBairro(bairro)
      .then((taxa) => {
        if (taxa != null) {
          setFrete((atual) => (atual === '' ? String(taxa) : atual))
          toast.info(`Frete de ${bairro}: ${formatarReal(taxa)} (ajuste se precisar)`)
        }
      })
      .catch(() => {})
  }
```

- [ ] **Step 3: Enviar `endereco_entrega` no payload**

No objeto passado a `registrarVenda` (mesmo bloco editado na Task 4 Step 2), adicionar mais uma propriedade:

```ts
      forma_pagamento_parcial:
        formaPagamento === 'fiado' && pagouParte ? formaPagamentoParcial : undefined,
      endereco_entrega:
        tipoFulfillment === 'entrega' && !cliente
          ? {
              rua: enderecoRua || undefined,
              numero: enderecoNumero || undefined,
              bairro: enderecoBairro || undefined,
              cidade: enderecoCidade || undefined,
            }
          : undefined,
    })
```

E incluir `enderecoRua, enderecoNumero, enderecoBairro, enderecoCidade` no array de dependências do `useCallback` de `registrar`.

- [ ] **Step 4: Resetar em `novaVenda()`**

No mesmo lugar da Task 4 Step 3, adicionar:

```ts
    setEnderecoRua('')
    setEnderecoNumero('')
    setEnderecoBairro('')
    setEnderecoCidade('')
  }
```

- [ ] **Step 5: Campos na UI**

Logo depois do bloco `{tipoFulfillment === 'entrega' && (...)}` do Frete (linhas 693-712) e antes do checkbox "Já foi pago" (linha 714), adicionar:

```tsx
        {tipoFulfillment === 'entrega' && !cliente && (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Endereço de entrega
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={enderecoRua}
                onChange={(e) => setEnderecoRua(e.target.value)}
                placeholder="Rua"
                className="col-span-2 h-9 rounded-md border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand"
              />
              <input
                value={enderecoNumero}
                onChange={(e) => setEnderecoNumero(e.target.value)}
                placeholder="Número"
                className="h-9 rounded-md border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand"
              />
              <input
                value={enderecoBairro}
                onChange={(e) => setEnderecoBairro(e.target.value)}
                onBlur={() => sugerirFreteBairro(enderecoBairro)}
                placeholder="Bairro"
                className="h-9 rounded-md border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand"
              />
              <input
                value={enderecoCidade}
                onChange={(e) => setEnderecoCidade(e.target.value)}
                placeholder="Cidade"
                className="col-span-2 h-9 rounded-md border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand"
              />
            </div>
          </div>
        )}
```

**Escopo explícito:** estes 4 campos (e os de fiado parcial da Task 4) **não** são gravados em `ComandaEspera`/`segurarComanda`/`retomarComanda` — segurar uma comanda com esses campos preenchidos e retomar depois perde esse preenchimento (a pessoa digita de novo). Combinação rara (fiado parcial ou entrega sem cliente, e ainda por cima segurar a comanda); não vale a complexidade de estender o tipo `ComandaEspera` agora.

- [ ] **Step 6: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: nenhum erro novo.

- [ ] **Step 7: Verificação manual no navegador**

1. Em `/movimentacoes/nova`, tipo "Entrega", **sem** selecionar cliente.
2. Devem aparecer os campos Rua/Número/Bairro/Cidade.
3. Digitar um bairro que já tenha taxa cadastrada (ex. "Pituba", já usado em testes anteriores) e sair do campo (blur) — o frete deve auto-preencher, igual já acontece quando tem cliente.
4. Selecionar um cliente depois de já ter digitado o endereço — os campos de endereço devem sumir (já que agora tem cliente).
5. Registrar a venda sem cliente com o endereço preenchido — deve funcionar sem erro.

- [ ] **Step 8: Commit**

```bash
git add components/movimentacao/FormSaida.tsx
git commit -m "feat: FormSaida permite endereco de entrega livre sem cliente cadastrado"
git push origin main
```

### Task 10: Leitura do endereço livre (card do entregador, pedido, wa.me)

**Files:**
- Modify: `lib/actions/pedidos.ts:426-444` (`listarMinhasEntregas`)
- Modify: `components/entregador/CardEntrega.tsx:9-39`
- Modify: `components/entregador/TelaEntregador.tsx:31-53`
- Modify: `app/(app)/pedidos/[id]/page.tsx:22-52, 85-91, 99-117`

**Interfaces:**
- Consumes: coluna `pedidos.endereco_entrega` (Task 8).
- Produces: `CardEntrega` passa a aceitar `entrega.endereco_entrega` opcional; `TelaEntregador`/`listarMinhasEntregas` propagam esse campo.

- [ ] **Step 1: `listarMinhasEntregas` seleciona a nova coluna**

Em `lib/actions/pedidos.ts`, trocar o `.select(...)` de `listarMinhasEntregas` (linha 434):

```ts
      'id, numero_pedido, total, forma_pagamento, pago, data_pedido, saiu_entrega_em, clientes(nome, telefone, endereco)',
```

para:

```ts
      'id, numero_pedido, total, forma_pagamento, pago, data_pedido, saiu_entrega_em, endereco_entrega, clientes(nome, telefone, endereco)',
```

- [ ] **Step 2: `CardEntrega` recebe e usa o fallback**

Em `components/entregador/CardEntrega.tsx`, editar o tipo `EntregaResumo` (linhas 9-22) de:

```ts
export type EntregaResumo = {
  id: string
  numero_pedido: number
  total: number
  forma_pagamento: string
  pago: boolean
  saiu_entrega_em: string | null
  cliente: {
    nome: string
    telefone: string | null
    endereco: { rua?: string; numero?: string; bairro?: string; cidade?: string } | null
  } | null
  localNome: string
}
```

para:

```ts
type Endereco = { rua?: string; numero?: string; bairro?: string; cidade?: string } | null

export type EntregaResumo = {
  id: string
  numero_pedido: number
  total: number
  forma_pagamento: string
  pago: boolean
  saiu_entrega_em: string | null
  cliente: {
    nome: string
    telefone: string | null
    endereco: Endereco
  } | null
  // Endereco digitado na hora, quando a venda e Entrega sem cliente
  // cadastrado. So usado quando `cliente` e null (ou o cliente nao tem
  // endereco salvo) -- cliente cadastrado sempre tem prioridade.
  endereco_entrega: Endereco
  localNome: string
}
```

E remover o `type Endereco = ...` que já existia logo abaixo (linha 24, ficaria duplicado) — deletar essa linha isolada:

```ts
type Endereco = { rua?: string; numero?: string; bairro?: string; cidade?: string } | null
```

Depois, dentro do componente `CardEntrega`, trocar a linha (linha 39):

```ts
  const { linha1, linha2 } = enderecoPartes(entrega.cliente?.endereco ?? null)
```

para:

```ts
  const { linha1, linha2 } = enderecoPartes(entrega.cliente?.endereco ?? entrega.endereco_entrega ?? null)
```

- [ ] **Step 3: `TelaEntregador` propaga o campo**

Em `components/entregador/TelaEntregador.tsx`, adicionar `endereco_entrega` ao tipo `EntregaRaw` (linhas 31-43):

```ts
type EntregaRaw = {
  id: string
  numero_pedido: number
  total: number
  forma_pagamento: string
  pago: boolean
  saiu_entrega_em: string | null
  endereco_entrega: { rua?: string; numero?: string; bairro?: string; cidade?: string } | null
  clientes: Rel<{
    nome: string
    telefone: string | null
    endereco: { rua?: string; numero?: string; bairro?: string; cidade?: string } | null
  }>
}
```

E no `.map` que monta o `EntregaResumo` (linhas 111-127), adicionar a propriedade:

```tsx
              <CardEntrega
                key={e.id}
                entrega={
                  {
                    id: e.id,
                    numero_pedido: e.numero_pedido,
                    total: e.total,
                    forma_pagamento: e.forma_pagamento,
                    pago: e.pago,
                    saiu_entrega_em: e.saiu_entrega_em,
                    cliente: umaRel(e.clientes),
                    endereco_entrega: e.endereco_entrega,
                    localNome: local.nome,
                  } satisfies EntregaResumo
                }
              />
```

- [ ] **Step 4: Pedido detail + link de WhatsApp usam o mesmo fallback**

Em `app/(app)/pedidos/[id]/page.tsx`, adicionar `endereco_entrega` ao tipo `VendaComRelacoes` (junto com o que já foi adicionado na Task 7):

```ts
  endereco_entrega: { rua?: string; numero?: string; bairro?: string; cidade?: string } | null
```

Incluir a coluna na query `.select(...)` (mesmo trecho editado na Task 7 Step 3):

```ts
    .select(
      `id, numero_pedido, status, total, subtotal, data_pedido, forma_pagamento, valor_pago_agora, forma_pagamento_parcial, prazo_pagamento_dias, data_vencimento, observacoes, tipo_fulfillment, frete, pago, concluido_em, saiu_entrega_em, endereco_entrega, entregador:profiles!pedidos_entregador_id_fkey(nome, telefone), clientes(nome, telefone, endereco), pedido_itens(quantidade_pedida, preco_unitario, total, embalagem_nome, embalagem_unidades, produtos(nome, embalagem))`,
    )
```

Trocar o cálculo de `linkAvisarEntregador` (linhas 102-117) — a linha `const end = venda.clientes?.endereco` vira:

```ts
    const end = venda.clientes?.endereco ?? venda.endereco_entrega
```

(o resto da função continua igual).

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: nenhum erro novo.

- [ ] **Step 6: Verificação manual no navegador**

1. Registrar uma venda tipo Entrega, sem cliente, com endereço "Rua Teste, 99" / bairro "Centro" / cidade "Salvador", designando um entregador (usar a conta de teste `entregador@gmail.com` já existente, ou qualquer pessoa ativa da Equipe).
2. Fazer login como esse entregador (ou abrir `/pedidos/[id]` como admin) e conferir que o endereço digitado aparece — não deve mais mostrar "Endereço não cadastrado".
3. No detalhe do pedido como admin, o botão "Avisar no WhatsApp" (se o entregador tiver telefone cadastrado) deve incluir esse endereço na mensagem.

- [ ] **Step 7: Commit**

```bash
git add lib/actions/pedidos.ts components/entregador/CardEntrega.tsx components/entregador/TelaEntregador.tsx "app/(app)/pedidos/[id]/page.tsx"
git commit -m "feat: card do entregador e detalhe do pedido leem o endereco de entrega livre"
git push origin main
```

---

## Sub-projeto 4 — Tela do entregador: saudação, expediente, estimativa

### Task 11: Migration — tabela `entregador_turnos`

**Files:**
- Create: `supabase/migrations/2026-07-03-entregador-turnos.sql`

**Interfaces:**
- Produces: tabela `entregador_turnos` (`id`, `entregador_id`, `local_id`, `iniciado_em`, `encerrado_em`), com índice único parcial garantindo no máximo 1 turno aberto por entregador. Usada pela Task 12.

- [ ] **Step 1: Criar a migration**

```sql
-- Turno de trabalho do entregador: "iniciar expediente"/"encerrar
-- expediente" na tela dele. Disponibilidade = ter (ou nao) um turno aberto
-- agora -- nao existe um status separado pra nao duplicar conceito.
create table if not exists public.entregador_turnos (
  id uuid primary key default gen_random_uuid(),
  entregador_id uuid not null references public.profiles(id),
  local_id uuid not null references public.locais(id),
  iniciado_em timestamptz not null default now(),
  encerrado_em timestamptz
);

-- So um turno aberto por entregador de cada vez.
create unique index if not exists entregador_turnos_aberto_unico
  on public.entregador_turnos (entregador_id)
  where encerrado_em is null;

alter table public.entregador_turnos enable row level security;

drop policy if exists "turnos por local" on public.entregador_turnos;
create policy "turnos por local" on public.entregador_turnos
  for all
  using (auth.uid() is not null and public.pode_acessar_local(local_id))
  with check (auth.uid() is not null and public.pode_acessar_local(local_id));
```

- [ ] **Step 2: Aplicar**

Run:
```bash
node -e "require('dotenv').config({path:'.env.local'}); const {Pool}=require('pg'); const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); pool.query(require('fs').readFileSync('./supabase/migrations/2026-07-03-entregador-turnos.sql','utf8')).then(()=>{console.log('ok');pool.end()}).catch(e=>{console.error(e.message);pool.end()})"
```
Expected: imprime `ok`.

- [ ] **Step 3: Confirmar a tabela e o índice**

Run:
```bash
node -e "require('dotenv').config({path:'.env.local'}); const {Pool}=require('pg'); const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); pool.query(\"select indexname from pg_indexes where tablename='entregador_turnos'\").then(r=>{console.log(JSON.stringify(r.rows));pool.end()}).catch(e=>{console.error(e.message);pool.end()})"
```
Expected: inclui `entregador_turnos_aberto_unico` na lista.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/2026-07-03-entregador-turnos.sql
git commit -m "feat: tabela entregador_turnos"
git push origin main
```

### Task 12: Server actions de turno + tempo médio pessoal

**Files:**
- Create: `lib/actions/turnos.ts`
- Modify: `lib/actions/relatorio-entregadores.ts`

**Interfaces:**
- Consumes: tabela `entregador_turnos` (Task 11).
- Produces: `meuTurnoAtivo(): Promise<{id: string; iniciado_em: string} | null>`, `iniciarTurno(): Promise<{success: true} | {error: string}>`, `encerrarTurno(): Promise<{success: true} | {error: string}>`, `turnosAbertosPorEntregador(): Promise<Record<string, string>>` (usados pela Task 13 e Task 14). `meuTempoMedioEntrega(): Promise<number | null>` (usado pela Task 13).

- [ ] **Step 1: Criar `lib/actions/turnos.ts`**

```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { getLocalAtivoId } from '@/lib/local'
import { revalidatePath } from 'next/cache'

export type TurnoAtivo = {
  id: string
  iniciado_em: string
}

// Turno em aberto do usuario logado. null = fora de expediente agora.
export async function meuTurnoAtivo(): Promise<TurnoAtivo | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('entregador_turnos')
    .select('id, iniciado_em')
    .eq('entregador_id', user.id)
    .is('encerrado_em', null)
    .maybeSingle()
  return (data as TurnoAtivo | null) ?? null
}

// Abre um turno novo. Recusa se ja houver um aberto (o indice unico parcial
// tambem trava isso no banco -- essa checagem so da uma mensagem melhor).
export async function iniciarTurno() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const localId = await getLocalAtivoId()

  const { data: aberto } = await supabase
    .from('entregador_turnos')
    .select('id')
    .eq('entregador_id', user.id)
    .is('encerrado_em', null)
    .maybeSingle()
  if (aberto) return { error: 'Você já está em expediente.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('entregador_turnos') as any).insert({
    entregador_id: user.id,
    local_id: localId,
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { success: true as const }
}

// Fecha o turno aberto do usuario logado.
export async function encerrarTurno() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error, count } = await (supabase.from('entregador_turnos') as any)
    .update({ encerrado_em: new Date().toISOString() }, { count: 'exact' })
    .eq('entregador_id', user.id)
    .is('encerrado_em', null)
  if (error) return { error: error.message }
  if (!count) return { error: 'Nenhum expediente em aberto.' }
  revalidatePath('/dashboard')
  return { success: true as const }
}

// Mapa entregador_id -> iniciado_em, so de quem esta com turno aberto agora
// no local ativo. Usado no relatorio de entregadores.
export async function turnosAbertosPorEntregador(): Promise<Record<string, string>> {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const { data } = await supabase
    .from('entregador_turnos')
    .select('entregador_id, iniciado_em')
    .eq('local_id', localId)
    .is('encerrado_em', null)
  const mapa: Record<string, string> = {}
  for (const t of (data ?? []) as { entregador_id: string; iniciado_em: string }[]) {
    mapa[t.entregador_id] = t.iniciado_em
  }
  return mapa
}
```

- [ ] **Step 2: Adicionar `meuTempoMedioEntrega` em `lib/actions/relatorio-entregadores.ts`**

Adicionar ao final do arquivo (depois da função `relatorioEntregadores` já existente):

```ts
// Tempo medio historico do entregador logado, sem filtro de periodo -- usado
// como "estimativa" na tela dele (nao ha geolocalizacao/rota no sistema,
// entao a estimativa e so a media do que ele mesmo costuma levar).
export async function meuTempoMedioEntrega(): Promise<number | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('pedidos')
    .select('saiu_entrega_em, concluido_em')
    .eq('entregador_id', user.id)
    .eq('tipo_fulfillment', 'entrega')
    .eq('status', 'concluida')
    .not('concluido_em', 'is', null)
    .not('saiu_entrega_em', 'is', null)
  if (error) throw new Error(error.message)

  const tempos = ((data ?? []) as { saiu_entrega_em: string; concluido_em: string }[])
    .map((r) => (new Date(r.concluido_em).getTime() - new Date(r.saiu_entrega_em).getTime()) / 60000)
    .filter((min) => Number.isFinite(min) && min >= 0)
  if (tempos.length === 0) return null
  return Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length)
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: nenhum erro novo.

- [ ] **Step 4: Verificação manual via SQL**

Depois de logar como o entregador de teste e usar a UI da Task 13 (ou, se quiser verificar antes da UI existir, inserir um turno manualmente):

```bash
node -e "
require('dotenv').config({path:'.env.local'});
const {Pool}=require('pg');
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
pool.query(\"select id from entregador_turnos where encerrado_em is null limit 5\").then(r=>{console.log(JSON.stringify(r.rows));pool.end()}).catch(e=>{console.error(e.message);pool.end()});
"
```
Expected: roda sem erro (tabela existe e é consultável).

- [ ] **Step 5: Commit**

```bash
git add lib/actions/turnos.ts lib/actions/relatorio-entregadores.ts
git commit -m "feat: server actions de turno do entregador e tempo medio pessoal"
git push origin main
```

### Task 13: `TelaEntregador` — saudação por horário + card de turno

**Files:**
- Create: `components/entregador/TurnoCard.tsx`
- Modify: `components/entregador/TelaEntregador.tsx`

**Interfaces:**
- Consumes: `meuTurnoAtivo`, `iniciarTurno`, `encerrarTurno` (Task 12), `meuTempoMedioEntrega` (Task 12).

- [ ] **Step 1: Criar `components/entregador/TurnoCard.tsx`**

```tsx
'use client'
import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PlayCircle, StopCircle, Clock } from 'lucide-react'
import { iniciarTurno, encerrarTurno, type TurnoAtivo } from '@/lib/actions/turnos'

// "3" -> "3 min"; "75" -> "1h 15min"
function tempoDecorrido(iniciadoEm: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iniciadoEm).getTime()) / 60000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const resto = min % 60
  return resto > 0 ? `${h}h ${resto}min` : `${h}h`
}

export function TurnoCard({
  turnoInicial,
  tempoMedioMin,
}: {
  turnoInicial: TurnoAtivo | null
  tempoMedioMin: number | null
}) {
  const router = useRouter()
  const [turno, setTurno] = useState(turnoInicial)
  const [, setTick] = useState(0)
  const [pendente, startTransition] = useTransition()

  // Re-renderiza a cada 30s so pra atualizar o "ha Xh Ymin" (o calculo em si
  // usa Date.now() direto, isso so forca o componente a recalcular).
  useEffect(() => {
    if (!turno) return
    const id = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(id)
  }, [turno])

  function alternar() {
    startTransition(async () => {
      if (turno) {
        const r = await encerrarTurno()
        if (r.error) {
          toast.error(r.error)
          return
        }
        setTurno(null)
        toast.success('Expediente encerrado')
      } else {
        const r = await iniciarTurno()
        if (r.error) {
          toast.error(r.error)
          return
        }
        setTurno({ id: 'novo', iniciado_em: new Date().toISOString() })
        toast.success('Expediente iniciado')
      }
      router.refresh()
    })
  }

  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
      <div className="min-w-0">
        {turno ? (
          <>
            <p className="text-sm font-semibold text-text">
              Em expediente há {tempoDecorrido(turno.iniciado_em)}
            </p>
            {tempoMedioMin != null && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-text-muted">
                <Clock className="size-3" strokeWidth={1.5} />
                Você costuma levar ~{tempoMedioMin} min por entrega
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-text-muted">Fora de expediente</p>
        )}
      </div>
      <button
        type="button"
        onClick={alternar}
        disabled={pendente}
        className={
          turno
            ? 'u-motion inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-err/30 bg-err/10 px-4 text-sm font-semibold text-err disabled:opacity-50'
            : 'u-motion inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50'
        }
      >
        {turno ? (
          <>
            <StopCircle className="size-4" strokeWidth={1.75} />
            Encerrar
          </>
        ) : (
          <>
            <PlayCircle className="size-4" strokeWidth={1.75} />
            Iniciar expediente
          </>
        )}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: `TelaEntregador` busca turno + tempo médio e usa saudação por horário**

Em `components/entregador/TelaEntregador.tsx`, adicionar os imports (junto aos já existentes):

```ts
import { meuTurnoAtivo } from '@/lib/actions/turnos'
import { meuTempoMedioEntrega } from '@/lib/actions/relatorio-entregadores'
import { TurnoCard } from './TurnoCard'
```

Adicionar a função de saudação (antes de `export async function TelaEntregador()`):

```ts
// Bom dia / Boa tarde / Boa noite conforme o horario de Brasilia.
function saudacao(): string {
  const hora = Number(
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'America/Sao_Paulo',
    }).format(new Date()),
  )
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}
```

Trocar o `Promise.all` (linhas 48-52) de:

```ts
  const [entregasRaw, local, nome] = await Promise.all([
    listarMinhasEntregas(),
    getLocalAtivo(),
    getNomePerfil(),
  ])
```

para:

```ts
  const [entregasRaw, local, nome, turnoAtivo, tempoMedioMin] = await Promise.all([
    listarMinhasEntregas(),
    getLocalAtivo(),
    getNomePerfil(),
    meuTurnoAtivo(),
    meuTempoMedioEntrega(),
  ])
```

Trocar a linha de saudação (linha 79):

```tsx
              {nome ? `Fala, ${nome.split(' ')[0]}!` : 'Suas entregas'}
```

para:

```tsx
              {nome ? `${saudacao()}, ${nome.split(' ')[0]}!` : 'Suas entregas'}
```

E adicionar o card de turno logo depois do bloco de saudação/placar (depois do `</div>` que fecha o `flex items-end justify-between gap-3`, antes de `<div className="mt-5 space-y-4">`):

```tsx
        <TurnoCard turnoInicial={turnoAtivo} tempoMedioMin={tempoMedioMin} />

        <div className="mt-5 space-y-4">
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: nenhum erro novo.

- [ ] **Step 4: Verificação manual no navegador**

1. Logar como o entregador de teste (`entregador@gmail.com`).
2. A saudação deve mostrar "Bom dia"/"Boa tarde"/"Boa noite" conforme a hora real no momento do teste (não mais "Fala,").
3. Deve aparecer o card "Fora de expediente" com botão "Iniciar expediente".
4. Clicar em "Iniciar expediente" — deve virar "Em expediente há 0 min" (ou "1 min") com botão "Encerrar". Se houver tempo médio calculável (precisa de pelo menos 1 entrega concluída com `saiu_entrega_em` e `concluido_em` no histórico), deve aparecer "Você costuma levar ~N min por entrega".
5. Recarregar a página (F5) — o turno deve continuar aberto (estado vem do banco, não é só client-side).
6. Clicar em "Encerrar" — volta pra "Fora de expediente".

- [ ] **Step 5: Commit**

```bash
git add components/entregador/TurnoCard.tsx components/entregador/TelaEntregador.tsx
git commit -m "feat: tela do entregador ganha saudacao por horario e controle de expediente"
git push origin main
```

### Task 14: Relatório de entregadores — coluna de turno atual

**Files:**
- Modify: `app/(app)/relatorios/entregadores/page.tsx`

**Interfaces:**
- Consumes: `turnosAbertosPorEntregador()` (Task 12).

- [ ] **Step 1: Buscar os turnos abertos junto com o relatório**

Em `app/(app)/relatorios/entregadores/page.tsx`, adicionar o import:

```ts
import { turnosAbertosPorEntregador } from '@/lib/actions/turnos'
```

Adicionar estado (junto aos outros `useState`):

```ts
  const [turnosAbertos, setTurnosAbertos] = useState<Record<string, string>>({})
```

Trocar a função `carregar` (linhas 39-49) de:

```ts
  async function carregar(p: { ini: string; fim: string }) {
    setLoading(true)
    try {
      setLinhas(await relatorioEntregadores(p))
    } catch (e) {
      console.error(e)
      toast.error('Erro ao carregar relatório')
    } finally {
      setLoading(false)
    }
  }
```

para:

```ts
  async function carregar(p: { ini: string; fim: string }) {
    setLoading(true)
    try {
      const [dados, turnos] = await Promise.all([relatorioEntregadores(p), turnosAbertosPorEntregador()])
      setLinhas(dados)
      setTurnosAbertos(turnos)
    } catch (e) {
      console.error(e)
      toast.error('Erro ao carregar relatório')
    } finally {
      setLoading(false)
    }
  }
```

- [ ] **Step 2: Nova coluna na tabela**

Adicionar `<TabelaHeadCell>Turno</TabelaHeadCell>` logo depois de `<TabelaHeadCell>Entregador</TabelaHeadCell>` (linha 95):

```tsx
            <tr>
              <TabelaHeadCell>Entregador</TabelaHeadCell>
              <TabelaHeadCell>Turno</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita">Entregas</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita">Tempo médio</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita">Frete somado</TabelaHeadCell>
            </tr>
```

E a célula correspondente, logo depois de `<TabelaCell className="font-medium">{l.nome}</TabelaCell>` (linha 104):

```tsx
                <TabelaCell className="font-medium">{l.nome}</TabelaCell>
                <TabelaCell>
                  {turnosAbertos[l.entregador_id] ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ok">
                      <span className="size-1.5 rounded-full bg-ok" aria-hidden />
                      Em expediente
                    </span>
                  ) : (
                    <span className="text-xs text-text-muted">Fora</span>
                  )}
                </TabelaCell>
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: nenhum erro novo.

- [ ] **Step 4: Verificação manual no navegador**

1. Logado como admin, com o entregador de teste **em expediente** (Task 13 Step 4), abrir `/relatorios/entregadores`.
2. A linha desse entregador deve mostrar "Em expediente" (verde) na coluna Turno.
3. Encerrar o expediente (voltando pra tela do entregador ou direto no banco) e recarregar o relatório — deve virar "Fora" (cinza).

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/relatorios/entregadores/page.tsx"
git commit -m "feat: relatorio de entregadores mostra turno atual"
git push origin main
```

---

## Verificação final (depois de todas as 14 tasks)

- [ ] Rodar `npx tsc --noEmit` e `npx eslint . --quiet` uma última vez no repo inteiro — zero erro.
- [ ] Rodar `npx next build` pra garantir que o build de produção passa (o `ignoreBuildErrors: true` cobre só os erros sistêmicos de tipo do Supabase já documentados, não deve mascarar erro novo de sintaxe/import).
- [ ] Repetir, em sequência, os testes manuais das Tasks 4, 6, 9, 10 e 13 num fluxo único: uma venda fiado parcial com entrega sem cliente e endereço livre, designando o entregador de teste, e then completar o fluxo (saiu → entregue → pago) e conferir Caixa + Formas de pagamento + Fiado (A receber) + Relatório de entregadores todos batendo.
