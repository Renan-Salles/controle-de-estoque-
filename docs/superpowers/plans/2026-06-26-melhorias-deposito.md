# Melhorias R$ DEPÓSITO — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar a navegação em seções colapsáveis, entregar 3 relatórios de vendas com PDF vetorial, e tornar o sistema usável no celular (cards + PWA).

**Architecture:** Três fases independentes e entregáveis. (1) Porta a lógica de sanfona já existente no Sidebar do NTB para o `nav-items.tsx` compartilhado do depósito. (2) Relatórios via RPC Postgres por período + PDF gerado no servidor com `@react-pdf/renderer` (rota que devolve `application/pdf`). (3) Cada tabela ganha versão em card no celular dirigida por descritor de campos + manifest PWA.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, Supabase (PostgREST + RPC), Tailwind v4, `@react-pdf/renderer`, lucide-react.

## Global Constraints

- Verificação: o projeto **não tem suite de testes** (só `npm run build` e `npm run lint`). Cada task verifica com `npx tsc --noEmit` + `npm run lint` + conferência visual da tela rodando (`npm run dev`). SQL/RPC verifica rodando a função no Supabase.
- Custo zero: só dependências open source que rodam no próprio projeto. Nova dependência permitida: `@react-pdf/renderer`.
- Português correto com acentos em todo texto de UI, comentário e PDF.
- Nunca usar travessão (—) em copy de UI.
- Multi-local: toda query de dado filtra por `getLocalAtivoId()`. Relatórios filtram `status = 'concluida'` (ignoram canceladas).
- Navegação é fonte única em `components/shell/nav-items.tsx`, consumida por `Sidebar.tsx` (desktop) e `MobileNav.tsx` (drawer). Não duplicar.
- Tabelas existentes (`components/ui-kit/tabela`) ficam intocadas no desktop; mobile é aditivo (`hidden lg:block` / `block lg:hidden`).

---

## FASE 1 — Sidebar com seções colapsáveis

### Task 1: Accordion na navegação compartilhada

**Files:**
- Modify: `components/shell/nav-items.tsx` (reescreve `GRUPOS`, adiciona hook + componente de grupo colapsável, ajusta `NavConteudo`)
- Reference (NÃO modificar): `components/shell/shell/Sidebar.tsx` (padrão de sanfona do NTB — fonte da lógica)

**Interfaces:**
- Consumes: `usePathname` (next), `lucide-react` ícones, `cn` de `@/lib/utils`.
- Produces:
  - `type Grupo = { titulo: string; icone: LucideIcon; itens: Item[] }`
  - `ITENS_TOPO: Item[]` (Dashboard) renderizado solto acima dos grupos
  - `GRUPOS: Grupo[]` (Vendas, Estoque, Financeiro, Relatórios)
  - `function useSecoesAbertas(pathname: string): { aberta: (titulo: string) => boolean; alternar: (titulo: string) => void }`
  - `<GrupoColapsavel grupo aberto onToggle pathname onNavegar />`
  - `NavConteudo` continua com a mesma assinatura `{ pathname: string; onNavegar?: () => void }` — Sidebar e MobileNav não mudam.

**Nova estrutura de navegação (valores exatos):**
- Botão destacado topo: `Nova Movimentação` → `/movimentacoes/nova` (já existe, mantém)
- `ITENS_TOPO`: `Dashboard` → `/dashboard`
- `GRUPOS`:
  - **Vendas** (icone `ShoppingCart`): Pedidos `/pedidos`, Clientes `/clientes`, Movimentações `/movimentacoes`
  - **Estoque** (icone `Boxes`): Posição `/estoque`, Reposição `/estoque/reposicao`, Produtos `/produtos`, Fornecedores `/fornecedores`
  - **Financeiro** (icone `DollarSign`): Resultado `/financeiro/resultado`, A receber `/financeiro/a-receber`, A pagar `/financeiro/a-pagar`, Formas de pagamento `/financeiro/formas-pagamento`
  - **Relatórios** (icone `BarChart3`): Vendas por período `/relatorios`, Por produto `/relatorios/produto`, Por cliente `/relatorios/cliente`
- Rodapé: `Configurações` → `/configuracoes` (já existe, mantém)

- [ ] **Step 1: Reescrever `nav-items.tsx`**

Substituir o bloco de imports + `GRUPOS` + `NavConteudo`. Manter `LinkItem`, `NovaMovimentacaoLink`, `rotaAtiva`, `logoPartes`, `ITEM_NOVA_MOVIMENTACAO`, `ITEM_CONFIGURACOES` como estão. Conteúdo novo:

```tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  LayoutDashboard,
  Plus,
  ArrowRightLeft,
  Package,
  Users,
  Truck,
  Boxes,
  DollarSign,
  BarChart3,
  Settings,
  ShoppingCart,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Fonte única de navegação. Consumida pela Sidebar (desktop) e pelo MobileNav
// (drawer no celular) para garantir paridade de telas em todos os breakpoints.

export type Item = { href: string; label: string; icon: LucideIcon }
export type Grupo = { titulo: string; icone: LucideIcon; itens: Item[] }

// Itens soltos no topo (sem grupo colapsável).
export const ITENS_TOPO: Item[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
]

export const GRUPOS: Grupo[] = [
  {
    titulo: 'Vendas',
    icone: ShoppingCart,
    itens: [
      { href: '/pedidos', label: 'Pedidos', icon: Package },
      { href: '/clientes', label: 'Clientes', icon: Users },
      { href: '/movimentacoes', label: 'Movimentações', icon: ArrowRightLeft },
    ],
  },
  {
    titulo: 'Estoque',
    icone: Boxes,
    itens: [
      { href: '/estoque', label: 'Posição', icon: Boxes },
      { href: '/estoque/reposicao', label: 'Reposição', icon: ShoppingCart },
      { href: '/produtos', label: 'Produtos', icon: Package },
      { href: '/fornecedores', label: 'Fornecedores', icon: Truck },
    ],
  },
  {
    titulo: 'Financeiro',
    icone: DollarSign,
    itens: [
      { href: '/financeiro/resultado', label: 'Resultado', icon: BarChart3 },
      { href: '/financeiro/a-receber', label: 'A receber', icon: DollarSign },
      { href: '/financeiro/a-pagar', label: 'A pagar', icon: DollarSign },
      { href: '/financeiro/formas-pagamento', label: 'Formas de pagamento', icon: DollarSign },
    ],
  },
  {
    titulo: 'Relatórios',
    icone: BarChart3,
    itens: [
      { href: '/relatorios', label: 'Vendas por período', icon: BarChart3 },
      { href: '/relatorios/produto', label: 'Por produto', icon: Package },
      { href: '/relatorios/cliente', label: 'Por cliente', icon: Users },
    ],
  },
]

export const ITEM_NOVA_MOVIMENTACAO: Item = {
  href: '/movimentacoes/nova',
  label: 'Nova Movimentação',
  icon: Plus,
}

export const ITEM_CONFIGURACOES: Item = {
  href: '/configuracoes',
  label: 'Configurações',
  icon: Settings,
}

const LS_SECOES = 'deposito.sidebar.secoesAbertas'

function lerLS<T>(chave: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const v = window.localStorage.getItem(chave)
    return v === null ? fallback : (JSON.parse(v) as T)
  } catch {
    return fallback
  }
}

function gravarLS(chave: string, valor: unknown) {
  try {
    window.localStorage.setItem(chave, JSON.stringify(valor))
  } catch {
    /* localStorage indisponível (modo privado): degrada sem quebrar. */
  }
}

// Marca uma rota como ativa. Para "/movimentacoes", evita ativar quando estamos
// em "/movimentacoes/nova" (que tem item próprio destacado).
export function rotaAtiva(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  if (href === '/estoque') return pathname === '/estoque'
  if (href === '/relatorios') return pathname === '/relatorios'
  if (href === '/movimentacoes')
    return pathname === '/movimentacoes' || /^\/movimentacoes\/(?!nova)/.test(pathname)
  return pathname === href || pathname.startsWith(href + '/')
}

// Qual grupo contém a rota atual.
function grupoDaRota(pathname: string): string | null {
  for (const g of GRUPOS) {
    if (g.itens.some((i) => rotaAtiva(pathname, i.href))) return g.titulo
  }
  return null
}

// Estado das seções abertas (múltiplas), persistido em localStorage. A seção da
// rota atual fica sempre aberta. Inicializa estável no SSR e reidrata após montar.
export function useSecoesAbertas(pathname: string) {
  const daRota = grupoDaRota(pathname)
  const [abertas, setAbertas] = useState<string[]>(() => (daRota ? [daRota] : []))

  useEffect(() => {
    const salvas = lerLS<string[]>(LS_SECOES, daRota ? [daRota] : [GRUPOS[0].titulo])
    const comRota = daRota && !salvas.includes(daRota) ? [...salvas, daRota] : salvas
    setAbertas(comRota)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Ao navegar, garante que a seção da rota atual esteja aberta.
  useEffect(() => {
    if (!daRota) return
    setAbertas((atual) => (atual.includes(daRota) ? atual : [...atual, daRota]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daRota])

  function alternar(titulo: string) {
    setAbertas((atual) => {
      const proximo = atual.includes(titulo)
        ? atual.filter((t) => t !== titulo)
        : [...atual, titulo]
      gravarLS(LS_SECOES, proximo)
      return proximo
    })
  }

  return { aberta: (titulo: string) => abertas.includes(titulo), alternar }
}

export function logoPartes(nome: string) {
  if (nome.toUpperCase().startsWith('R$')) {
    return { selo: 'R$', texto: nome.replace(/^R\$\s*/i, '') }
  }
  const iniciais = nome
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return { selo: iniciais, texto: nome }
}

export function LinkItem({
  item,
  ativo,
  onNavegar,
}: {
  item: Item
  ativo: boolean
  onNavegar?: () => void
}) {
  const Icone = item.icon
  return (
    <Link
      href={item.href}
      aria-current={ativo ? 'page' : undefined}
      onClick={onNavegar}
      className={cn(
        'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm u-motion u-press-sm',
        ativo
          ? 'bg-brand/12 font-medium text-text'
          : 'text-text-muted hover:bg-surface-2 hover:text-text',
      )}
    >
      {ativo && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-brand" />
      )}
      <Icone
        className={cn('size-[18px] shrink-0', ativo ? 'text-brand' : '')}
        strokeWidth={1.5}
      />
      <span className="truncate">{item.label}</span>
    </Link>
  )
}

export function NovaMovimentacaoLink({
  ativo,
  onNavegar,
}: {
  ativo: boolean
  onNavegar?: () => void
}) {
  const Icone = ITEM_NOVA_MOVIMENTACAO.icon
  return (
    <Link
      href={ITEM_NOVA_MOVIMENTACAO.href}
      aria-current={ativo ? 'page' : undefined}
      onClick={onNavegar}
      className={cn(
        'mb-4 flex items-center gap-2.5 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white u-motion u-press shadow-sm hover:bg-brand-strong',
        ativo && 'bg-brand-strong',
      )}
    >
      <Icone className="size-[18px]" strokeWidth={1.5} />
      {ITEM_NOVA_MOVIMENTACAO.label}
    </Link>
  )
}

// Seção colapsável: header clicável + lista que anima a altura via
// grid-template-rows 0fr->1fr (barato, sem medir o DOM). Mostra um ponto quando
// está fechada mas contém a rota ativa.
function GrupoColapsavel({
  grupo,
  aberto,
  onToggle,
  pathname,
  onNavegar,
}: {
  grupo: Grupo
  aberto: boolean
  onToggle: () => void
  pathname: string
  onNavegar?: () => void
}) {
  const Icone = grupo.icone
  const temAtivoFechado =
    !aberto && grupo.itens.some((i) => rotaAtiva(pathname, i.href))
  return (
    <div className="mb-1.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={aberto}
        className="group flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-text-muted u-motion u-press-sm hover:bg-surface-2 hover:text-text"
      >
        <Icone className="size-[18px] shrink-0" strokeWidth={1.5} />
        <span className="flex-1 text-left font-medium">{grupo.titulo}</span>
        {temAtivoFechado && (
          <span className="size-1.5 rounded-full bg-brand" aria-hidden />
        )}
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-text-muted/60 transition-transform duration-200',
            aberto ? 'rotate-0' : '-rotate-90',
          )}
          strokeWidth={1.75}
        />
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-in-out"
        style={{ gridTemplateRows: aberto ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="space-y-0.5 pb-1 pl-3 pt-0.5">
            {grupo.itens.map((item) => (
              <LinkItem
                key={item.href}
                item={item}
                ativo={rotaAtiva(pathname, item.href)}
                onNavegar={onNavegar}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function NavConteudo({
  pathname,
  onNavegar,
}: {
  pathname: string
  onNavegar?: () => void
}) {
  const novoAtivo = pathname === ITEM_NOVA_MOVIMENTACAO.href
  const { aberta, alternar } = useSecoesAbertas(pathname)
  return (
    <>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <NovaMovimentacaoLink ativo={novoAtivo} onNavegar={onNavegar} />

        <div className="mb-3 space-y-0.5">
          {ITENS_TOPO.map((item) => (
            <LinkItem
              key={item.href}
              item={item}
              ativo={rotaAtiva(pathname, item.href)}
              onNavegar={onNavegar}
            />
          ))}
        </div>

        {GRUPOS.map((grupo) => (
          <GrupoColapsavel
            key={grupo.titulo}
            grupo={grupo}
            aberto={aberta(grupo.titulo)}
            onToggle={() => alternar(grupo.titulo)}
            pathname={pathname}
            onNavegar={onNavegar}
          />
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <LinkItem
          item={ITEM_CONFIGURACOES}
          ativo={rotaAtiva(pathname, ITEM_CONFIGURACOES.href)}
          onNavegar={onNavegar}
        />
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verificar typecheck e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros. (Se `tsc` reclamar de algum import não usado removido, ajustar imports.)

- [ ] **Step 3: Verificar visualmente no browser**

Run: `npm run dev` e abrir `http://localhost:3000/dashboard`.
Expected: sidebar mostra `Nova Movimentação` + `Dashboard` soltos no topo; abaixo as 4 seções (Vendas, Estoque, Financeiro, Relatórios) com chevron. Clicar num header abre/fecha com animação. Navegar para `/produtos` mantém a seção Estoque aberta e marca "Produtos" como ativo. Recarregar a página preserva quais seções estavam abertas. Conferir também no drawer mobile (reduzir a janela < 1024px, abrir o menu hambúrguer).

- [ ] **Step 4: Commit**

Projeto não é git. Pular commit. Registrar conclusão marcando os checkboxes desta task.

---

## FASE 2 — Relatórios de vendas + PDF

### Task 2: RPCs de agregação + índices (Supabase)

**Files:**
- Create: `supabase/migrations/2026-06-26-relatorios.sql` (registro do SQL aplicado; aplicar via painel/CLI do Supabase)

**Interfaces:**
- Produces (chamáveis via `supabase.rpc(...)`):
  - `vendas_por_produto(p_local uuid, p_ini date, p_fim date)` → linhas `{ produto_id uuid, nome text, unidades numeric, faturamento numeric }`
  - `vendas_por_cliente(p_local uuid, p_ini date, p_fim date)` → linhas `{ cliente_id uuid, nome text, pedidos bigint, total numeric }`

- [ ] **Step 1: Escrever o SQL**

Conteúdo de `supabase/migrations/2026-06-26-relatorios.sql`:

```sql
-- Índices para os relatórios de período não varrerem a tabela inteira.
create index if not exists idx_pedidos_local_data_status
  on pedidos (local_id, data_pedido, status);
create index if not exists idx_pedido_itens_pedido on pedido_itens (pedido_id);
create index if not exists idx_pedido_itens_produto on pedido_itens (produto_id);

-- Vendas por produto no período (só pedidos concluídos do local).
create or replace function vendas_por_produto(p_local uuid, p_ini date, p_fim date)
returns table (produto_id uuid, nome text, unidades numeric, faturamento numeric)
language sql stable as $$
  select pr.id, pr.nome,
         sum(pi.quantidade_pedida)::numeric as unidades,
         sum(pi.total)::numeric as faturamento
  from pedido_itens pi
  join pedidos p on p.id = pi.pedido_id
  join produtos pr on pr.id = pi.produto_id
  where p.local_id = p_local
    and p.status = 'concluida'
    and p.data_pedido between p_ini and p_fim
  group by pr.id, pr.nome
  order by faturamento desc;
$$;

-- Vendas por cliente no período. Cliente nulo (balcão) cai como "Não identificado".
create or replace function vendas_por_cliente(p_local uuid, p_ini date, p_fim date)
returns table (cliente_id uuid, nome text, pedidos bigint, total numeric)
language sql stable as $$
  select c.id,
         coalesce(c.nome, 'Não identificado') as nome,
         count(p.id) as pedidos,
         sum(p.total)::numeric as total
  from pedidos p
  left join clientes c on c.id = p.cliente_id
  where p.local_id = p_local
    and p.status = 'concluida'
    and p.data_pedido between p_ini and p_fim
  group by c.id, c.nome
  order by total desc;
$$;

grant execute on function vendas_por_produto(uuid, date, date) to authenticated;
grant execute on function vendas_por_cliente(uuid, date, date) to authenticated;
```

- [ ] **Step 2: Aplicar no Supabase**

Aplicar o SQL no banco (painel SQL Editor do Supabase ou CLI). Confirmar que rodou sem erro.

- [ ] **Step 3: Verificar as funções com dados reais**

No SQL Editor, rodar (substituir o uuid pelo local "deposito" `af1b8927-7235-4e25-9473-9691005388b6`):

```sql
select * from vendas_por_produto('af1b8927-7235-4e25-9473-9691005388b6', '2026-01-01', '2026-12-31');
select * from vendas_por_cliente('af1b8927-7235-4e25-9473-9691005388b6', '2026-01-01', '2026-12-31');
```

Expected: retorna linhas agregadas (faturamento desc), sem erro de coluna. Conferir que os totais batem com vendas conhecidas.

- [ ] **Step 4: Regenerar tipos (se o projeto usa tipos gerados)**

Se `types/database.types.ts` é gerado pelo Supabase, regenerar para incluir as funções. Caso contrário, os `rpc` serão tipados manualmente na Task 3. Marcar checkbox.

### Task 3: Server actions dos relatórios

**Files:**
- Create: `lib/actions/relatorios.ts`

**Interfaces:**
- Consumes: `createClient` de `@/lib/supabase/server`, `getLocalAtivoId` de `@/lib/local`.
- Produces:
  - `type Periodo = { ini: string; fim: string }` (datas `YYYY-MM-DD`)
  - `relatorioVendasPeriodo(p: Periodo)` → `{ totalReceita: number; totalPedidos: number; ticketMedio: number; dias: Array<{ data: string; pedidos: number; receita: number }> }`
  - `relatorioVendasProduto(p: Periodo)` → `Array<{ produto_id: string; nome: string; unidades: number; faturamento: number }>`
  - `relatorioVendasCliente(p: Periodo)` → `Array<{ cliente_id: string | null; nome: string; pedidos: number; total: number }>`

- [ ] **Step 1: Escrever `lib/actions/relatorios.ts`**

```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { getLocalAtivoId } from '@/lib/local'

export type Periodo = { ini: string; fim: string }

// Vendas por período: agrega pedidos concluídos por dia. Query direta (sem RPC).
export async function relatorioVendasPeriodo(p: Periodo) {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select('data_pedido, total')
    .eq('local_id', localId)
    .eq('status', 'concluida')
    .gte('data_pedido', p.ini)
    .lte('data_pedido', p.fim)
    .order('data_pedido')
  if (error) throw error

  const linhas = (data ?? []) as { data_pedido: string; total: number }[]
  const mapa = new Map<string, { pedidos: number; receita: number }>()
  for (const l of linhas) {
    const dia = l.data_pedido
    const acc = mapa.get(dia) ?? { pedidos: 0, receita: 0 }
    acc.pedidos += 1
    acc.receita += Number(l.total ?? 0)
    mapa.set(dia, acc)
  }
  const dias = [...mapa.entries()]
    .map(([data, v]) => ({ data, ...v }))
    .sort((a, b) => a.data.localeCompare(b.data))
  const totalReceita = dias.reduce((s, d) => s + d.receita, 0)
  const totalPedidos = dias.reduce((s, d) => s + d.pedidos, 0)
  const ticketMedio = totalPedidos > 0 ? totalReceita / totalPedidos : 0
  return { totalReceita, totalPedidos, ticketMedio, dias }
}

export async function relatorioVendasProduto(p: Periodo) {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('vendas_por_produto', {
    p_local: localId,
    p_ini: p.ini,
    p_fim: p.fim,
  })
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    produto_id: r.produto_id as string,
    nome: r.nome as string,
    unidades: Number(r.unidades ?? 0),
    faturamento: Number(r.faturamento ?? 0),
  }))
}

export async function relatorioVendasCliente(p: Periodo) {
  const localId = await getLocalAtivoId()
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('vendas_por_cliente', {
    p_local: localId,
    p_ini: p.ini,
    p_fim: p.fim,
  })
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    cliente_id: (r.cliente_id ?? null) as string | null,
    nome: r.nome as string,
    pedidos: Number(r.pedidos ?? 0),
    total: Number(r.total ?? 0),
  }))
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 3: Verificar via página temporária ou log**

Chamar `relatorioVendasPeriodo({ ini: '2026-01-01', fim: '2026-12-31' })` de um server component de teste (ou aguardar a Task 5 que monta as telas). Conferir que retorna `totalReceita`/`dias` coerentes. Marcar checkbox.

### Task 4: PDF vetorial no servidor

**Files:**
- Modify: `package.json` (adiciona `@react-pdf/renderer`)
- Create: `components/relatorios/RelatorioDocumento.tsx` (documento react-pdf, genérico de tabela)
- Create: `app/relatorios/[tipo]/pdf/route.ts` (route handler que devolve `application/pdf`)

**Interfaces:**
- Consumes: as três server actions da Task 3, `getLocalAtivo` de `@/lib/local`.
- Produces:
  - `type ColunaPdf = { titulo: string; chave: string; alinhar?: 'esquerda' | 'direita' }`
  - `<RelatorioDocumento titulo subtitulo local colunas linhas rodape />` (componente `Document` do react-pdf)
  - rota `GET /relatorios/:tipo/pdf?ini&fim&cliente` → PDF.

- [ ] **Step 1: Instalar a dependência**

Run: `npm install @react-pdf/renderer`
Expected: instala sem erro de peer dependency com React 19. (Se houver conflito, usar `npm install @react-pdf/renderer --legacy-peer-deps` e anotar.)

- [ ] **Step 2: Escrever `components/relatorios/RelatorioDocumento.tsx`**

```tsx
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer'

export type ColunaPdf = {
  titulo: string
  chave: string
  alinhar?: 'esquerda' | 'direita'
}

const s = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: 'Helvetica', color: '#111' },
  cabecalho: { marginBottom: 16, borderBottom: '1pt solid #111', paddingBottom: 8 },
  local: { fontSize: 14, fontWeight: 'bold' },
  cnpj: { fontSize: 8, color: '#555', marginTop: 2 },
  titulo: { fontSize: 11, fontWeight: 'bold', marginTop: 8 },
  subtitulo: { fontSize: 9, color: '#555', marginTop: 2 },
  thead: { flexDirection: 'row', borderBottom: '1pt solid #111', paddingBottom: 4, marginBottom: 2 },
  th: { fontWeight: 'bold', fontSize: 8 },
  tr: { flexDirection: 'row', paddingVertical: 3, borderBottom: '0.5pt solid #ddd' },
  td: { fontSize: 9 },
  rodape: { position: 'absolute', bottom: 20, left: 32, right: 32, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: '#777', borderTop: '0.5pt solid #ddd', paddingTop: 4 },
})

function larguraCol(n: number, alinhar?: 'esquerda' | 'direita') {
  // Primeira coluna é o "nome" (mais larga); demais dividem o resto à direita.
  return { width: `${100 / n}%`, textAlign: alinhar === 'direita' ? 'right' as const : 'left' as const }
}

export function RelatorioDocumento({
  titulo,
  subtitulo,
  local,
  colunas,
  linhas,
  rodape,
}: {
  titulo: string
  subtitulo: string
  local: string
  colunas: ColunaPdf[]
  linhas: Array<Record<string, string>>
  rodape: string
}) {
  const n = colunas.length
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.cabecalho} fixed>
          <Text style={s.local}>{local.toUpperCase()}</Text>
          <Text style={s.cnpj}>CNPJ: 26.139.271/0001-16  ·  DEPÓSITO DE BEBIDAS</Text>
          <Text style={s.titulo}>{titulo}</Text>
          <Text style={s.subtitulo}>{subtitulo}</Text>
        </View>

        <View style={s.thead} fixed>
          {colunas.map((c) => (
            <Text key={c.chave} style={[s.th, larguraCol(n, c.alinhar)]}>
              {c.titulo}
            </Text>
          ))}
        </View>

        {linhas.map((linha, i) => (
          <View key={i} style={s.tr} wrap={false}>
            {colunas.map((c) => (
              <Text key={c.chave} style={[s.td, larguraCol(n, c.alinhar)]}>
                {linha[c.chave] ?? ''}
              </Text>
            ))}
          </View>
        ))}

        <View style={s.rodape} fixed>
          <Text>{rodape}</Text>
          <Text render={({ pageNumber, totalPages }) => `Pág. ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 3: Escrever `app/relatorios/[tipo]/pdf/route.ts`**

```ts
import { NextRequest } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { RelatorioDocumento, type ColunaPdf } from '@/components/relatorios/RelatorioDocumento'
import {
  relatorioVendasPeriodo,
  relatorioVendasProduto,
  relatorioVendasCliente,
} from '@/lib/actions/relatorios'
import { getLocalAtivo } from '@/lib/local'
import { formatarReal } from '@/lib/formatos'

export const runtime = 'nodejs'

function br(data: string) {
  const [a, m, d] = data.split('-')
  return `${d}/${m}/${a}`
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ tipo: string }> },
) {
  const { tipo } = await ctx.params
  const sp = req.nextUrl.searchParams
  const ini = sp.get('ini') ?? ''
  const fim = sp.get('fim') ?? ''
  if (!ini || !fim) return new Response('Período obrigatório', { status: 400 })

  const local = await getLocalAtivo()
  const periodoLabel = `Período: ${br(ini)} a ${br(fim)}`
  const rodape = `Emitido em ${new Date().toLocaleDateString('pt-BR')}`

  let titulo = ''
  let colunas: ColunaPdf[] = []
  let linhas: Array<Record<string, string>> = []

  if (tipo === 'periodo') {
    const r = await relatorioVendasPeriodo({ ini, fim })
    titulo = 'Vendas por período'
    colunas = [
      { titulo: 'Data', chave: 'data' },
      { titulo: 'Pedidos', chave: 'pedidos', alinhar: 'direita' },
      { titulo: 'Receita', chave: 'receita', alinhar: 'direita' },
    ]
    linhas = r.dias.map((d) => ({
      data: br(d.data),
      pedidos: String(d.pedidos),
      receita: formatarReal(d.receita),
    }))
    linhas.push({
      data: 'TOTAL',
      pedidos: String(r.totalPedidos),
      receita: formatarReal(r.totalReceita),
    })
  } else if (tipo === 'produto') {
    const r = await relatorioVendasProduto({ ini, fim })
    titulo = 'Vendas por produto'
    colunas = [
      { titulo: 'Produto', chave: 'nome' },
      { titulo: 'Unidades', chave: 'unidades', alinhar: 'direita' },
      { titulo: 'Faturamento', chave: 'faturamento', alinhar: 'direita' },
    ]
    linhas = r.map((p) => ({
      nome: p.nome,
      unidades: String(p.unidades),
      faturamento: formatarReal(p.faturamento),
    }))
  } else if (tipo === 'cliente') {
    const r = await relatorioVendasCliente({ ini, fim })
    titulo = 'Vendas por cliente'
    colunas = [
      { titulo: 'Cliente', chave: 'nome' },
      { titulo: 'Pedidos', chave: 'pedidos', alinhar: 'direita' },
      { titulo: 'Total', chave: 'total', alinhar: 'direita' },
    ]
    linhas = r.map((c) => ({
      nome: c.nome,
      pedidos: String(c.pedidos),
      total: formatarReal(c.total),
    }))
  } else {
    return new Response('Relatório inválido', { status: 404 })
  }

  const buffer = await renderToBuffer(
    RelatorioDocumento({
      titulo,
      subtitulo: periodoLabel,
      local: local.nome,
      colunas,
      linhas,
      rodape,
    }),
  )

  return new Response(buffer as BufferSource, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="relatorio-${tipo}-${ini}-a-${fim}.pdf"`,
    },
  })
}
```

- [ ] **Step 4: Verificar typecheck**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros. (Se `renderToBuffer` reclamar do tipo do elemento, envolver com `React.createElement` ou usar JSX `<RelatorioDocumento .../>` — o arquivo é `.ts`; renomear para `route.tsx` se precisar de JSX.)

- [ ] **Step 5: Verificar o PDF no browser**

Com `npm run dev`, abrir `http://localhost:3000/relatorios/periodo/pdf?ini=2026-01-01&fim=2026-12-31`.
Expected: baixa um PDF legível, cabeçalho com nome do local + CNPJ, tabela paginada (sem linha cortada na quebra), totais e numeração de página. Testar `produto` e `cliente` também. Abrir num período curto (1 dia) e num longo (ano inteiro) para confirmar paginação.

### Task 5: Telas de relatórios + consolidação

**Files:**
- Create: `components/relatorios/FiltroPeriodo.tsx` (client: dois inputs de data + botão Baixar PDF)
- Create: `app/(app)/relatorios/page.tsx` (Vendas por período)
- Create: `app/(app)/relatorios/produto/page.tsx`
- Create: `app/(app)/relatorios/cliente/page.tsx`
- Create: `components/relatorios/RelatoriosTabs.tsx` (navegação entre os 3 + faturamento/ABC)
- Modify: `app/(app)/financeiro/relatorios/page.tsx` (redirect para `/relatorios`)
- Modify: `components/financeiro/FinanceiroTabs.tsx` (remover a aba Relatórios, que migrou)

**Interfaces:**
- Consumes: server actions da Task 3; rota PDF da Task 4.
- Produces: telas em `/relatorios`, `/relatorios/produto`, `/relatorios/cliente`.

- [ ] **Step 1: `components/relatorios/FiltroPeriodo.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { Download } from 'lucide-react'
import { Input } from '@/components/ui/input'

// Filtro de período + botão que baixa o PDF da rota correspondente.
// `tipo` casa com app/relatorios/[tipo]/pdf. `onAplicar` recarrega a tabela.
export function FiltroPeriodo({
  tipo,
  ini,
  fim,
  onAplicar,
}: {
  tipo: 'periodo' | 'produto' | 'cliente'
  ini: string
  fim: string
  onAplicar: (p: { ini: string; fim: string }) => void
}) {
  const [di, setDi] = useState(ini)
  const [df, setDf] = useState(fim)
  const pdfHref = `/relatorios/${tipo}/pdf?ini=${di}&fim=${df}`
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wider text-text-muted">
        Início
        <Input type="date" value={di} onChange={(e) => setDi(e.target.value)} className="w-auto" />
      </label>
      <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wider text-text-muted">
        Fim
        <Input type="date" value={df} onChange={(e) => setDf(e.target.value)} className="w-auto" />
      </label>
      <button
        type="button"
        onClick={() => onAplicar({ ini: di, fim: df })}
        className="u-motion u-press inline-flex h-10 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text hover:border-brand/50 hover:text-brand"
      >
        Aplicar
      </button>
      <a
        href={pdfHref}
        className="u-motion u-press inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-strong"
      >
        <Download className="size-4" strokeWidth={1.5} />
        Baixar PDF
      </a>
    </div>
  )
}
```

- [ ] **Step 2: `app/(app)/relatorios/page.tsx` (período)**

Client component que usa `relatorioVendasPeriodo`, default = mês corrente, mostra cards de resumo (receita/pedidos/ticket) + tabela por dia + `<FiltroPeriodo tipo="periodo">`. Seguir o padrão visual de `estoque/page.tsx` (PageHeader, Tabela, Money, useState/useEffect/carregar com try/catch/finally). Incluir `<RelatoriosTabs />` no topo.

```tsx
'use client'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { BarChart3 } from 'lucide-react'
import { relatorioVendasPeriodo } from '@/lib/actions/relatorios'
import { PageHeader } from '@/components/ui-kit/PageHeader'
import { Tabela, TabelaHead, TabelaHeadCell, TabelaBody, TabelaRow, TabelaCell } from '@/components/ui-kit/tabela'
import { EstadoVazio } from '@/components/ui-kit/EstadoVazio'
import { Money } from '@/components/ui-kit/Money'
import { formatarNumero } from '@/lib/formatos'
import { FiltroPeriodo } from '@/components/relatorios/FiltroPeriodo'
import { RelatoriosTabs } from '@/components/relatorios/RelatoriosTabs'

function mesCorrente() {
  const hoje = new Date().toISOString().slice(0, 10)
  const ini = hoje.slice(0, 8) + '01'
  return { ini, fim: hoje }
}

type Dados = Awaited<ReturnType<typeof relatorioVendasPeriodo>>

export default function RelatorioPeriodoPage() {
  const [periodo, setPeriodo] = useState(mesCorrente())
  const [dados, setDados] = useState<Dados | null>(null)
  const [loading, setLoading] = useState(true)

  async function carregar(p: { ini: string; fim: string }) {
    setLoading(true)
    try {
      setDados(await relatorioVendasPeriodo(p))
    } catch (e) {
      console.error(e)
      toast.error('Erro ao carregar relatório')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar(periodo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function aplicar(p: { ini: string; fim: string }) {
    setPeriodo(p)
    carregar(p)
  }

  return (
    <div className="px-6 py-5">
      <RelatoriosTabs />
      <PageHeader titulo="Vendas por período" subtitulo="Faturamento e pedidos no intervalo escolhido." />
      <FiltroPeriodo tipo="periodo" ini={periodo.ini} fim={periodo.fim} onAplicar={aplicar} />

      {dados && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-surface px-3 py-2">
            <p className="text-[11px] uppercase tracking-wider text-text-muted">Receita</p>
            <Money valor={dados.totalReceita} destaque className="text-sm font-semibold" />
          </div>
          <div className="rounded-lg border border-border bg-surface px-3 py-2">
            <p className="text-[11px] uppercase tracking-wider text-text-muted">Pedidos</p>
            <p className="font-mono text-sm font-semibold text-text">{formatarNumero(dados.totalPedidos)}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface px-3 py-2">
            <p className="text-[11px] uppercase tracking-wider text-text-muted">Ticket médio</p>
            <Money valor={dados.ticketMedio} className="text-sm font-semibold" />
          </div>
        </div>
      )}

      {loading ? null : !dados || dados.dias.length === 0 ? (
        <EstadoVazio icone={BarChart3} titulo="Sem vendas no período" descricao="Ajuste as datas para ver o faturamento." />
      ) : (
        <Tabela>
          <TabelaHead>
            <tr>
              <TabelaHeadCell>Data</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita">Pedidos</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita">Receita</TabelaHeadCell>
            </tr>
          </TabelaHead>
          <TabelaBody>
            {dados.dias.map((d) => (
              <TabelaRow key={d.data}>
                <TabelaCell className="font-medium">{d.data.split('-').reverse().join('/')}</TabelaCell>
                <TabelaCell alinhar="direita" className="text-text-muted">{formatarNumero(d.pedidos)}</TabelaCell>
                <TabelaCell alinhar="direita"><Money valor={d.receita} /></TabelaCell>
              </TabelaRow>
            ))}
          </TabelaBody>
        </Tabela>
      )}
    </div>
  )
}
```

- [ ] **Step 3: `app/(app)/relatorios/produto/page.tsx` e `cliente/page.tsx`**

Mesmo molde do Step 2, trocando a action (`relatorioVendasProduto` / `relatorioVendasCliente`), as colunas da tabela e `tipo` do `FiltroPeriodo` (`'produto'` / `'cliente'`). Produto: colunas Produto / Unidades / Faturamento. Cliente: Cliente / Pedidos / Total. Sem cards de resumo (ou um card com o total geral). Reusar `RelatoriosTabs`.

- [ ] **Step 4: `components/relatorios/RelatoriosTabs.tsx`**

Abas no topo apontando para `/relatorios` (Período), `/relatorios/produto` (Produto), `/relatorios/cliente` (Cliente), `/financeiro/resultado`? Não — manter só os 3 de vendas + link "Faturamento mensal" e "Curva ABC" que hoje vivem em `/financeiro/relatorios`. Como a página de faturamento/ABC continua existindo, apontar a aba "Faturamento" para ela. Seguir o padrão de `components/financeiro/FinanceiroTabs.tsx` (ler antes para copiar o estilo de tabs com `usePathname`).

- [ ] **Step 5: Redirect do financeiro/relatorios e ajuste das tabs**

Em `app/(app)/financeiro/relatorios/page.tsx`: mover o conteúdo atual (faturamento + Curva ABC) — decisão: **manter** essa página como "Faturamento & ABC" e apenas remover a duplicação conceitual; a aba Relatórios do `FinanceiroTabs` é renomeada para apontar o usuário ao novo hub. Concretamente:
  - Em `components/financeiro/FinanceiroTabs.tsx`, trocar o label/href da entrada que leva a relatórios de vendas para `/relatorios`.
  - Não apagar `financeiro/relatorios` (faturamento mensal/ABC seguem úteis); apenas garantir que "vendas por período/produto/cliente" só existam em `/relatorios`.

Ler `components/financeiro/FinanceiroTabs.tsx` antes de editar para casar a estrutura.

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit && npm run lint`, depois `npm run dev`.
Expected: `/relatorios`, `/relatorios/produto`, `/relatorios/cliente` carregam, filtro de data recarrega a tabela, "Baixar PDF" baixa o arquivo. Sidebar (Task 1) já tem os 3 links na seção Relatórios e eles marcam ativo corretamente.

---

## FASE 3 — Mobile (cards + PWA)

### Task 6: Cards responsivos por descritor

**Files:**
- Create: `components/ui-kit/CardLinha.tsx`
- Modify: `app/(app)/estoque/page.tsx` (adiciona render mobile)
- Modify: `app/(app)/produtos/page.tsx`, `clientes/page.tsx`, `pedidos/page.tsx`, `movimentacoes/page.tsx` (mesma técnica)

**Interfaces:**
- Produces:
  - `type CampoCard = { label: string; valor: React.ReactNode }`
  - `<CardLinha titulo destaque campos acoes href />` — um card de toque.

- [ ] **Step 1: `components/ui-kit/CardLinha.tsx`**

```tsx
import Link from 'next/link'
import type { ReactNode } from 'react'

export type CampoCard = { label: string; valor: ReactNode }

// Card de uma linha para o mobile. A página declara titulo/campos/ações; este
// componente só desenha. Pareia com a Tabela do desktop (mesmos dados).
export function CardLinha({
  titulo,
  destaque,
  campos,
  acoes,
  href,
}: {
  titulo: ReactNode
  destaque?: ReactNode
  campos: CampoCard[]
  acoes?: ReactNode
  href?: string
}) {
  const corpo = (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 font-medium text-text">{titulo}</div>
        {destaque != null && <div className="shrink-0">{destaque}</div>}
      </div>
      {campos.length > 0 && (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
          {campos.map((c, i) => (
            <div key={i} className="flex flex-col">
              <dt className="text-[11px] uppercase tracking-wider text-text-muted">{c.label}</dt>
              <dd className="text-sm text-text">{c.valor}</dd>
            </div>
          ))}
        </dl>
      )}
      {acoes && <div className="mt-3 flex gap-2">{acoes}</div>}
    </div>
  )
  return href ? <Link href={href}>{corpo}</Link> : corpo
}
```

- [ ] **Step 2: Aplicar no estoque**

Em `app/(app)/estoque/page.tsx`, envolver a `<Tabela>` existente com `<div className="hidden lg:block">` e adicionar, logo abaixo, a lista mobile:

```tsx
<div className="space-y-2 lg:hidden">
  {estoque.map((p) => (
    <CardLinha
      key={p.id}
      titulo={p.nome}
      destaque={<StatusPill status={p.status_estoque} />}
      campos={[
        { label: 'Saldo', valor: formatarNumero(p.saldo_atual) },
        { label: 'Mínimo', valor: formatarNumero(p.estoque_minimo) },
        { label: 'Custo médio', valor: <Money valor={p.custo_medio} /> },
        { label: 'Valor total', valor: <Money valor={p.valor_total} /> },
      ]}
      acoes={
        <>
          <button type="button" onClick={() => abrirEntrada(p)} className="u-motion u-press inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-surface-2 text-[13px] font-medium text-text">Entrada</button>
          <button type="button" onClick={() => abrirAjuste(p)} className="u-motion u-press inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-surface-2 text-[13px] font-medium text-text">Ajustar</button>
        </>
      }
    />
  ))}
</div>
```

Importar `CardLinha` no topo. O `loading`/`EstadoVazio` continuam cobrindo os dois layouts (ficam acima do bloco tabela/cards).

- [ ] **Step 3: Aplicar nas demais páginas**

Repetir a técnica (`hidden lg:block` na tabela + bloco `lg:hidden` de `CardLinha`) em produtos, clientes, pedidos e movimentações, escolhendo 3-4 campos relevantes por página (produtos: categoria/estoque/preço/status; clientes: tipo/telefone/pagamento/status; pedidos: data/cliente/total/status; movimentações: data/tipo/detalhe/valor). Ler cada página antes para reusar os mesmos dados/handlers.

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npm run lint`, depois `npm run dev` com a janela < 1024px (ou DevTools responsivo).
Expected: em telas estreitas cada página mostra cards empilhados com campos rotulados e botões grandes; em ≥ lg volta a tabela normal. Sem scroll horizontal.

### Task 7: PWA instalável

**Files:**
- Create: `app/manifest.ts`
- Create: `public/icon.svg` (fonte do ícone) + `public/icon-192.png`, `public/icon-512.png` (gerados)
- Modify: `app/layout.tsx` (metadata `themeColor` / apple web app, se ainda não houver)

**Interfaces:**
- Produces: manifest servido em `/manifest.webmanifest` pelo Next; ícones em `/icon-192.png` e `/icon-512.png`.

- [ ] **Step 1: Criar o SVG do ícone**

`public/icon.svg` — quadrado teal `#07151a` com "R$" dourado `#D4A520` centralizado:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#07151a"/>
  <text x="50%" y="50%" dy="0.35em" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="220" fill="#D4A520">R$</text>
</svg>
```

- [ ] **Step 2: Gerar os PNGs 192 e 512**

Gerar a partir do SVG com uma ferramenta local (ex.: `sharp` via `npx`, ImageMagick, ou um conversor). Comando exemplo com `sharp-cli`:

Run: `npx sharp-cli -i public/icon.svg -o public/icon-512.png resize 512 512` e `npx sharp-cli -i public/icon.svg -o public/icon-192.png resize 192 192`
Expected: dois PNGs nítidos criados em `public/`. (Se `sharp-cli` não rodar offline, gerar via qualquer conversor SVG→PNG mantendo os tamanhos.)

- [ ] **Step 3: `app/manifest.ts`**

```ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'R$ DEPÓSITO',
    short_name: 'DEPÓSITO',
    description: 'Gestão do depósito de bebidas',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#07151a',
    theme_color: '#07151a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}
```

- [ ] **Step 4: Garantir themeColor no layout**

Em `app/layout.tsx`, conferir/adicionar no export `viewport` (Next 16): `themeColor: '#07151a'`. Ler o arquivo antes para não duplicar.

- [ ] **Step 5: Verificar instalável**

Run: `npm run build && npm run start`, abrir no browser, DevTools → Application → Manifest.
Expected: manifest carregado sem erros, ícones reconhecidos, "Install app" disponível. No celular, "Adicionar à tela inicial" abre em tela cheia.

---

## Self-Review (preenchido)

- **Cobertura do spec:** Sidebar accordion → Task 1. Relatórios (período/produto/cliente) → Tasks 2-5. PDF vetorial server-side → Task 4. RPCs + índices + filtro `concluida` → Task 2-3. Consolidação financeiro/relatorios → Task 5. Mobile cards por descritor → Task 6. PWA → Task 7. Soft delete: já existe, sem task (só filtro nas queries). ✓
- **Sem placeholders de código:** todos os componentes centrais têm código completo. Steps de "repetir técnica" (Task 5.3, 6.3) referenciam o molde já escrito no step anterior e listam os campos exatos — aceitável por serem repetição mecânica do padrão mostrado. ✓
- **Consistência de tipos:** `Periodo {ini,fim}` usado igual em actions, route e filtro. `ColunaPdf` e `CampoCard` definidos antes do uso. `relatorioVendas*` nomes batem entre Task 3 (define) e Tasks 4-5 (consomem). ✓
- **Ordem:** Fase 1 independente; Task 4 depende de 2-3; Task 5 depende de 3-4; Fase 3 independente das demais. ✓
