# Restrição de dados financeiros por cargo — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cargo Funcionario/Entregador deixa de ver lucro, faturamento, DRE,
diferença de caixa e contas a pagar — continua vendendo, cadastrando e
movimentando estoque normalmente.

**Architecture:** Três camadas de corte, cada uma no nível certo pra não
quebrar o que o funcionário precisa pra trabalhar: (1) RLS real
(`is_admin()`) só em `contas_pagar`, a única tabela financeira que o
funcionário nunca lê/grava; (2) checagem de cargo dentro das RPCs
`calcular_dre`/`calcular_dre_serie`, que ninguém sem ser admin tem motivo
de chamar; (3) redação nas server actions + condicional nas telas pra
`pedidos`, `contas_receber` e `caixa_fechamentos`, que continuam com a RLS
de hoje porque o funcionário precisa ler/gravar essas tabelas pra vender e
fechar caixa — só os campos agregados (lucro, esperado, diferença) somem da
resposta.

**Tech Stack:** Next.js 16 App Router, Server Actions, Supabase Postgres
(`security definer`/RLS), TypeScript, React 19 server components.

## Global Constraints

- Português correto, com acentos — nunca simplificar pra ASCII.
- Sem travessão (—) no copy voltado pro usuário (labels, toasts, dashboards).
- `npx tsc --noEmit`, `npx eslint <arquivos-tocados> --quiet` e
  `npx next build` ao final de cada task.
- Dev e produção são o **mesmo banco** Supabase (`jqdezlvqumzdkvvcbjtl`) —
  toda migration já é mudança ao vivo. `git push` logo depois de validar
  cada task, antes de seguir pra próxima (ver Task 2 e 3, que têm
  migration + consumer juntos por causa disso).
- Sem suite de testes automatizada neste projeto — verificação é
  `tsc`/`eslint`/`next build` + teste manual no browser, como já documentado
  em `CLAUDE.md`.
- Fail-open consistente com o resto do app: `cargo === null || cargo.admin
  === true` sempre vê os dados financeiros (mesma regra que
  `rotaPermitida` já usa) — nunca um cargo nulo ou mal configurado trava
  ninguém.
- Ver spec completa em
  `docs/superpowers/specs/2026-07-25-restricao-financeira-cargo-design.md`.

---

### Task 1: RLS de `contas_pagar` — remove a policy que anula o `is_admin()`

**Files:**
- Create: `supabase/migrations/2026-07-25-corrige-policy-contas-pagar.sql`

**Interfaces:**
- Produces: `contas_pagar` só permite select/insert/update/delete pra quem
  `is_admin()` retorna `true`. Nenhuma outra task depende disso.

Bug preexistente: `contas_pagar` tem duas policies permissivas — "admin ve
contas pagar" (`is_admin()`, `supabase/migrations/009_fix_rls_recursion.sql:36-38`)
e "gerente ve contas pagar" (só checa local,
`supabase/migrations/2026-07-01-rls-escopo-por-local.sql:70-74`). Postgres
faz OR entre policies `for all` permissivas do mesmo tipo, então a segunda
anula a primeira na prática. Funcionário/Entregador nunca leem nem gravam
`contas_pagar` hoje (não está em `itens_visiveis` de nenhum dos dois cargos
— confirmado consultando `select itens_visiveis from cargos`), então
remover essa policy não muda nenhum fluxo deles, só fecha o buraco.

- [ ] **Step 1: Criar e aplicar a migration**

```sql
-- supabase/migrations/2026-07-25-corrige-policy-contas-pagar.sql
-- "gerente ve contas pagar" nao filtra por cargo (so por local), e por ser
-- permissiva soma-se via OR com "admin ve contas pagar" (is_admin()),
-- anulando a intencao de admin-only. Funcionario/Entregador nunca
-- leem/gravam contas_pagar hoje (nao esta em itens_visiveis de nenhum dos
-- dois), entao remover essa policy nao muda fluxo nenhum deles.
drop policy if exists "gerente ve contas pagar" on public.contas_pagar;
```

Aplicar:

```bash
node -e "require('dotenv').config({path:'.env.local'}); const {Pool}=require('pg'); const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); pool.query(require('fs').readFileSync('./supabase/migrations/2026-07-25-corrige-policy-contas-pagar.sql','utf8')).then(()=>{console.log('ok');pool.end()}).catch(e=>{console.error(e.message);pool.end()})"
```

Expected: `ok` impresso, sem erro.

- [ ] **Step 2: Verificar que só sobrou a policy do admin**

```bash
node -e "require('dotenv').config({path:'.env.local'}); const {Pool}=require('pg'); const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); pool.query(\"select policyname, cmd from pg_policies where tablename='contas_pagar'\").then(r=>{console.log(JSON.stringify(r.rows,null,2));pool.end()}).catch(e=>{console.error(e.message);pool.end()})"
```

Expected: só aparece `admin ve contas pagar` na lista (mais qualquer
policy de local separada de outro comando, se existir — mas nenhuma
policy sem checagem de cargo pra `select`/`all`).

- [ ] **Step 3: Commit e push**

```bash
git add supabase/migrations/2026-07-25-corrige-policy-contas-pagar.sql
git commit -m "fix: remove policy que anulava is_admin() em contas_pagar"
git push
```

---

### Task 2: RPC `calcular_dre`/`calcular_dre_serie` só pra admin + dashboard esconde os blocos financeiros

**Files:**
- Create: `supabase/migrations/2026-07-25-dre-rpc-so-admin.sql`
- Modify: `app/(app)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `getCargoUsuario()` de `lib/permissoes.ts` (já existe, retorna
  `Cargo | null` com `{ id, nome, admin, itens_visiveis, ativo }`).
- Produces: `calcular_dre`/`calcular_dre_serie` retornam `null`/vazio pra
  quem não é admin. `podeVerFinanceiro` (variável local em
  `dashboard/page.tsx`) — não é exportado, cada arquivo que precisar da
  mesma checagem replica `!cargo || cargo.admin` (mesmo padrão que
  `rotaPermitida` já usa em `lib/nav-catalogo.ts`).

Migration e consumer na mesma task (e commit/push logo em seguida) porque,
como dev e prod são o mesmo banco, aplicar só a migration deixaria
`getDre()` recebendo `null` da RPC pro funcionário **antes** do dashboard
saber tratar isso — o card "Lucro do mês" mostraria um número zerado
errado até o próximo passo. Não é um vazamento (é o oposto: menos exposto
que antes), mas é uma tela quebrada em produção por alguns minutos — evitar
isso fazendo os dois juntos.

- [ ] **Step 1: Criar e aplicar a migration**

```sql
-- supabase/migrations/2026-07-25-dre-rpc-so-admin.sql
-- calcular_dre/calcular_dre_serie eram "language sql" chamaveis por
-- qualquer authenticated sem checagem de cargo -- um funcionario logado
-- conseguia pegar lucro/DRE direto via supabase.rpc(...), sem passar pela
-- tela. Viram plpgsql com early return: sem ser admin, calcular_dre
-- retorna null e calcular_dre_serie retorna 0 linhas.

create or replace function public.calcular_dre(p_local_id uuid, p_mes date)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not public.is_admin() then
    return null;
  end if;
  return (
    with
    periodo as (
      select
        (date_trunc('month', p_mes::timestamp) at time zone 'America/Sao_Paulo') as inicio,
        ((date_trunc('month', p_mes::timestamp) + interval '1 month') at time zone 'America/Sao_Paulo') as fim
    ),
    receita as (
      select coalesce(sum(p.total), 0) as valor
      from public.pedidos p, periodo
      where p.local_id = p_local_id
        and p.status != 'cancelada'
        and p.data_pedido >= periodo.inicio
        and p.data_pedido < periodo.fim
    ),
    cmv as (
      select coalesce(sum(abs(m.quantidade) * coalesce(m.custo_unitario, 0)), 0) as valor
      from public.movimentacoes_estoque m
      join public.produtos pr on pr.id = m.produto_id
      , periodo
      where pr.local_id = p_local_id
        and m.tipo = 'saida_venda'
        and m.created_at >= periodo.inicio
        and m.created_at < periodo.fim
    ),
    perdas as (
      select coalesce(sum(abs(m.quantidade) * coalesce(m.custo_unitario, 0)), 0) as valor
      from public.movimentacoes_estoque m
      join public.produtos pr on pr.id = m.produto_id
      , periodo
      where pr.local_id = p_local_id
        and m.tipo = 'descarte'
        and m.created_at >= periodo.inicio
        and m.created_at < periodo.fim
    )
    select json_build_object(
      'receita_bruta', (select valor from receita),
      'cmv',          (select valor from cmv),
      'margem_bruta', (select valor from receita) - (select valor from cmv),
      'perdas',       (select valor from perdas)
    )
  );
end;
$function$;

create or replace function public.calcular_dre_serie(p_local_id uuid, p_meses int default 6)
returns table (mes text, receita numeric, cmv numeric, perdas numeric)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not public.is_admin() then
    return;
  end if;
  return query
    with meses as (
      select to_char(
        (date_trunc('month', now() at time zone 'America/Sao_Paulo') - (n || ' months')::interval),
        'YYYY-MM'
      ) as mes
      from generate_series(0, greatest(p_meses, 1) - 1) as n
    ),
    vendas as (
      select to_char(p.data_pedido at time zone 'America/Sao_Paulo', 'YYYY-MM') as mes,
             sum(p.total) as receita
      from public.pedidos p
      where p.local_id = p_local_id and p.status != 'cancelada'
      group by 1
    ),
    movs as (
      select to_char(m.created_at at time zone 'America/Sao_Paulo', 'YYYY-MM') as mes,
             sum(abs(m.quantidade) * coalesce(m.custo_unitario, 0)) filter (where m.tipo = 'saida_venda') as cmv,
             sum(abs(m.quantidade) * coalesce(m.custo_unitario, 0)) filter (where m.tipo = 'descarte') as perdas
      from public.movimentacoes_estoque m
      join public.produtos pr on pr.id = m.produto_id
      where pr.local_id = p_local_id
      group by 1
    )
    select meses.mes,
           coalesce(vendas.receita, 0)::numeric,
           coalesce(movs.cmv, 0)::numeric,
           coalesce(movs.perdas, 0)::numeric
    from meses
    left join vendas on vendas.mes = meses.mes
    left join movs on movs.mes = meses.mes
    order by meses.mes desc;
end;
$function$;
```

Aplicar:

```bash
node -e "require('dotenv').config({path:'.env.local'}); const {Pool}=require('pg'); const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); pool.query(require('fs').readFileSync('./supabase/migrations/2026-07-25-dre-rpc-so-admin.sql','utf8')).then(()=>{console.log('ok');pool.end()}).catch(e=>{console.error(e.message);pool.end()})"
```

Expected: `ok` impresso, sem erro.

- [ ] **Step 2: `dashboard/page.tsx` — trocar `ehEntregador()` por `getCargoUsuario()` e calcular `podeVerFinanceiro`**

Trocar o import (linha 28):

```ts
import { ehEntregador } from '@/lib/permissoes'
```

por:

```ts
import { getCargoUsuario } from '@/lib/permissoes'
```

Trocar o topo da função (linhas 32-38):

```tsx
export default async function DashboardPage() {
  // Cargo Entregador tem a propria tela no lugar do dashboard: /dashboard e
  // o destino seguro pra onde todo cargo cai, entao roteia aqui em vez de
  // mexer no redirect de auth (que tem gotcha documentado no CLAUDE.md).
  if (await ehEntregador()) {
    return <TelaEntregador />
  }
```

por:

```tsx
export default async function DashboardPage() {
  const cargo = await getCargoUsuario()

  // Cargo Entregador tem a propria tela no lugar do dashboard: /dashboard e
  // o destino seguro pra onde todo cargo cai, entao roteia aqui em vez de
  // mexer no redirect de auth (que tem gotcha documentado no CLAUDE.md).
  if (cargo?.nome === 'Entregador') {
    return <TelaEntregador />
  }

  // Mesma regra de fail-open que rotaPermitida ja usa: cargo nulo ou
  // admin=true ve tudo. So cargos nao-admin (Funcionario, futuros cargos)
  // perdem os blocos de lucro/faturamento/caixa.
  const podeVerFinanceiro = !cargo || cargo.admin
```

- [ ] **Step 3: Buscas condicionais no `Promise.all`**

Trocar (linhas 51-73):

```tsx
  const [
    { data: pedidosHoje },
    { data: estoquesCriticos },
    { data: pedidosMes },
    stats,
    dre,
    resumoFiado,
    qtdPendentes,
    metaMes,
    pedidosRecentes,
    fechado,
  ] = await Promise.all([
    supabase.from('pedidos').select('total').gte('data_pedido', `${hoje}T00:00:00`).eq('status', 'concluida').eq('local_id', localId) as unknown as Promise<{ data: RowTotal[] }>,
    supabase.from('v_posicao_estoque').select('id').in('status_estoque', ['critico', 'ruptura']).eq('local_id', localId) as unknown as Promise<{ data: RowId[] }>,
    supabase.from('pedidos').select('data_pedido, total').gte('data_pedido', `${inicioMes}T00:00:00`).eq('status', 'concluida').eq('local_id', localId).order('data_pedido') as unknown as Promise<{ data: RowPedidoMes[] }>,
    getDashStats(),
    getDre(),
    buscarResumoFiado(),
    contarPedidosPendentes(),
    getMeta(),
    listarPedidosRecentes(),
    caixaFechadoHoje(localId),
  ])
```

por:

```tsx
  const [
    { data: pedidosHoje },
    { data: estoquesCriticos },
    { data: pedidosMes },
    stats,
    dre,
    resumoFiado,
    qtdPendentes,
    metaMes,
    pedidosRecentes,
    fechado,
  ] = await Promise.all([
    supabase.from('pedidos').select('total').gte('data_pedido', `${hoje}T00:00:00`).eq('status', 'concluida').eq('local_id', localId) as unknown as Promise<{ data: RowTotal[] }>,
    supabase.from('v_posicao_estoque').select('id').in('status_estoque', ['critico', 'ruptura']).eq('local_id', localId) as unknown as Promise<{ data: RowId[] }>,
    supabase.from('pedidos').select('data_pedido, total').gte('data_pedido', `${inicioMes}T00:00:00`).eq('status', 'concluida').eq('local_id', localId).order('data_pedido') as unknown as Promise<{ data: RowPedidoMes[] }>,
    getDashStats(),
    podeVerFinanceiro ? getDre() : Promise.resolve(null),
    podeVerFinanceiro ? buscarResumoFiado() : Promise.resolve(null),
    contarPedidosPendentes(),
    podeVerFinanceiro ? getMeta() : Promise.resolve(null),
    listarPedidosRecentes(),
    caixaFechadoHoje(localId),
  ])
```

(`dre`/`resumoFiado` agora inferem tipo `DreData | null` /
`Awaited<ReturnType<typeof buscarResumoFiado>> | null` automaticamente
pelo TypeScript por causa do `Promise.resolve(null)` condicional — nenhuma
anotação de tipo extra necessária. `metaMes` já era `number | null` antes.)

- [ ] **Step 4: Banner de fiado — guardar contra `resumoFiado === null`**

Trocar a condição do banner (linha 276):

```tsx
      {(resumoFiado.qtdVencidas > 0 || resumoFiado.qtdVencendo > 0) && (
```

por:

```tsx
      {resumoFiado && (resumoFiado.qtdVencidas > 0 || resumoFiado.qtdVencendo > 0) && (
```

(o corpo do banner, linhas 277-311, continua igual — só entra nesse bloco
quando `resumoFiado` não é `null`, então os acessos a
`resumoFiado.qtdVencidas`/`totalVencido`/etc. dentro continuam válidos.)

- [ ] **Step 5: KPIs — montar como array mutável, blocos financeiros só quando `podeVerFinanceiro`**

Trocar a declaração de `kpis` (linhas 114-165):

```tsx
  const kpis: Kpi[] = [
    {
      label: 'Vendas hoje',
      valor: String(qtdPedidosHoje),
      sub: 'receita do dia',
      money: receitaHoje,
      moneyDestaque: true,
      icon: ShoppingCart,
      tom: 'brand',
    },
    {
      label: 'Receita do mês',
      valor: '',
      money: receitaMes,
      moneyDestaque: true,
      sub: 'vendas concluídas no mês',
      icon: CalendarRange,
      tom: 'brand',
    },
    {
      label: 'Estoque crítico',
      valor: String(qtdCriticos),
      sub: qtdCriticos > 0 ? 'produtos abaixo do mínimo' : 'tudo dentro do mínimo',
      icon: Package,
      tom: qtdCriticos > 0 ? 'critico' : 'brand',
    },
    {
      label: 'Ticket médio do dia',
      valor: '',
      money: ticketMedioHoje,
      moneyDestaque: true,
      sub: qtdPedidosHoje > 0 ? 'por venda concluída hoje' : 'sem vendas hoje',
      icon: Receipt,
      tom: 'brand',
    },
    {
      label: 'Lucro do mês',
      valor: '',
      money: dre.lucro_liquido,
      moneyDestaque: dre.lucro_liquido >= 0,
      sub: `margem ${dre.lucro_liquido_pct.toFixed(1)}%`,
      icon: TrendingUp,
      tom: dre.lucro_liquido >= 0 ? 'ok' : 'critico',
    },
    {
      label: 'Cliente destaque',
      valor: stats.clienteVip ?? '-',
      sub: stats.clienteVip ? formatarReal(stats.ticketMedio) + ' ticket médio' : 'sem vendas no mês',
      icon: Star,
      tom: 'brand',
    },
  ]
```

por:

```tsx
  const kpis: Kpi[] = []
  if (podeVerFinanceiro) {
    kpis.push(
      {
        label: 'Vendas hoje',
        valor: String(qtdPedidosHoje),
        sub: 'receita do dia',
        money: receitaHoje,
        moneyDestaque: true,
        icon: ShoppingCart,
        tom: 'brand',
      },
      {
        label: 'Receita do mês',
        valor: '',
        money: receitaMes,
        moneyDestaque: true,
        sub: 'vendas concluídas no mês',
        icon: CalendarRange,
        tom: 'brand',
      },
    )
  }
  kpis.push({
    label: 'Estoque crítico',
    valor: String(qtdCriticos),
    sub: qtdCriticos > 0 ? 'produtos abaixo do mínimo' : 'tudo dentro do mínimo',
    icon: Package,
    tom: qtdCriticos > 0 ? 'critico' : 'brand',
  })
  if (podeVerFinanceiro && dre) {
    kpis.push(
      {
        label: 'Ticket médio do dia',
        valor: '',
        money: ticketMedioHoje,
        moneyDestaque: true,
        sub: qtdPedidosHoje > 0 ? 'por venda concluída hoje' : 'sem vendas hoje',
        icon: Receipt,
        tom: 'brand',
      },
      {
        label: 'Lucro do mês',
        valor: '',
        money: dre.lucro_liquido,
        moneyDestaque: dre.lucro_liquido >= 0,
        sub: `margem ${dre.lucro_liquido_pct.toFixed(1)}%`,
        icon: TrendingUp,
        tom: dre.lucro_liquido >= 0 ? 'ok' : 'critico',
      },
      {
        label: 'Cliente destaque',
        valor: stats.clienteVip ?? '-',
        sub: stats.clienteVip ? formatarReal(stats.ticketMedio) + ' ticket médio' : 'sem vendas no mês',
        icon: Star,
        tom: 'brand',
      },
    )
  }
```

(`if (podeVerFinanceiro && dre)` em vez de só `if (podeVerFinanceiro)`
porque `dre` é `DreData | null` — o TypeScript só libera o acesso a
`dre.lucro_liquido` dentro de um bloco onde já checou que não é `null`.
Como `dre` só é `null` quando `podeVerFinanceiro` é falso, na prática o
`&& dre` nunca reduz o que aparece, só satisfaz o compilador.)

- [ ] **Step 6: Meta do mês, gráfico e atalho "Formas de pagamento"**

A barra de meta (linha 314, `{metaMes != null && metaMes > 0 && (`) já
fica escondida sozinha pra quem não é admin, porque `metaMes` agora é
`null` nesse caso — nenhuma mudança necessária ali.

Trocar o bloco do gráfico + acesso rápido (linhas 384-436):

```tsx
      {/* Gráfico (2/3) + acesso rápido (1/3) */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="u-stagger rounded-xl border border-border bg-surface p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-text">
                Vendas
              </h2>
              <p className="text-[11px] uppercase tracking-wider text-text-muted">
                Últimos 7 dias
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider text-text-muted">
                Total do mês
              </p>
              <Money valor={receitaMes} destaque className="text-sm font-semibold" />
            </div>
          </div>
          <GraficoVendas dados={dadosGrafico} />
        </div>

        <div className="u-stagger rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-1 text-sm font-semibold tracking-tight text-text">
            Acesso rápido
          </h2>
          <p className="mb-4 text-[11px] uppercase tracking-wider text-text-muted">
            Atalhos do dia
          </p>
          <div className="-mx-2 divide-y divide-border/60">
            {atalhos.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="u-motion group flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-surface-2"
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${a.destaque ? 'bg-ok/10 text-ok' : 'bg-brand/10 text-brand'}`}
                >
                  <a.icon className="size-4" strokeWidth={1.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">{a.titulo}</p>
                  <p className="truncate text-[13px] text-text-muted">{a.desc}</p>
                </div>
                <ArrowUpRight
                  className="size-4 shrink-0 text-text-muted u-motion group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-text"
                  strokeWidth={1.5}
                />
              </Link>
            ))}
          </div>
        </div>
      </div>
```

por (o card "Acesso rápido" some do grid de 3 colunas e vira um card
sozinho quando não há gráfico, pra não sobrar coluna vazia; a lista de
atalhos filtra o que aponta pra `/financeiro/*`, que quem não é admin não
acessa mesmo):

```tsx
      {/* Gráfico (2/3) + acesso rápido (1/3), ou só acesso rápido quando
          não pode ver financeiro (grid de 1 coluna nesse caso). */}
      <div className={podeVerFinanceiro ? 'mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3' : 'mt-6'}>
        {podeVerFinanceiro && (
          <div className="u-stagger rounded-xl border border-border bg-surface p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-text">
                  Vendas
                </h2>
                <p className="text-[11px] uppercase tracking-wider text-text-muted">
                  Últimos 7 dias
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wider text-text-muted">
                  Total do mês
                </p>
                <Money valor={receitaMes} destaque className="text-sm font-semibold" />
              </div>
            </div>
            <GraficoVendas dados={dadosGrafico} />
          </div>
        )}

        <div className={`u-stagger rounded-xl border border-border bg-surface p-5 ${podeVerFinanceiro ? '' : 'max-w-md'}`}>
          <h2 className="mb-1 text-sm font-semibold tracking-tight text-text">
            Acesso rápido
          </h2>
          <p className="mb-4 text-[11px] uppercase tracking-wider text-text-muted">
            Atalhos do dia
          </p>
          <div className="-mx-2 divide-y divide-border/60">
            {atalhos
              .filter((a) => podeVerFinanceiro || !a.href.startsWith('/financeiro'))
              .map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="u-motion group flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-surface-2"
                >
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${a.destaque ? 'bg-ok/10 text-ok' : 'bg-brand/10 text-brand'}`}
                  >
                    <a.icon className="size-4" strokeWidth={1.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text">{a.titulo}</p>
                    <p className="truncate text-[13px] text-text-muted">{a.desc}</p>
                  </div>
                  <ArrowUpRight
                    className="size-4 shrink-0 text-text-muted u-motion group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-text"
                    strokeWidth={1.5}
                  />
                </Link>
              ))}
          </div>
        </div>
      </div>
```

- [ ] **Step 7: Verificar**

```bash
npx tsc --noEmit
npx eslint "app/(app)/dashboard/page.tsx" --quiet
npx next build
```

Expected: sem erros. Teste manual completo (com contas de teste de cada
cargo) fica pra Task 4 — aqui só confirmar que, logado como admin (única
conta disponível até a Task 4), o dashboard continua idêntico a antes.

- [ ] **Step 8: Commit e push**

```bash
git add supabase/migrations/2026-07-25-dre-rpc-so-admin.sql "app/(app)/dashboard/page.tsx"
git commit -m "feat: lucro/faturamento do dashboard e RPC de DRE ficam so pra admin"
git push
```

---

### Task 3: Caixa — esconde esperado/diferença de quem não é admin

**Files:**
- Modify: `lib/actions/caixa.ts`
- Modify: `components/caixa/FormFechamento.tsx`
- Modify: `app/(app)/caixa/page.tsx`

**Interfaces:**
- Consumes: `getCargoUsuario()` de `lib/permissoes.ts`.
- Produces: `Fechamento` (union discriminada por `diferenca`) e o retorno
  de `fecharCaixa()` (união discriminada do mesmo jeito) — usados só
  dentro desses 3 arquivos, não vazam pra fora do módulo caixa.

Sem tabela pra travar aqui: `caixa_fechamentos` continua com a RLS de hoje
(o funcionário precisa gravar o fechamento dele). O corte é só nos campos
que a server action devolve.

- [ ] **Step 1: `lib/actions/caixa.ts` — tipos e `listarFechamentos`**

Adicionar o import no topo do arquivo:

```ts
import { getCargoUsuario } from '@/lib/permissoes'
```

Trocar o type `Fechamento` (linhas 109-121):

```ts
export type Fechamento = {
  id: string
  data: string
  dinheiro_contado: number
  esperado_dinheiro: number
  esperado_pix: number
  esperado_debito: number
  esperado_credito: number
  diferenca: number
  observacoes: string | null
  created_at: string
  fechado_por_nome: string | null
}
```

por (união discriminada pelo campo `diferenca`: quando ausente, é a versão
sem os valores agregados):

```ts
type FechamentoBase = {
  id: string
  data: string
  dinheiro_contado: number
  observacoes: string | null
  created_at: string
  fechado_por_nome: string | null
}

export type Fechamento =
  | FechamentoBase
  | (FechamentoBase & {
      esperado_dinheiro: number
      esperado_pix: number
      esperado_debito: number
      esperado_credito: number
      diferenca: number
    })
```

Trocar `listarFechamentos` (linhas 123-138):

```ts
export async function listarFechamentos(limite = 30): Promise<Fechamento[]> {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('caixa_fechamentos')
    .select('id, data, dinheiro_contado, esperado_dinheiro, esperado_pix, esperado_debito, esperado_credito, diferenca, observacoes, created_at, profiles(nome)')
    .eq('local_id', localId)
    .order('data', { ascending: false })
    .limit(limite)
  if (error) throw new Error(error.message)
  type Raw = Omit<Fechamento, 'fechado_por_nome'> & { profiles: { nome: string } | { nome: string }[] | null }
  return ((data ?? []) as unknown as Raw[]).map((f) => {
    const rel = Array.isArray(f.profiles) ? f.profiles[0] : f.profiles
    return { ...f, fechado_por_nome: rel?.nome ?? null }
  })
}
```

por:

```ts
export async function listarFechamentos(limite = 30): Promise<Fechamento[]> {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const cargo = await getCargoUsuario()
  const podeVerEsperado = !cargo || cargo.admin

  const { data, error } = await supabase
    .from('caixa_fechamentos')
    .select('id, data, dinheiro_contado, esperado_dinheiro, esperado_pix, esperado_debito, esperado_credito, diferenca, observacoes, created_at, profiles(nome)')
    .eq('local_id', localId)
    .order('data', { ascending: false })
    .limit(limite)
  if (error) throw new Error(error.message)

  type Raw = {
    id: string
    data: string
    dinheiro_contado: number
    esperado_dinheiro: number
    esperado_pix: number
    esperado_debito: number
    esperado_credito: number
    diferenca: number
    observacoes: string | null
    created_at: string
    profiles: { nome: string } | { nome: string }[] | null
  }
  return ((data ?? []) as unknown as Raw[]).map((f) => {
    const rel = Array.isArray(f.profiles) ? f.profiles[0] : f.profiles
    const base: FechamentoBase = {
      id: f.id,
      data: f.data,
      dinheiro_contado: f.dinheiro_contado,
      observacoes: f.observacoes,
      created_at: f.created_at,
      fechado_por_nome: rel?.nome ?? null,
    }
    if (!podeVerEsperado) return base
    return {
      ...base,
      esperado_dinheiro: f.esperado_dinheiro,
      esperado_pix: f.esperado_pix,
      esperado_debito: f.esperado_debito,
      esperado_credito: f.esperado_credito,
      diferenca: f.diferenca,
    }
  })
}
```

(`fechamentoDeHoje()`, logo abaixo, não muda — só lê `.data` do primeiro
item, que existe nas duas variantes da união.)

- [ ] **Step 2: `lib/actions/caixa.ts` — `fecharCaixa` devolve `comparativo` reduzido pra quem não é admin**

Trocar o final de `fecharCaixa` (linhas 96-107):

```ts
  if (error) return { error: error.message }

  revalidatePath('/caixa')
  return {
    success: true as const,
    comparativo: {
      ...resumo,
      dinheiro_contado: parsed.data.dinheiro_contado,
      diferenca,
    },
  }
}
```

por:

```ts
  if (error) return { error: error.message }

  revalidatePath('/caixa')
  const cargo = await getCargoUsuario()
  const podeVerEsperado = !cargo || cargo.admin
  return {
    success: true as const,
    comparativo: podeVerEsperado
      ? {
          totalVendas: resumo.totalVendas,
          dinheiro_contado: parsed.data.dinheiro_contado,
          dinheiro: resumo.dinheiro,
          pix: resumo.pix,
          debito: resumo.debito,
          credito: resumo.credito,
          diferenca,
        }
      : {
          totalVendas: resumo.totalVendas,
          dinheiro_contado: parsed.data.dinheiro_contado,
        },
  }
}
```

- [ ] **Step 3: `components/caixa/FormFechamento.tsx` — tela de resultado trata as duas formas**

Trocar o type `Comparativo` (linhas 11-19):

```ts
type Comparativo = {
  dinheiro: number
  pix: number
  debito: number
  credito: number
  totalVendas: number
  dinheiro_contado: number
  diferenca: number
}
```

por:

```ts
type Comparativo =
  | { totalVendas: number; dinheiro_contado: number }
  | {
      totalVendas: number
      dinheiro_contado: number
      dinheiro: number
      pix: number
      debito: number
      credito: number
      diferenca: number
    }
```

Trocar o bloco de resultado (linhas 49-95):

```tsx
  if (resultado) {
    const ok = Math.abs(resultado.diferenca) < 0.005
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold text-text">Caixa fechado</h2>
        <p className="mt-0.5 text-xs text-text-muted">
          {resultado.totalVendas} {resultado.totalVendas === 1 ? 'venda paga' : 'vendas pagas'} hoje
        </p>

        <div className="mt-4 divide-y divide-border/60 text-sm">
          <div className="flex items-center justify-between py-2.5">
            <span className="text-text-muted">Dinheiro esperado</span>
            <Money valor={resultado.dinheiro} />
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-text-muted">Dinheiro contado</span>
            <Money valor={resultado.dinheiro_contado} />
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="font-semibold text-text">Diferença</span>
            <span
              className={cn(
                'font-mono text-sm font-bold tabular-nums',
                ok ? 'text-ok' : resultado.diferenca > 0 ? 'text-info' : 'text-err',
              )}
            >
              {resultado.diferenca > 0 ? '+' : ''}
              {formatarReal(resultado.diferenca)}
              {ok ? ' (bateu!)' : resultado.diferenca > 0 ? ' (sobra)' : ' (falta)'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-text-muted">Pix (eletrônico)</span>
            <Money valor={resultado.pix} />
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-text-muted">Cartão débito</span>
            <Money valor={resultado.debito} />
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-text-muted">Cartão crédito</span>
            <Money valor={resultado.credito} />
          </div>
        </div>
      </div>
    )
  }
```

por:

```tsx
  if (resultado) {
    if (!('diferenca' in resultado)) {
      return (
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-text">Caixa fechado</h2>
          <p className="mt-0.5 text-xs text-text-muted">
            {resultado.totalVendas} {resultado.totalVendas === 1 ? 'venda paga' : 'vendas pagas'} hoje
          </p>
          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-sm">
            <span className="text-text-muted">Dinheiro contado</span>
            <Money valor={resultado.dinheiro_contado} />
          </div>
        </div>
      )
    }

    const ok = Math.abs(resultado.diferenca) < 0.005
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold text-text">Caixa fechado</h2>
        <p className="mt-0.5 text-xs text-text-muted">
          {resultado.totalVendas} {resultado.totalVendas === 1 ? 'venda paga' : 'vendas pagas'} hoje
        </p>

        <div className="mt-4 divide-y divide-border/60 text-sm">
          <div className="flex items-center justify-between py-2.5">
            <span className="text-text-muted">Dinheiro esperado</span>
            <Money valor={resultado.dinheiro} />
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-text-muted">Dinheiro contado</span>
            <Money valor={resultado.dinheiro_contado} />
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="font-semibold text-text">Diferença</span>
            <span
              className={cn(
                'font-mono text-sm font-bold tabular-nums',
                ok ? 'text-ok' : resultado.diferenca > 0 ? 'text-info' : 'text-err',
              )}
            >
              {resultado.diferenca > 0 ? '+' : ''}
              {formatarReal(resultado.diferenca)}
              {ok ? ' (bateu!)' : resultado.diferenca > 0 ? ' (sobra)' : ' (falta)'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-text-muted">Pix (eletrônico)</span>
            <Money valor={resultado.pix} />
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-text-muted">Cartão débito</span>
            <Money valor={resultado.debito} />
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-text-muted">Cartão crédito</span>
            <Money valor={resultado.credito} />
          </div>
        </div>
      </div>
    )
  }
```

- [ ] **Step 4: `app/(app)/caixa/page.tsx` — colunas condicionais**

Adicionar o import:

```ts
import { getCargoUsuario } from '@/lib/permissoes'
```

Trocar a função inteira:

```tsx
export default async function CaixaPage() {
  const [fechamentos, deHoje] = await Promise.all([
    listarFechamentos(30),
    fechamentoDeHoje(),
  ])

  return (
    <div className="mx-auto max-w-3xl px-6 py-5">
      <PageHeader
        titulo="Caixa"
        subtitulo="Fechamento diário: conte a gaveta e confira com o que o sistema esperava."
      />

      <FormFechamento jaFechouHoje={!!deHoje} />

      <h2 className="mb-3 mt-8 text-sm font-semibold text-text">Fechamentos anteriores</h2>
      {fechamentos.length === 0 ? (
        <EstadoVazio
          icone={Landmark}
          titulo="Nenhum fechamento ainda"
          descricao="O primeiro fechamento de caixa aparece aqui."
        />
      ) : (
        <Tabela minWidth={560}>
          <TabelaHead>
            <tr>
              <TabelaHeadCell>Data</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita">Esperado</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita">Contado</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita">Diferença</TabelaHeadCell>
              <TabelaHeadCell>Por</TabelaHeadCell>
            </tr>
          </TabelaHead>
          <TabelaBody>
            {fechamentos.map((f) => {
              const ok = Math.abs(f.diferenca) < 0.005
              return (
                <TabelaRow key={f.id}>
                  <TabelaCell mono className="text-text-muted">
                    {formatarData(f.data)}
                  </TabelaCell>
                  <TabelaCell alinhar="direita">
                    <Money valor={f.esperado_dinheiro} />
                  </TabelaCell>
                  <TabelaCell alinhar="direita">
                    <Money valor={f.dinheiro_contado} />
                  </TabelaCell>
                  <TabelaCell alinhar="direita">
                    <span
                      className={cn(
                        'font-mono text-sm font-semibold tabular-nums',
                        ok ? 'text-ok' : f.diferenca > 0 ? 'text-info' : 'text-err',
                      )}
                    >
                      {f.diferenca > 0 ? '+' : ''}
                      {formatarReal(f.diferenca)}
                    </span>
                  </TabelaCell>
                  <TabelaCell className="text-text-muted">
                    {f.fechado_por_nome ?? '-'}
                  </TabelaCell>
                </TabelaRow>
              )
            })}
          </TabelaBody>
        </Tabela>
      )}
    </div>
  )
}
```

por:

```tsx
export default async function CaixaPage() {
  const [fechamentos, deHoje, cargo] = await Promise.all([
    listarFechamentos(30),
    fechamentoDeHoje(),
    getCargoUsuario(),
  ])
  const podeVerEsperado = !cargo || cargo.admin

  return (
    <div className="mx-auto max-w-3xl px-6 py-5">
      <PageHeader
        titulo="Caixa"
        subtitulo="Fechamento diário: conte a gaveta e confira com o que o sistema esperava."
      />

      <FormFechamento jaFechouHoje={!!deHoje} />

      <h2 className="mb-3 mt-8 text-sm font-semibold text-text">Fechamentos anteriores</h2>
      {fechamentos.length === 0 ? (
        <EstadoVazio
          icone={Landmark}
          titulo="Nenhum fechamento ainda"
          descricao="O primeiro fechamento de caixa aparece aqui."
        />
      ) : (
        <Tabela minWidth={podeVerEsperado ? 560 : 360}>
          <TabelaHead>
            <tr>
              <TabelaHeadCell>Data</TabelaHeadCell>
              {podeVerEsperado && <TabelaHeadCell alinhar="direita">Esperado</TabelaHeadCell>}
              <TabelaHeadCell alinhar="direita">Contado</TabelaHeadCell>
              {podeVerEsperado && <TabelaHeadCell alinhar="direita">Diferença</TabelaHeadCell>}
              <TabelaHeadCell>Por</TabelaHeadCell>
            </tr>
          </TabelaHead>
          <TabelaBody>
            {fechamentos.map((f) => {
              const temEsperado = 'diferenca' in f
              const ok = temEsperado && Math.abs(f.diferenca) < 0.005
              return (
                <TabelaRow key={f.id}>
                  <TabelaCell mono className="text-text-muted">
                    {formatarData(f.data)}
                  </TabelaCell>
                  {podeVerEsperado && temEsperado && (
                    <TabelaCell alinhar="direita">
                      <Money valor={f.esperado_dinheiro} />
                    </TabelaCell>
                  )}
                  <TabelaCell alinhar="direita">
                    <Money valor={f.dinheiro_contado} />
                  </TabelaCell>
                  {podeVerEsperado && temEsperado && (
                    <TabelaCell alinhar="direita">
                      <span
                        className={cn(
                          'font-mono text-sm font-semibold tabular-nums',
                          ok ? 'text-ok' : f.diferenca > 0 ? 'text-info' : 'text-err',
                        )}
                      >
                        {f.diferenca > 0 ? '+' : ''}
                        {formatarReal(f.diferenca)}
                      </span>
                    </TabelaCell>
                  )}
                  <TabelaCell className="text-text-muted">
                    {f.fechado_por_nome ?? '-'}
                  </TabelaCell>
                </TabelaRow>
              )
            })}
          </TabelaBody>
        </Tabela>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Verificar**

```bash
npx tsc --noEmit
npx eslint lib/actions/caixa.ts components/caixa/FormFechamento.tsx "app/(app)/caixa/page.tsx" --quiet
npx next build
```

Expected: sem erros. Teste manual como admin: fechar o caixa de hoje (ou
conferir um fechamento já existente) e confirmar que a tela e a tabela
continuam mostrando Esperado/Diferença normalmente — regressão zero pra
quem é admin. Teste como Funcionario fica pra Task 4.

- [ ] **Step 6: Commit e push**

```bash
git add lib/actions/caixa.ts components/caixa/FormFechamento.tsx "app/(app)/caixa/page.tsx"
git commit -m "feat: esconde esperado/diferenca do caixa de quem nao e admin"
git push
```

---

### Task 4: Verificação cruzada com os 3 cargos + push final

**Files:** nenhum arquivo novo — só teste manual e, se faltar, criação de
conta de teste.

- [ ] **Step 1: Confirmar/criar conta de teste Funcionario**

```bash
node -e "require('dotenv').config({path:'.env.local'}); const {Pool}=require('pg'); const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); pool.query(\"select p.id, p.nome, c.nome as cargo from profiles p join cargos c on c.id = p.cargo_id where c.nome = 'Funcionario'\").then(r=>{console.log(JSON.stringify(r.rows,null,2));pool.end()}).catch(e=>{console.error(e.message);pool.end()})"
```

Se a lista vier vazia: logar como admin (`sallesjoaquim111009@gmail.com` /
`Deposito2026!`, ver `CLAUDE.md`), ir em Equipe → gerar convite com cargo
Funcionario, abrir o link de convite numa aba anônima e criar a conta de
teste (email descartável tipo `teste.funcionario+depsys@gmail.com`).
Anotar a senha usada — vai ser reusada nos próximos steps.

- [ ] **Step 2: Logado como Funcionario, checar `/dashboard`**

Checklist manual no browser:
- Não aparecem os cards Vendas hoje, Receita do mês, Ticket médio do dia,
  Lucro do mês, Cliente destaque.
- Não aparece o gráfico "Vendas" nem "Total do mês".
- Não aparece a barra de meta do mês (mesmo se houver meta cadastrada —
  conferir logado como admin antes/depois pra comparar).
- Não aparece o banner de fiado vencido/vencendo (mesmo se houver fiado
  vencido — conferir como admin).
- Aparecem normalmente: alerta de estoque crítico (se houver), banner de
  pedidos em andamento (se houver), card "Acesso rápido" sem o atalho
  "Formas de pagamento", lista de pedidos recentes com o valor de cada
  pedido.

- [ ] **Step 3: Logado como Funcionario, checar `/caixa`**

- Consegue lançar o fechamento do dia (ou ver o aviso "já fechou hoje" se
  já tiver fechado).
- A tela de confirmação pós-fechamento mostra só "Dinheiro contado" e a
  contagem de vendas pagas — sem "Dinheiro esperado"/"Diferença"/Pix/
  Débito/Crédito.
- A tabela de histórico mostra só as colunas Data/Contado/Por — sem
  Esperado/Diferença.

- [ ] **Step 4: Logado como Funcionario, registrar uma venda**

- Venda à vista simples em `/movimentacoes/nova?tipo=saida` — confirma que
  registra normal e mostra o total pra cobrar o cliente.
- Venda fiado (com um cliente de teste) — confirma que continua criando a
  linha em `contas_receber` sem erro de RLS (esse é o ponto que a Task 1
  poderia ter quebrado se `contas_receber` tivesse sido travada por
  engano — não deve estar travada).
- Limpar as vendas de teste do banco depois (estoque restaurado, pedido e
  `contas_receber` apagados), mesmo processo que os planos anteriores já
  usam.

- [ ] **Step 5: Logado como Funcionario, tentar chamar a RPC direto pelo console do browser**

Com a sessão do Funcionario ativa em `/dashboard`, abrir o Console do
DevTools e chamar a RPC direto via `fetch`, usando a `anon key` do
`.env.local` (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) e o id do local ativo
(visível em `local_ativo` nos cookies, ou pego de
`select id from locais` como admin):

```js
fetch('https://jqdezlvqumzdkvvcbjtl.supabase.co/rest/v1/rpc/calcular_dre', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', apikey: '<anon key do .env.local>' },
  credentials: 'include',
  body: JSON.stringify({ p_local_id: '<id do local>', p_mes: '2026-07-01' }),
}).then(r => r.json()).then(console.log)
```

Expected: `null` (não o JSON com `receita_bruta`/`lucro`/etc.).

- [ ] **Step 6: Logado como Administrador, regressão completa**

- `/dashboard`: todos os cards, gráfico, meta e banner de fiado continuam
  aparecendo, com os mesmos valores de antes das mudanças.
- `/caixa`: fechamento e histórico continuam com Esperado/Diferença.
- `/financeiro/a-pagar`: continua acessível, lista/cria conta a pagar
  normalmente.
- `/financeiro/resultado` (DRE): continua mostrando os números certos.

- [ ] **Step 7: Logado como Entregador, regressão**

- `/dashboard` mostra `TelaEntregador` normalmente, com o valor de cada
  entrega designada a ele (sem mudança nenhuma nessa parte).

- [ ] **Step 8: Lint/build final e push**

```bash
npx tsc --noEmit
npx eslint . --quiet
npx next build
git status
git push
```

Expected: working tree limpo (tudo já commitado nas tasks anteriores),
`git push` sem pendência (ou confirma que já estava tudo pushado desde a
Task 3).
