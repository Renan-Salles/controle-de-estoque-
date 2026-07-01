# Convite de equipe + escopo por local — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o cadastro público e substituí-lo por convite: admin gera um link único (cargo + local já definidos), a pessoa convidada cria a própria conta por ali e já entra com as permissões certas, escopada a um só local.

**Architecture:** Toda escrita sensível (criar convite, revogar, resgatar) roda em funções Postgres `security definer` (`criar_convite`, `revogar_convite`, `resgatar_convite`, `consultar_convite`), chamadas via `supabase.rpc(...)`. Isso evita depender do comportamento de `createServiceClient()` — que neste projeto **não bypassa RLS quando já existe sessão** (o `@supabase/ssr` prioriza o cookie de sessão sobre a chave passada no construtor, só usa a chave de fato quando não há sessão nenhuma). Funções `security definer` já são o padrão comprovado do projeto (`handle_new_user()` em `001_auth_rbac.sql`), então isso não introduz um mecanismo novo, só reaproveita o único que já se sabe que funciona pra escritas privilegiadas.

**Tech Stack:** Next.js 16 App Router (Server Actions + Server Components), Supabase Postgres (RLS + `security definer` functions), `@supabase/supabase-js` client-side `signUp()`.

## Global Constraints

- Este repositório não tem suite de testes automatizados (sem Jest/Vitest). Verificação é sempre: `npx tsc --noEmit`, `npx eslint . --quiet`, `npx next build`, e teste manual (browser via chrome-devtools-mcp, ou SQL direto via `node -e` com `pg.Pool` usando `DATABASE_URL` de `.env.local`). Cada task usa esse padrão em vez de "escrever teste que falha".
- Migrations vão em `supabase/migrations/YYYY-MM-DD-<nome>.sql` e são aplicadas com:
  ```
  node -e "require('dotenv').config({path:'.env.local'}); const {Pool}=require('pg'); const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); pool.query(require('fs').readFileSync('./supabase/migrations/ARQUIVO.sql','utf8')).then(()=>{console.log('ok');pool.end()}).catch(e=>{console.error(e.message);pool.end()})"
  ```
- Nunca criar uma política de RLS que deixe um usuário comum atualizar seu próprio `cargo_id`/`local_id` livremente — isso seria auto-promoção de permissão. Esse campo só pode mudar via `resgatar_convite` (que valida o convite antes) ou por um admin via `atualizarUsuario`.
- Preço/cadastro, filtros e nav já implementados hoje (Cadastros = Clientes/Fornecedores/Produtos) não mudam nesta feature, exceto pela adição do item Equipe.
- `git push` ao final de cada task (convenção já estabelecida no projeto).

---

### Task 1: Migração — `profiles.local_id`, tabela `convites`, funções `security definer`

**Files:**
- Create: `supabase/migrations/2026-07-01-convites-equipe.sql`

**Interfaces:**
- Produces: coluna `public.profiles.local_id` (uuid, nullable, FK `locais`); tabela `public.convites` (`id`, `token`, `cargo_id`, `local_id`, `criado_por`, `expira_em`, `usado_em`, `usado_por`, `created_at`); funções RPC `criar_convite(p_cargo_id uuid, p_local_id uuid) returns text`, `revogar_convite(p_id uuid) returns void`, `consultar_convite(p_token text) returns table(valido boolean, cargo_nome text, local_nome text)`, `resgatar_convite(p_token text, p_nome text) returns table(cargo_nome text, local_nome text)`.

- [ ] **Step 1: Escrever a migração**

```sql
-- Convite de equipe + escopo por local: profile ganha local_id, tabela de
-- convites com token de uso único, e funções security definer pra criar,
-- consultar (anônimo), revogar e resgatar convites sem depender de RLS
-- client-side (createServiceClient() só bypassa RLS quando não há sessão
-- ativa nos cookies — com sessão, ele age como o próprio usuário logado).

alter table public.profiles add column if not exists local_id uuid references public.locais(id);

create table if not exists public.convites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  cargo_id uuid not null references public.cargos(id),
  local_id uuid not null references public.locais(id),
  criado_por uuid not null references public.profiles(id),
  expira_em timestamptz not null,
  usado_em timestamptz,
  usado_por uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.convites enable row level security;
drop policy if exists convites_select on public.convites;
create policy convites_select on public.convites for select using (auth.uid() is not null);

-- Gera convite. Checa admin dentro da função (não depende de RLS/policy).
create or replace function public.criar_convite(p_cargo_id uuid, p_local_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin boolean;
  v_token text;
begin
  select exists (
    select 1 from public.profiles p
    join public.cargos c on c.id = p.cargo_id
    where p.id = auth.uid() and c.admin = true
  ) into v_admin;

  if not v_admin then
    raise exception 'Sem permissão';
  end if;

  -- gen_random_uuid() é built-in do Postgres (pg_catalog), sempre resolve
  -- mesmo com search_path vazio. Evita depender de onde o pgcrypto está
  -- instalado (gen_random_bytes fica em "extensions" no Supabase, fora do
  -- search_path desta função).
  v_token := replace(gen_random_uuid()::text, '-', '');

  insert into public.convites (token, cargo_id, local_id, criado_por, expira_em)
  values (v_token, p_cargo_id, p_local_id, auth.uid(), now() + interval '7 days');

  return v_token;
end;
$$;

-- Revoga convite ainda não usado. Só admin.
create or replace function public.revogar_convite(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin boolean;
begin
  select exists (
    select 1 from public.profiles p
    join public.cargos c on c.id = p.cargo_id
    where p.id = auth.uid() and c.admin = true
  ) into v_admin;

  if not v_admin then
    raise exception 'Sem permissão';
  end if;

  delete from public.convites where id = p_id and usado_em is null;
end;
$$;

-- Consulta pública (anônima), só pra mostrar cargo/local na tela do convite
-- antes do cadastro. Não expõe token, ids nem quem convidou.
create or replace function public.consultar_convite(p_token text)
returns table (valido boolean, cargo_nome text, local_nome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_convite record;
begin
  select * into v_convite
  from public.convites
  where token = p_token and usado_em is null and expira_em > now()
  limit 1;

  if v_convite is null then
    return query select false, null::text, null::text;
    return;
  end if;

  return query
    select true, c.nome, l.nome
    from public.cargos c, public.locais l
    where c.id = v_convite.cargo_id and l.id = v_convite.local_id;
end;
$$;

-- Resgata o convite: chamado pelo usuário recém-criado (signUp já rodou e
-- já existe sessão). Grava nome/cargo/local no profile dele e marca o
-- convite como usado, tudo na mesma transação da função.
create or replace function public.resgatar_convite(p_token text, p_nome text)
returns table (cargo_nome text, local_nome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_convite record;
begin
  select * into v_convite
  from public.convites
  where token = p_token and usado_em is null and expira_em > now()
  limit 1;

  if v_convite is null then
    raise exception 'Convite inválido ou expirado';
  end if;

  update public.profiles
  set nome = p_nome, cargo_id = v_convite.cargo_id, local_id = v_convite.local_id
  where id = auth.uid();

  update public.convites
  set usado_em = now(), usado_por = auth.uid()
  where id = v_convite.id;

  return query
    select c.nome, l.nome
    from public.cargos c, public.locais l
    where c.id = v_convite.cargo_id and l.id = v_convite.local_id;
end;
$$;

grant execute on function public.criar_convite(uuid, uuid) to authenticated;
grant execute on function public.revogar_convite(uuid) to authenticated;
grant execute on function public.consultar_convite(text) to anon, authenticated;
grant execute on function public.resgatar_convite(text, text) to authenticated;
```

- [ ] **Step 2: Aplicar a migração**

Run:
```
node -e "require('dotenv').config({path:'.env.local'}); const {Pool}=require('pg'); const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); pool.query(require('fs').readFileSync('./supabase/migrations/2026-07-01-convites-equipe.sql','utf8')).then(()=>{console.log('ok');pool.end()}).catch(e=>{console.error(e.message);pool.end()})"
```
Expected: `ok` impresso, sem erro.

- [ ] **Step 3: Verificar direto no banco**

Run (mesmo padrão do Step 2, mas com uma query em vez do arquivo da migração):
```
node -e "require('dotenv').config({path:'.env.local'}); const {Pool}=require('pg'); const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); pool.query(\"select column_name from information_schema.columns where table_name='profiles' and column_name='local_id' union all select routine_name from information_schema.routines where routine_name in ('criar_convite','revogar_convite','consultar_convite','resgatar_convite')\").then(r=>{console.log(r.rows);pool.end()}).catch(e=>{console.error(e.message);pool.end()})"
```
Expected: retorna `local_id` + as 4 funções na lista.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/2026-07-01-convites-equipe.sql
git commit -m "feat: schema de convite de equipe (profiles.local_id, tabela convites, funcoes security definer)"
git push
```

---

### Task 2: Server actions — `getLocalIdUsuario`, `lib/actions/convites.ts`

**Files:**
- Modify: `lib/permissoes.ts`
- Create: `lib/actions/convites.ts`

**Interfaces:**
- Consumes: `createClient`/`createServiceClient` de `@/lib/supabase/server`; `listarLocais` e tipo `Local` de `@/lib/local`.
- Produces: `getLocalIdUsuario(): Promise<string | null>` (em `lib/permissoes.ts`); `criarConvite(cargoId: string, localId: string): Promise<{token: string} | {error: string}>`, `listarConvitesPendentes(): Promise<ConvitePendente[]>`, `revogarConvite(id: string): Promise<{success: true} | {error: string}>`, `consultarConvite(token: string): Promise<{valido: false} | {valido: true; cargoNome: string; localNome: string}>`, `resgatarConvite(token: string, nome: string): Promise<{success: true; cargoNome: string; localNome: string} | {error: string}>`, `listarLocaisParaConvite(): Promise<Local[]>` (todas em `lib/actions/convites.ts`), e tipo `ConvitePendente`.

- [ ] **Step 1: Adicionar `getLocalIdUsuario` em `lib/permissoes.ts`**

Adicionar ao final do arquivo (depois de `getCargoUsuario`):

```ts
// local_id do usuário logado (server-only). null = sem restrição de local
// (admin ou conta antiga) — mesmo espírito fail-open do cargo nulo.
export async function getLocalIdUsuario(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const service = await createServiceClient()
  const { data } = await service
    .from('profiles')
    .select('local_id')
    .eq('id', user.id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any)?.local_id ?? null
}
```

- [ ] **Step 2: Criar `lib/actions/convites.ts`**

```ts
'use server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { listarLocais, type Local } from '@/lib/local'

export type ConvitePendente = {
  id: string
  cargo_id: string
  local_id: string
  expira_em: string
  cargos: { nome: string } | null
  locais: { nome: string } | null
}

export async function listarLocaisParaConvite(): Promise<Local[]> {
  return listarLocais()
}

export async function criarConvite(cargoId: string, localId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('criar_convite', {
    p_cargo_id: cargoId,
    p_local_id: localId,
  })
  if (error) return { error: error.message }
  return { token: data as string }
}

export async function listarConvitesPendentes(): Promise<ConvitePendente[]> {
  const s = await createServiceClient()
  const { data } = await s
    .from('convites')
    .select('id, cargo_id, local_id, expira_em, cargos(nome), locais(nome)')
    .is('usado_em', null)
    .gt('expira_em', new Date().toISOString())
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as ConvitePendente[]
}

export async function revogarConvite(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('revogar_convite', { p_id: id })
  if (error) return { error: error.message }
  return { success: true as const }
}

export async function consultarConvite(
  token: string,
): Promise<{ valido: false } | { valido: true; cargoNome: string; localNome: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc('consultar_convite', { p_token: token })
    .single()
  if (error || !data) return { valido: false }
  const d = data as { valido: boolean; cargo_nome: string | null; local_nome: string | null }
  if (!d.valido || !d.cargo_nome || !d.local_nome) return { valido: false }
  return { valido: true, cargoNome: d.cargo_nome, localNome: d.local_nome }
}

export async function resgatarConvite(token: string, nome: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc('resgatar_convite', { p_token: token, p_nome: nome })
    .single()
  if (error) return { error: error.message }
  const d = data as { cargo_nome: string; local_nome: string }
  return { success: true as const, cargoNome: d.cargo_nome, localNome: d.local_nome }
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add lib/permissoes.ts lib/actions/convites.ts
git commit -m "feat: server actions de convite (criar, listar, revogar, consultar, resgatar)"
git push
```

---

### Task 3: Tela "Equipe" (substitui Usuários) + nav

**Files:**
- Create: `app/(app)/equipe/page.tsx`
- Delete: `app/(app)/configuracoes/usuarios/page.tsx`
- Modify: `app/(app)/configuracoes/page.tsx` (remove o card "Usuários")
- Modify: `components/shell/nav-items.tsx` (adiciona item Equipe em Cadastros, só admin)

**Interfaces:**
- Consumes: `listarUsuariosComCargo`, `listarCargos`, `atualizarUsuario` (de `lib/actions/cargos.ts`, já existentes); `criarConvite`, `listarConvitesPendentes`, `revogarConvite`, `listarLocaisParaConvite`, `type ConvitePendente` (de `lib/actions/convites.ts`, Task 2).
- Produces: rota `/equipe` (substitui `/configuracoes/usuarios`).

- [ ] **Step 1: Criar `app/(app)/equipe/page.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Users, Copy, Trash2, UserPlus, Check } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { PageHeader } from '@/components/ui-kit/PageHeader'
import { btnClass } from '@/components/ui-kit/Button'
import {
  Tabela,
  TabelaHead,
  TabelaHeadCell,
  TabelaBody,
  TabelaRow,
  TabelaCell,
} from '@/components/ui-kit/tabela'
import { EstadoVazio } from '@/components/ui-kit/EstadoVazio'
import type { Cargo } from '@/lib/nav-catalogo'
import type { Local } from '@/lib/local'
import {
  listarUsuariosComCargo,
  listarCargos,
  atualizarUsuario,
  type UsuarioComCargo,
} from '@/lib/actions/cargos'
import {
  criarConvite,
  listarConvitesPendentes,
  revogarConvite,
  listarLocaisParaConvite,
  type ConvitePendente,
} from '@/lib/actions/convites'

function formatarValidade(expiraEm: string) {
  const dias = Math.max(0, Math.ceil((new Date(expiraEm).getTime() - Date.now()) / 86400000))
  return dias <= 0 ? 'expira hoje' : `expira em ${dias} ${dias === 1 ? 'dia' : 'dias'}`
}

export default function EquipePage() {
  const [usuarios, setUsuarios] = useState<UsuarioComCargo[]>([])
  const [cargos, setCargos] = useState<Cargo[]>([])
  const [locais, setLocais] = useState<Local[]>([])
  const [convites, setConvites] = useState<ConvitePendente[]>([])
  const [loading, setLoading] = useState(true)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [cargoConvite, setCargoConvite] = useState('')
  const [localConvite, setLocalConvite] = useState('')
  const [gerando, setGerando] = useState(false)
  const [linkGerado, setLinkGerado] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  async function carregar() {
    setLoading(true)
    try {
      const [u, c, l, cv] = await Promise.all([
        listarUsuariosComCargo(),
        listarCargos(),
        listarLocaisParaConvite(),
        listarConvitesPendentes(),
      ])
      setUsuarios(u)
      setCargos(c)
      setLocais(l)
      setConvites(cv)
    } catch {
      toast.error('Erro ao carregar equipe')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar()
  }, [])

  async function mudarCargo(id: string, cargo_id: string) {
    setUsuarios((us) => us.map((u) => (u.id === id ? { ...u, cargo_id } : u)))
    const r = await atualizarUsuario(id, { cargo_id })
    if (r.error) {
      toast.error(r.error)
      carregar()
    } else {
      toast.success('Cargo atualizado')
    }
  }

  async function mudarStatus(id: string, status: string) {
    setUsuarios((us) => us.map((u) => (u.id === id ? { ...u, status } : u)))
    const r = await atualizarUsuario(id, { status })
    if (r.error) {
      toast.error(r.error)
      carregar()
    } else {
      toast.success(status === 'ativo' ? 'Pessoa ativada' : 'Pessoa desativada')
    }
  }

  function abrirConvite() {
    setCargoConvite('')
    setLocalConvite('')
    setLinkGerado(null)
    setCopiado(false)
    setSheetOpen(true)
  }

  async function gerarConvite() {
    if (!cargoConvite || !localConvite) {
      toast.error('Escolha o cargo e o local')
      return
    }
    setGerando(true)
    const r = await criarConvite(cargoConvite, localConvite)
    setGerando(false)
    if ('error' in r) {
      toast.error(r.error)
      return
    }
    setLinkGerado(`${window.location.origin}/convite/${r.token}`)
    carregar()
  }

  async function copiarLink() {
    if (!linkGerado) return
    await navigator.clipboard.writeText(linkGerado)
    setCopiado(true)
    toast.success('Link copiado')
  }

  async function revogar(id: string) {
    setConvites((cs) => cs.filter((c) => c.id !== id))
    const r = await revogarConvite(id)
    if (r.error) {
      toast.error(r.error)
      carregar()
    } else {
      toast.success('Convite revogado')
    }
  }

  function SelectCargo({ u }: { u: UsuarioComCargo }) {
    return (
      <Select value={u.cargo_id ?? ''} onValueChange={(v) => v && mudarCargo(u.id, v)}>
        <SelectTrigger className="h-8 w-44">
          <SelectValue placeholder="Sem cargo" />
        </SelectTrigger>
        <SelectContent>
          {cargos.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  function SelectStatus({ u }: { u: UsuarioComCargo }) {
    return (
      <Select value={u.status ?? 'ativo'} onValueChange={(v) => v && mudarStatus(u.id, v)}>
        <SelectTrigger className="h-8 w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ativo">Ativo</SelectItem>
          <SelectItem value="inativo">Inativo</SelectItem>
        </SelectContent>
      </Select>
    )
  }

  return (
    <div className="px-6 py-5">
      <PageHeader titulo="Equipe" subtitulo="Pessoas com acesso ao sistema, cargo e convites.">
        <button type="button" onClick={abrirConvite} className={btnClass('primary')}>
          <UserPlus className="size-4" strokeWidth={1.5} />
          Convidar
        </button>
      </PageHeader>

      {loading ? null : usuarios.length === 0 ? (
        <EstadoVazio icone={Users} titulo="Nenhuma pessoa" descricao="Convide a primeira pessoa da equipe." />
      ) : (
        <>
          <div className="hidden lg:block">
            <Tabela>
              <TabelaHead>
                <tr>
                  <TabelaHeadCell>Nome</TabelaHeadCell>
                  <TabelaHeadCell>Email</TabelaHeadCell>
                  <TabelaHeadCell>Cargo</TabelaHeadCell>
                  <TabelaHeadCell>Status</TabelaHeadCell>
                </tr>
              </TabelaHead>
              <TabelaBody>
                {usuarios.map((u) => (
                  <TabelaRow key={u.id}>
                    <TabelaCell className="font-medium">{u.nome ?? '-'}</TabelaCell>
                    <TabelaCell className="text-text-muted">{u.email ?? '-'}</TabelaCell>
                    <TabelaCell>
                      <SelectCargo u={u} />
                    </TabelaCell>
                    <TabelaCell>
                      <SelectStatus u={u} />
                    </TabelaCell>
                  </TabelaRow>
                ))}
              </TabelaBody>
            </Tabela>
          </div>

          <div className="space-y-2 lg:hidden">
            {usuarios.map((u) => (
              <div key={u.id} className="rounded-lg border border-border bg-surface p-3">
                <p className="font-medium text-text">{u.nome ?? '-'}</p>
                <p className="text-[13px] text-text-muted">{u.email ?? '-'}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <SelectCargo u={u} />
                  <SelectStatus u={u} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && convites.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-text">Convites pendentes</h2>
          <div className="space-y-2">
            {convites.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3"
              >
                <div>
                  <p className="text-sm font-medium text-text">
                    {c.cargos?.nome ?? 'Cargo removido'} · {c.locais?.nome ?? 'Local removido'}
                  </p>
                  <p className="text-[13px] text-text-muted">{formatarValidade(c.expira_em)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => revogar(c.id)}
                  className="u-motion u-press inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 text-[13px] font-medium text-text hover:border-err/50 hover:text-err"
                >
                  <Trash2 className="size-3.5" strokeWidth={1.5} />
                  Revogar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader className="border-b border-border">
            <SheetTitle>Convidar pessoa</SheetTitle>
            <p className="text-[13px] text-text-muted">
              Escolha o cargo e o local. Depois é só copiar o link e mandar pra pessoa.
            </p>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
            {!linkGerado ? (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                    Cargo
                  </label>
                  <Select value={cargoConvite} onValueChange={(v) => v && setCargoConvite(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {cargos.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                    Local
                  </label>
                  <Select value={localConvite} onValueChange={(v) => v && setLocalConvite(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {locais.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <button
                  type="button"
                  onClick={gerarConvite}
                  disabled={gerando}
                  className="u-motion u-press mt-1 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-medium text-white hover:bg-brand-strong disabled:pointer-events-none disabled:opacity-50"
                >
                  {gerando ? 'Gerando...' : 'Gerar link de convite'}
                </button>
              </>
            ) : (
              <>
                <div className="rounded-lg border border-brand/30 bg-brand/[0.07] p-3">
                  <p className="text-[13px] text-text-muted">Link do convite</p>
                  <p className="mt-1 break-all font-mono text-sm text-text">{linkGerado}</p>
                </div>
                <button
                  type="button"
                  onClick={copiarLink}
                  className="u-motion u-press inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-medium text-white hover:bg-brand-strong"
                >
                  {copiado ? (
                    <Check className="size-4" strokeWidth={1.5} />
                  ) : (
                    <Copy className="size-4" strokeWidth={1.5} />
                  )}
                  {copiado ? 'Copiado' : 'Copiar link'}
                </button>
                <p className="text-center text-[13px] text-text-muted">
                  Válido por 7 dias, uso único. Mande esse link direto pra pessoa.
                </p>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
```

- [ ] **Step 2: Apagar a tela antiga**

```bash
git rm "app/(app)/configuracoes/usuarios/page.tsx"
```

- [ ] **Step 3: Remover o card "Usuários" de `/configuracoes`**

Em `app/(app)/configuracoes/page.tsx`, remover a entrada do array `CARDS`:

```ts
const CARDS = [
  {
    href: '/configuracoes/deposito',
    icone: Store,
    titulo: 'Dados do Depósito',
    descricao: 'Nome, CNPJ e endereço que aparecem no cupom fiscal.',
  },
  {
    href: '/configuracoes/cargos',
    icone: ShieldCheck,
    titulo: 'Cargos e permissões',
    descricao: 'Crie cargos e escolha quais botões cada um enxerga na sidebar.',
  },
]
```

E remover o import não usado `Users` do topo do arquivo (fica só `ShieldCheck, Store`).

- [ ] **Step 4: Adicionar "Equipe" na sidebar (Cadastros, só admin)**

Em `components/shell/nav-items.tsx`, adicionar `UserCog` ao import de ícones (linha do `import { ... } from 'lucide-react'`):

```tsx
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
  UserCog,
  type LucideIcon,
} from 'lucide-react'
```

Adicionar a constante `ITEM_EQUIPE`, logo depois de `GRUPO_CADASTROS`:

```tsx
const ITEM_EQUIPE: Item = { href: '/equipe', label: 'Equipe', icon: UserCog }
```

Em `NavConteudo`, no trecho que monta os itens de cada grupo, injetar `ITEM_EQUIPE` no grupo Cadastros quando `isAdmin` (mesmo bypass de `itensVisiveis` que `ITEM_CONFIGURACOES` já usa hoje):

```tsx
// Grupo: filtra itens pelo cargo; some se não sobrar nenhum.
const itens = bloco.grupo.itens.filter((i) =>
  itemVisivel(i.href, itensVisiveis),
)
if (bloco.grupo.titulo === 'Cadastros' && isAdmin) {
  itens.push(ITEM_EQUIPE)
}
if (itens.length === 0) return null
```

Não é preciso adicionar `/equipe` no `NAV_CATALOGO` (`lib/nav-catalogo.ts`): assim como `/configuracoes` hoje, `rotaPermitida` já bloqueia qualquer rota que não esteja em `cargo.itens_visiveis` de um cargo não-admin, e `/equipe` nunca vai estar lá (não é oferecida como checkbox em Cargos).

- [ ] **Step 5: Verificar tipos, lint e build**

Run: `npx tsc --noEmit && npx eslint . --quiet && npx next build`
Expected: sem erros.

- [ ] **Step 6: Verificação manual**

`npm run dev`, logar como admin: `/equipe` mostra a lista de pessoas + botão "Convidar" funcionando (gera link, copia). Logar como não-admin (ou inspecionar `itemVisivel`): item "Equipe" não aparece em Cadastros, e acessar `/equipe` direto pela URL redireciona pro dashboard.

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/equipe/page.tsx" "app/(app)/configuracoes/page.tsx" components/shell/nav-items.tsx
git commit -m "feat: tela Equipe (convite de time) substitui Usuarios, entra em Cadastros"
git push
```

---

### Task 4: Resgate do convite + fechar cadastro público

**Files:**
- Create: `app/(auth)/convite/[token]/page.tsx`
- Create: `app/(auth)/convite/[token]/ConviteForm.tsx`
- Modify: `app/(auth)/login/page.tsx` (remove aba/modo "Criar conta")

**Interfaces:**
- Consumes: `consultarConvite`, `resgatarConvite` (de `lib/actions/convites.ts`, Task 2); `createClient` de `@/lib/supabase/client` (já existe, usado hoje em `/login`).

- [ ] **Step 1: Criar a página do convite**

```tsx
// app/(auth)/convite/[token]/page.tsx
import { consultarConvite } from '@/lib/actions/convites'
import { ConviteForm } from './ConviteForm'

export default async function ConvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const resultado = await consultarConvite(token)

  if (!resultado.valido) {
    return (
      <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-4">
        <div className="relative w-full max-w-sm rounded-xl border border-border bg-surface p-6 text-center shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)]">
          <h1 className="text-lg font-semibold text-text">Convite inválido</h1>
          <p className="mt-2 text-sm text-text-muted">
            Este convite não é mais válido. Peça um novo convite pra quem te chamou.
          </p>
        </div>
      </div>
    )
  }

  return (
    <ConviteForm
      token={token}
      cargoNome={resultado.cargoNome}
      localNome={resultado.localNome}
    />
  )
}
```

- [ ] **Step 2: Criar o formulário do convite**

```tsx
// app/(auth)/convite/[token]/ConviteForm.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { resgatarConvite } from '@/lib/actions/convites'

export function ConviteForm({
  token,
  cargoNome,
  localNome,
}: {
  token: string
  cargoNome: string
  localNome: string
}) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const router = useRouter()

  async function criarConta() {
    if (loading) return
    setErro(null)
    if (!nome.trim() || !email.trim() || senha.length < 6) {
      setErro('Preencha nome, email e uma senha com ao menos 6 caracteres.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
    })
    if (error) {
      setLoading(false)
      setErro(error.message)
      return
    }
    if (!data.session) {
      setLoading(false)
      setErro('Não foi possível criar a sessão. Confirme o email e faça login depois.')
      return
    }
    const resultado = await resgatarConvite(token, nome.trim())
    setLoading(false)
    if ('error' in resultado) {
      setErro(resultado.error)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60rem 40rem at 50% -10%, rgba(14,154,167,0.16), transparent 60%), radial-gradient(38rem 28rem at 108% 108%, rgba(200,148,26,0.08), transparent 55%)',
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-7 text-center">
          <h1 className="font-display text-2xl font-bold tracking-tight text-text">
            DepSys
          </h1>
          <p className="mt-1.5 text-sm text-text-muted">
            Convite para {localNome} · {cargoNome}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)]">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="nome" className="text-sm font-medium text-text">
                Nome
              </label>
              <input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
                className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-text placeholder:text-text-muted/60 u-motion outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium text-text">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && criarConta()}
                placeholder="voce@email.com"
                className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-text placeholder:text-text-muted/60 u-motion outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="senha" className="text-sm font-medium text-text">
                Senha
              </label>
              <input
                id="senha"
                type="password"
                autoComplete="new-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && criarConta()}
                placeholder="••••••••"
                className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-text placeholder:text-text-muted/60 u-motion outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
              <p className="text-[11px] text-text-muted">Mínimo 6 caracteres.</p>
            </div>

            {erro && (
              <p className="text-xs text-err" role="alert">
                {erro}
              </p>
            )}

            <button
              type="button"
              onClick={criarConta}
              disabled={loading}
              className="mt-1 flex h-10 items-center justify-center gap-2 rounded-md bg-brand text-sm font-medium text-white u-motion active:scale-[0.98] hover:bg-brand-strong disabled:opacity-70 disabled:active:scale-100"
            >
              {loading && <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />}
              {loading ? 'Criando...' : 'Criar minha conta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Fechar o cadastro público em `/login`**

Substituir todo o conteúdo de `app/(auth)/login/page.tsx` por:

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const router = useRouter()

  async function entrar() {
    if (loading) return
    setErro(null)
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    })
    if (error) {
      setErro('Email ou senha incorretos.')
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60rem 40rem at 50% -10%, rgba(14,154,167,0.16), transparent 60%), radial-gradient(38rem 28rem at 108% 108%, rgba(200,148,26,0.08), transparent 55%)',
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-7 text-center">
          <h1 className="font-display text-2xl font-bold tracking-tight text-text">
            DepSys
          </h1>
          <p className="mt-1.5 text-sm text-text-muted">
            R$ Depósito · Império Salles
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)]">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium text-text">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && entrar()}
                placeholder="voce@deposito.com.br"
                className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-text placeholder:text-text-muted/60 u-motion outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="senha" className="text-sm font-medium text-text">
                Senha
              </label>
              <input
                id="senha"
                type="password"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && entrar()}
                placeholder="••••••••"
                className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-text placeholder:text-text-muted/60 u-motion outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
            </div>

            {erro && (
              <p className="text-xs text-err" role="alert">
                {erro}
              </p>
            )}

            <button
              type="button"
              onClick={entrar}
              disabled={loading}
              className="mt-1 flex h-10 items-center justify-center gap-2 rounded-md bg-brand text-sm font-medium text-white u-motion active:scale-[0.98] hover:bg-brand-strong disabled:opacity-70 disabled:active:scale-100"
            >
              {loading && <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />}
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-text-muted">
          Estoque, vendas e financeiro dos seus pontos de venda
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verificar tipos, lint e build**

Run: `npx tsc --noEmit && npx eslint . --quiet && npx next build`
Expected: sem erros.

- [ ] **Step 5: Verificação manual**

`npm run dev`. Em `/equipe`, gerar um convite pra um cargo não-admin + um local. Abrir o link gerado numa aba anônima: mostra "Convite para {local} · {cargo}", preenche nome/email/senha, cria a conta, entra direto no dashboard. Abrir o mesmo link de novo: mostra "Convite inválido" (já foi usado). Confirmar que `/login` não mostra mais opção de criar conta.

- [ ] **Step 6: Commit**

```bash
git add "app/(auth)/convite" "app/(auth)/login/page.tsx"
git commit -m "feat: resgate de convite (cria conta com cargo/local ja definidos) e fecha cadastro publico"
git push
```

---

### Task 5: Escopo por local (enforcement)

**Files:**
- Modify: `lib/local.ts` (`getLocalAtivo` passa a respeitar `local_id` do profile)
- Modify: `lib/actions/local.ts` (`trocarLocal` rejeita explicitamente troca pra fora do local permitido)
- Modify: `app/(app)/layout.tsx` (filtra a lista de locais mostrada no seletor)
- Modify: `components/shell/SeletorLocal.tsx` (esconde o dropdown quando só há 1 local disponível)

**Interfaces:**
- Consumes: `getCargoUsuario`, `getLocalIdUsuario` (de `lib/permissoes.ts`, Task 2).
- Produces: `getLocalAtivo()` continua com a mesma assinatura (`Promise<Local>`), mas agora nunca retorna um local fora do permitido pra quem tem `local_id` restrito.

- [ ] **Step 1: Fazer `getLocalAtivo` respeitar a restrição**

Em `lib/local.ts`, adicionar o import e ajustar a função (o cookie continua sendo lido, mas perde a palavra final quando há restrição):

```ts
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/server'
import { getCargoUsuario, getLocalIdUsuario } from '@/lib/permissoes'

export type Local = { id: string; nome: string; slug: string }

const COOKIE_LOCAL = 'local_ativo'
const SLUG_PADRAO = 'deposito'

export async function listarLocais(): Promise<Local[]> {
  const supabase = await createServiceClient()
  const { data } = await supabase
    .from('locais')
    .select('id, nome, slug')
    .eq('ativo', true)
    .order('slug')
  return ((data ?? []) as Local[])
}

// Local ativo da sessao. Se o usuario tem local_id fixo (convite/nao-admin),
// esse local sempre vence, ignorando o cookie — fecha a brecha de trocar de
// local direto pela action, sem precisar rejeitar a escrita do cookie em si.
export async function getLocalAtivo(): Promise<Local> {
  const locais = await listarLocais()

  const [cargo, localIdRestrito] = await Promise.all([
    getCargoUsuario(),
    getLocalIdUsuario(),
  ])
  const restrito = !cargo?.admin && localIdRestrito ? localIdRestrito : null
  if (restrito) {
    const forcado = locais.find((l) => l.id === restrito)
    if (forcado) return forcado
  }

  const store = await cookies()
  const slug = store.get(COOKIE_LOCAL)?.value ?? SLUG_PADRAO
  const local =
    locais.find((l) => l.slug === slug) ??
    locais.find((l) => l.slug === SLUG_PADRAO) ??
    locais[0]
  // Se a tabela locais não retornou nada (ex: RLS ou erro de rede), falha limpo.
  if (!local) throw new Error('Nenhum local encontrado. Verifique a tabela locais e as políticas RLS.')
  return local
}

// Atalho quando so o id importa (filtros de query).
export async function getLocalAtivoId(): Promise<string> {
  return (await getLocalAtivo()).id
}
```

- [ ] **Step 2: Rejeitar explicitamente a troca pra fora do local permitido**

Em `lib/actions/local.ts`, checar a restrição antes de gravar o cookie (mensagem de erro clara, em vez de deixar a gravação seguir e só ser ignorada depois por `getLocalAtivo`):

```ts
'use server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { listarLocais } from '@/lib/local'
import { getCargoUsuario, getLocalIdUsuario } from '@/lib/permissoes'

// Troca o local ativo (Deposito / Imperio Salles). Persiste em cookie por 1 ano.
export async function trocarLocal(slug: string) {
  const [cargo, localIdRestrito] = await Promise.all([
    getCargoUsuario(),
    getLocalIdUsuario(),
  ])
  if (!cargo?.admin && localIdRestrito) {
    const locais = await listarLocais()
    const alvo = locais.find((l) => l.slug === slug)
    if (!alvo || alvo.id !== localIdRestrito) {
      return { error: 'Sua conta só tem acesso a um local.' }
    }
  }

  const store = await cookies()
  store.set('local_ativo', slug, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  // Revalida tudo: cada tela passa a mostrar os dados do novo local.
  revalidatePath('/', 'layout')
  return { success: true }
}
```

- [ ] **Step 3: Filtrar a lista de locais mostrada no seletor**

Em `app/(app)/layout.tsx`, importar `getLocalIdUsuario` e usar pra filtrar `locais` antes de passar pro `Topbar`/`Sidebar`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Sidebar } from '@/components/shell/Sidebar'
import { Topbar } from '@/components/shell/Topbar'
import { PageTransition } from '@/components/shell/PageTransition'
import { Toaster } from 'sonner'
import { listarLocais, getLocalAtivo } from '@/lib/local'
import { getCargoUsuario, getNomePerfil, getLocalIdUsuario } from '@/lib/permissoes'
import { rotaPermitida } from '@/lib/nav-catalogo'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [locaisTodos, localAtivo, cargo, nomePerfil, localIdUsuario] = await Promise.all([
    listarLocais(),
    getLocalAtivo(),
    getCargoUsuario(),
    getNomePerfil(),
    getLocalIdUsuario(),
  ])

  // Trava de rota por cargo (permissão real, não só esconder botão). O pathname
  // vem do header setado no middleware. Fail-open: cargo nulo libera tudo.
  const pathname = (await headers()).get('x-pathname') ?? ''
  if (pathname && !rotaPermitida(pathname, cargo)) {
    redirect('/dashboard')
  }

  // null = sem restrição (admin ou fail-open) → sidebar mostra tudo.
  const itensVisiveis = !cargo || cargo.admin ? null : cargo.itens_visiveis
  const isAdmin = cargo?.admin ?? false

  // Não-admin com local fixo só vê aquele local no seletor do topo.
  const locais =
    !isAdmin && localIdUsuario
      ? locaisTodos.filter((l) => l.id === localIdUsuario)
      : locaisTodos

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar localNome={localAtivo.nome} itensVisiveis={itensVisiveis} isAdmin={isAdmin} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          email={user.email ?? 'usuário'}
          nome={nomePerfil ?? user.email?.split('@')[0] ?? 'Usuário'}
          locais={locais}
          localSlug={localAtivo.slug}
          localNome={localAtivo.nome}
          itensVisiveis={itensVisiveis}
          isAdmin={isAdmin}
        />
        <main className="min-w-0 flex-1 overflow-x-hidden px-6 py-5">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <Toaster position="top-right" theme="dark" richColors />
    </div>
  )
}
```

- [ ] **Step 4: Esconder o dropdown quando só há 1 local**

Em `components/shell/SeletorLocal.tsx`, adicionar um retorno antecipado logo depois de calcular `ativo`:

```tsx
  const ativo = locais.find((l) => l.slug === ativoSlug) ?? locais[0]
  if (!ativo) return null
  const IconeAtivo = ICONE[ativo.slug] ?? Store

  // Só 1 local disponível: mostra o nome, sem dropdown de troca.
  if (locais.length <= 1) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface py-1.5 pl-2.5 pr-3 text-sm">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
          <IconeAtivo className="size-3.5" strokeWidth={1.5} />
        </span>
        <span className="max-w-[140px] truncate font-medium text-text">{ativo.nome}</span>
      </div>
    )
  }

  function selecionar(slug: string) {
```

(o resto da função — `selecionar` e o JSX do dropdown completo — continua exatamente igual, só ganhou esse retorno antecipado antes dele).

- [ ] **Step 5: Verificar tipos, lint e build**

Run: `npx tsc --noEmit && npx eslint . --quiet && npx next build`
Expected: sem erros.

- [ ] **Step 6: Verificação manual**

Usar o convite gerado no Task 4 (conta nova, local X): confirmar que o seletor do topo mostra só o nome do local, sem dropdown pra trocar. Logar como admin: seletor continua mostrando os dois locais e trocando normalmente. Testar chamar `trocarLocal('deposito')` a partir de uma conta escopada pro Império Salles (via devtools/console): a action retorna `{ error: 'Sua conta só tem acesso a um local.' }` e o local continua o mesmo.

- [ ] **Step 7: Commit**

```bash
git add lib/local.ts "lib/actions/local.ts" "app/(app)/layout.tsx" components/shell/SeletorLocal.tsx
git commit -m "feat: escopo por local para contas convidadas (seletor + getLocalAtivo + trocarLocal)"
git push
```

---

## Testes finais (após as 5 tasks)

- [ ] `npx tsc --noEmit`, `npx eslint . --quiet`, `npx next build` sem erros.
- [ ] Fluxo completo: admin gera convite (cargo não-admin + Império Salles) → copia link → aba anônima → cria conta → entra direto no dashboard do Império Salles, com o cargo certo, e sem opção de trocar de local.
- [ ] Convite usado não funciona de novo; convite revogado antes de usar também não funciona.
- [ ] `/login` só tem "Entrar", sem aba de cadastro.
- [ ] `/equipe` só abre pra admin; item "Equipe" na sidebar só aparece pra admin, dentro de Cadastros.
- [ ] Conta admin continua trocando entre os dois locais normalmente.
