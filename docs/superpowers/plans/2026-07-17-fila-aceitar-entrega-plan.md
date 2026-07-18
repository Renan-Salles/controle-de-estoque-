# Fila de entregas pra aceitar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Venda de entrega pode ser registrada sem escolher entregador; quando fica sem ninguém, ela vira uma entrega disponível que qualquer pessoa com cargo Entregador do mesmo local pode aceitar (primeiro que aceitar, pega), com um jeito de admin/funcionário atribuir na mão como escape.

**Architecture:** Trava de concorrência via `UPDATE ... WHERE entregador_id IS NULL` numa função Postgres `security definer` (mesmo padrão de `criar_convite`). Fila de disponíveis é uma query nova espelhando `listarMinhasEntregas()` já existente. UI reaproveita `CardEntrega` (ganha uma prop `acoes` pra trocar o rodapé de botões) e o `Select` de entregador já existente em `FormSaida.tsx`.

**Tech Stack:** Next.js 16 App Router, React 19 (Server Components + client islands com `useTransition`), Supabase Postgres (função `security definer`), Zod.

## Global Constraints

- Português correto, com acentos — nunca simplificar pra ASCII.
- Sem travessão (—) em copy voltado pro usuário (labels, toasts, textos de tela).
- Sem suite de testes automatizada — verificação sempre por `npx tsc --noEmit`, `npx eslint . --quiet`, `npx next build` e teste manual no browser.
- Todo server action que lê/grava dado operacional passa por `getLocalAtivoId()` — nunca hardcoda o local.
- Escrita privilegiada que precisa rodar independente de quem chama usa função Postgres `security definer` (não `createServiceClient()` sozinho, que não bypassa RLS com sessão ativa).
- Commits pequenos, um por unidade de trabalho, sempre com `git push` no final.

---

### Task 1: Venda de entrega sem entregador obrigatório

**Files:**
- Modify: `components/movimentacao/FormSaida.tsx:191-194,214,407`
- Modify: `lib/actions/pedidos.ts:62-64`

**Interfaces:**
- Consumes: nada novo.
- Produces: `registrarVenda()` aceita `tipo_fulfillment: 'entrega'` com `entregador_id: null`. Contrato de `registrarVenda` não muda (já aceitava `entregador_id: z.string().uuid().nullable().optional()` no `VendaSchema`).

- [ ] **Step 1: Remover a validação client-side em `FormSaida.tsx`**

Em `components/movimentacao/FormSaida.tsx`, dentro de `registrar()`, remova o bloco:

```tsx
    if (tipoFulfillment === 'entrega' && !entregadorId) {
      toast.error('Escolha quem vai entregar')
      return
    }
```

(fica só o `if` de fiado antes e o `setRegistrando(true)` depois, sem nada no meio).

- [ ] **Step 2: Normalizar `entregadorId` vazio pra `null` no payload**

Na mesma função, troque:

```tsx
      entregador_id: tipoFulfillment === 'entrega' ? entregadorId : null,
```

por:

```tsx
      entregador_id: tipoFulfillment === 'entrega' && entregadorId ? entregadorId : null,
```

(sem isso, uma string vazia `''` chegaria no Zod `z.string().uuid()` e quebraria a validação no servidor, já que `''` não é nulo mas também não é um UUID válido).

- [ ] **Step 3: Remover a trava do botão "Registrar"**

Troque:

```tsx
  const podeRegistrar =
    itens.length > 0 &&
    !registrando &&
    !(formaPagamento === 'fiado' && !cliente) &&
    !(tipoFulfillment === 'entrega' && !entregadorId)
```

por:

```tsx
  const podeRegistrar =
    itens.length > 0 &&
    !registrando &&
    !(formaPagamento === 'fiado' && !cliente)
```

- [ ] **Step 4: Remover a validação server-side em `registrarVenda`**

Em `lib/actions/pedidos.ts`, dentro de `registrarVenda`, remova:

```ts
  if (parsed.data.tipo_fulfillment === 'entrega' && !parsed.data.entregador_id) {
    return { error: 'Escolha quem vai entregar' }
  }
```

- [ ] **Step 5: Verificar tipos e lint**

Run: `cd ~/Projects/Depsys && npx tsc --noEmit && npx eslint components/movimentacao/FormSaida.tsx lib/actions/pedidos.ts --quiet`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
cd ~/Projects/Depsys
git add components/movimentacao/FormSaida.tsx lib/actions/pedidos.ts
git commit -m "feat: permite registrar venda de entrega sem escolher entregador"
```

---

### Task 2: Aceitar entrega (função Postgres + server actions)

**Files:**
- Create: `supabase/migrations/2026-07-17-aceitar-entrega.sql`
- Modify: `lib/actions/pedidos.ts` (adiciona `aceitarEntrega` e `listarEntregasDisponiveis` no final do arquivo)

**Interfaces:**
- Consumes: `getLocalAtivoId()` de `lib/local.ts` (já importado em `pedidos.ts`); `createClient`/`createServiceClient` de `@/lib/supabase/server` (já importados); `revalidatePath` de `next/cache` (já importado).
- Produces:
  - `aceitarEntrega(pedidoId: string): Promise<{ error: string } | { success: true }>`
  - `listarEntregasDisponiveis(): Promise<Array<{ id: string; numero_pedido: number; total: number; forma_pagamento: string; pago: boolean; data_pedido: string; saiu_entrega_em: string | null; endereco_entrega: unknown; clientes: unknown }>>` — mesmo shape de retorno de `listarMinhasEntregas()`, consumido pela Task 3.

- [ ] **Step 1: Escrever a migration**

Crie `supabase/migrations/2026-07-17-aceitar-entrega.sql`:

```sql
-- Fila de entregas: entrega criada sem entregador_id fica disponivel pra
-- qualquer pessoa com cargo Entregador do mesmo local aceitar. security
-- definer porque o entregador precisa escrever numa linha de pedidos que
-- ainda nao e dele (RLS normal nao deixa, e createServiceClient() nao
-- bypassa RLS com sessao ativa -- mesmo padrao de criar_convite).
-- A trava de concorrencia (dois aceitando ao mesmo tempo) e o proprio
-- WHERE entregador_id IS NULL: so um UPDATE acha a linha.
create or replace function public.aceitar_entrega(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cargo_entregador boolean;
  v_linhas int;
begin
  select exists (
    select 1 from public.profiles p
    join public.cargos c on c.id = p.cargo_id
    where p.id = auth.uid() and c.nome = 'Entregador'
  ) into v_cargo_entregador;

  if not v_cargo_entregador then
    raise exception 'Só quem tem cargo Entregador pode aceitar entregas';
  end if;

  update public.pedidos
  set entregador_id = auth.uid()
  where id = p_pedido_id
    and entregador_id is null
    and tipo_fulfillment = 'entrega'
    and status = 'concluida'
    and local_id = (select local_id from public.profiles where id = auth.uid());

  get diagnostics v_linhas = row_count;
  if v_linhas = 0 then
    raise exception 'Essa entrega já foi aceita por outra pessoa (ou não está mais disponível)';
  end if;
end;
$$;
```

- [ ] **Step 2: Aplicar a migration**

Run:

```bash
cd ~/Projects/Depsys
node -e "require('dotenv').config({path:'.env.local'}); const {Pool}=require('pg'); const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); pool.query(require('fs').readFileSync('./supabase/migrations/2026-07-17-aceitar-entrega.sql','utf8')).then(()=>{console.log('ok');pool.end()}).catch(e=>{console.error(e.message);pool.end()})"
```

Expected: `ok` (ignore a linha `tip:` do dotenv antes disso).

- [ ] **Step 3: Adicionar `aceitarEntrega` e `listarEntregasDisponiveis` em `lib/actions/pedidos.ts`**

No final do arquivo `lib/actions/pedidos.ts`, adicione:

```ts
// Entregador aceita uma entrega da fila (sem ninguem designado ainda).
// A trava de concorrencia mora na funcao SQL security definer.
export async function aceitarEntrega(pedidoId: string) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('aceitar_entrega', { p_pedido_id: pedidoId })
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { success: true }
}

// Entregas de "entrega" sem entregador ainda, do local ativo -- a fila que
// a tela do Entregador mostra pra aceitar. Mesmo shape de listarMinhasEntregas().
export async function listarEntregasDisponiveis() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const localId = await getLocalAtivoId()
  const { data, error } = await supabase
    .from('pedidos')
    .select(
      'id, numero_pedido, total, forma_pagamento, pago, data_pedido, saiu_entrega_em, endereco_entrega, clientes(nome, telefone, endereco)',
    )
    .eq('local_id', localId)
    .is('entregador_id', null)
    .eq('tipo_fulfillment', 'entrega')
    .eq('status', 'concluida')
    .is('concluido_em', null)
    .order('data_pedido', { ascending: false })
  if (error) throw error
  return data ?? []
}
```

- [ ] **Step 4: Verificar tipos e lint**

Run: `cd ~/Projects/Depsys && npx tsc --noEmit && npx eslint lib/actions/pedidos.ts --quiet`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/Depsys
git add supabase/migrations/2026-07-17-aceitar-entrega.sql lib/actions/pedidos.ts
git commit -m "feat: funcao aceitar_entrega + listarEntregasDisponiveis/aceitarEntrega"
```

---

### Task 3: Fila "Disponíveis pra aceitar" na tela do Entregador

**Files:**
- Modify: `components/entregador/CardEntrega.tsx`
- Create: `components/entregador/BotaoAceitarEntrega.tsx`
- Modify: `components/entregador/TelaEntregador.tsx`

**Interfaces:**
- Consumes: `listarEntregasDisponiveis()` e `aceitarEntrega(pedidoId: string)` da Task 2; `EntregaResumo` (tipo já existente em `CardEntrega.tsx`).
- Produces: `CardEntrega({ entrega: EntregaResumo, acoes?: React.ReactNode })` — quando `acoes` é passado, substitui o bloco de `<FulfillmentAcoes>`. `BotaoAceitarEntrega({ pedidoId: string })`.

- [ ] **Step 1: `CardEntrega` ganha a prop `acoes`**

Em `components/entregador/CardEntrega.tsx`, troque a assinatura:

```tsx
export function CardEntrega({ entrega }: { entrega: EntregaResumo }) {
```

por:

```tsx
export function CardEntrega({
  entrega,
  acoes,
}: {
  entrega: EntregaResumo
  /** Quando passado, substitui o bloco padrao de FulfillmentAcoes no rodape. */
  acoes?: React.ReactNode
}) {
```

E troque o bloco final:

```tsx
        {/* Proximo passo do fluxo em destaque */}
        <div className="mt-3">
          <FulfillmentAcoes
            pedidoId={entrega.id}
            tipoFulfillment="entrega"
            pago={entrega.pago}
            concluidoEm={null}
            saiuEntregaEm={entrega.saiu_entrega_em}
            empilhado
          />
        </div>
```

por:

```tsx
        {/* Proximo passo do fluxo em destaque */}
        <div className="mt-3">
          {acoes ?? (
            <FulfillmentAcoes
              pedidoId={entrega.id}
              tipoFulfillment="entrega"
              pago={entrega.pago}
              concluidoEm={null}
              saiuEntregaEm={entrega.saiu_entrega_em}
              empilhado
            />
          )}
        </div>
```

- [ ] **Step 2: Criar `BotaoAceitarEntrega.tsx`**

Crie `components/entregador/BotaoAceitarEntrega.tsx`:

```tsx
'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, PackageCheck } from 'lucide-react'
import { aceitarEntrega } from '@/lib/actions/pedidos'

export function BotaoAceitarEntrega({ pedidoId }: { pedidoId: string }) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()

  function aceitar() {
    startTransition(async () => {
      const resultado = await aceitarEntrega(pedidoId)
      if (resultado.error) {
        toast.error(resultado.error)
        router.refresh()
        return
      }
      toast.success('Entrega aceita! Já está em "Minhas entregas".')
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={aceitar}
      disabled={pendente}
      className="u-motion inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-brand-strong disabled:pointer-events-none disabled:opacity-50 active:scale-[0.99]"
    >
      {pendente ? (
        <>
          <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          Aceitando...
        </>
      ) : (
        <>
          <PackageCheck className="size-4" strokeWidth={1.75} />
          Aceitar entrega
        </>
      )}
    </button>
  )
}
```

- [ ] **Step 3: `TelaEntregador.tsx` busca e mostra a fila**

Em `components/entregador/TelaEntregador.tsx`, adicione o import no topo:

```tsx
import { listarMinhasEntregas, listarEntregasDisponiveis } from '@/lib/actions/pedidos'
```

(substitui a linha `import { listarMinhasEntregas } from '@/lib/actions/pedidos'` já existente)

E adicione também:

```tsx
import { BotaoAceitarEntrega } from './BotaoAceitarEntrega'
```

No `Promise.all`, troque:

```tsx
  const [entregasRaw, local, nome, turnoAtivo, tempoMedioMin] = await Promise.all([
    listarMinhasEntregas(),
    getLocalAtivo(),
    getNomePerfil(),
    meuTurnoAtivo(),
    meuTempoMedioEntrega(),
  ])
```

por:

```tsx
  const [entregasRaw, disponiveisRaw, local, nome, turnoAtivo, tempoMedioMin] = await Promise.all([
    listarMinhasEntregas(),
    listarEntregasDisponiveis(),
    getLocalAtivo(),
    getNomePerfil(),
    meuTurnoAtivo(),
    meuTempoMedioEntrega(),
  ])
```

Logo abaixo de `const entregas = entregasRaw as unknown as EntregaRaw[]`, adicione:

```tsx
  const disponiveis = disponiveisRaw as unknown as EntregaRaw[]
```

E, dentro do `<main>`, logo antes do bloco `<TurnoCard ... />` (ou seja, entre o cabeçalho de saudação e o `TurnoCard`), adicione a nova seção:

```tsx
        {disponiveis.length > 0 && (
          <div className="mt-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Disponíveis pra aceitar
            </p>
            <div className="mt-2 space-y-4">
              {disponiveis.map((e) => (
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
                  acoes={<BotaoAceitarEntrega pedidoId={e.id} />}
                />
              ))}
            </div>
          </div>
        )}
```

(precisa importar o tipo `EntregaResumo` também — já está importado junto de `CardEntrega` na linha `import { CardEntrega, type EntregaResumo } from './CardEntrega'`, então nenhum import novo aqui além dos dois já listados acima).

- [ ] **Step 4: Verificar tipos e lint**

Run: `cd ~/Projects/Depsys && npx tsc --noEmit && npx eslint components/entregador --quiet`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/Depsys
git add components/entregador/CardEntrega.tsx components/entregador/BotaoAceitarEntrega.tsx components/entregador/TelaEntregador.tsx
git commit -m "feat: fila de entregas disponiveis pra aceitar na tela do entregador"
```

---

### Task 4: Atribuir entregador na mão (admin/funcionário)

**Files:**
- Modify: `lib/actions/pedidos.ts` (adiciona `atribuirEntregadorManual`)
- Create: `components/pedido/AtribuirEntregadorForm.tsx`
- Modify: `app/(app)/pedidos/[id]/page.tsx`

**Interfaces:**
- Consumes: `listarEntregadoresElegiveis()` e `type UsuarioComCargo` de `@/lib/actions/cargos` (já existem, criados na sessão anterior); `getCargoUsuario()` de `@/lib/permissoes`.
- Produces: `listarEntregadoresElegiveis(localId?: string)` (assinatura muda nesta task); `atribuirEntregadorManual(pedidoId: string, entregadorId: string): Promise<{ error: string } | { success: true }>`; `AtribuirEntregadorForm({ pedidoId: string, entregadores: UsuarioComCargo[] })`.

- [ ] **Step 1: `listarEntregadoresElegiveis` aceita o local do pedido, não só o local ativo da sessão**

O admin pode estar navegando com "R$ Depósito" selecionado no topo e abrir um pedido do "Império Salles" — nesse caso a lista de entregadores tem que ser do local **do pedido**, não do cookie da sessão. Em `lib/actions/cargos.ts`, troque:

```ts
export async function listarEntregadoresElegiveis(): Promise<UsuarioComCargo[]> {
  const localId = await getLocalAtivoId()
```

por:

```ts
export async function listarEntregadoresElegiveis(localId?: string): Promise<UsuarioComCargo[]> {
  const local = localId ?? (await getLocalAtivoId())
```

E troque a referência a `localId` dentro do `.or(...)` logo abaixo por `local`:

```ts
    .or(`local_id.is.null,local_id.eq.${local}`)
```

`FormSaida.tsx` (chamada sem argumento, continua pegando o local ativo — é uma venda nova, local certo é o da sessão) não precisa de nenhuma mudança.

- [ ] **Step 2: Adicionar `atribuirEntregadorManual` em `lib/actions/pedidos.ts`**

Adicione o import de `getCargoUsuario` no topo do arquivo (junto dos outros imports):

```ts
import { getCargoUsuario } from '@/lib/permissoes'
```

E, no final do arquivo (depois de `listarEntregasDisponiveis` da Task 2), adicione:

```ts
// Escape manual: admin/funcionario atribui um entregador direto, sem
// passar pela fila (ex.: fila travada, entrega urgente). So funciona
// enquanto ninguem aceitou ainda (mesma defesa de corrida da funcao SQL).
export async function atribuirEntregadorManual(pedidoId: string, entregadorId: string) {
  const cargo = await getCargoUsuario()
  if (!cargo?.admin && cargo?.nome !== 'Funcionario') {
    return { error: 'Sem permissão' }
  }
  const s = await createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error, count } = await (s.from('pedidos') as any)
    .update({ entregador_id: entregadorId }, { count: 'exact' })
    .eq('id', pedidoId)
    .is('entregador_id', null)
  if (error) return { error: error.message }
  if (!count) return { error: 'Essa entrega já tem um entregador atribuído' }
  revalidatePath(`/pedidos/${pedidoId}`)
  return { success: true }
}
```

- [ ] **Step 3: Criar `AtribuirEntregadorForm.tsx`**

Crie `components/pedido/AtribuirEntregadorForm.tsx`:

```tsx
'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, UserPlus } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { atribuirEntregadorManual, type UsuarioComCargo } from '@/lib/actions/pedidos'

export function AtribuirEntregadorForm({
  pedidoId,
  entregadores,
}: {
  pedidoId: string
  entregadores: UsuarioComCargo[]
}) {
  const router = useRouter()
  const [entregadorId, setEntregadorId] = useState('')
  const [pendente, startTransition] = useTransition()

  function atribuir() {
    if (!entregadorId) {
      toast.error('Escolha quem vai entregar')
      return
    }
    startTransition(async () => {
      const resultado = await atribuirEntregadorManual(pedidoId, entregadorId)
      if (resultado.error) {
        toast.error(resultado.error)
        return
      }
      toast.success('Entregador atribuído.')
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={entregadorId} onValueChange={(v) => v && setEntregadorId(v)}>
        <SelectTrigger className="h-8 w-44 text-sm">
          <SelectValue placeholder="Atribuir entregador...">
            {(v: string) => entregadores.find((u) => u.id === v)?.nome ?? v}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {entregadores.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <button
        type="button"
        onClick={atribuir}
        disabled={pendente || !entregadorId}
        className="u-motion inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-primary-foreground hover:bg-brand-strong disabled:pointer-events-none disabled:opacity-50"
      >
        {pendente ? (
          <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
        ) : (
          <UserPlus className="size-3.5" strokeWidth={1.75} />
        )}
        Atribuir
      </button>
    </div>
  )
}
```

`atribuirEntregadorManual` e `type UsuarioComCargo` precisam ser exportados de `@/lib/actions/pedidos` pro import acima funcionar sem duplicar o tipo — troque o import de `UsuarioComCargo` em `lib/actions/pedidos.ts` (adicione junto dos outros imports no topo):

```ts
export type { UsuarioComCargo } from '@/lib/actions/cargos'
```

- [ ] **Step 4: Ligar no `app/(app)/pedidos/[id]/page.tsx`**

No topo do arquivo, adicione os imports:

```tsx
import { getCargoUsuario } from '@/lib/permissoes'
import { listarEntregadoresElegiveis } from '@/lib/actions/cargos'
import { AtribuirEntregadorForm } from '@/components/pedido/AtribuirEntregadorForm'
```

A query hoje não busca `local_id` do pedido — precisa dele pra passar pro
`listarEntregadoresElegiveis`, senão a lista viria escopada pelo local
ativo da sessão de quem está olhando (que pode ser diferente do local
real do pedido, se for admin navegando entre locais). Na `select(...)`
da query (linha começando com `.select(`\`id, numero_pedido, status,
...`)`), adicione `local_id` logo depois de `id, numero_pedido`:

```tsx
    .select(
      `id, numero_pedido, local_id, status, total, subtotal, data_pedido, forma_pagamento, valor_pago_agora, forma_pagamento_parcial, prazo_pagamento_dias, data_vencimento, observacoes, tipo_fulfillment, frete, pago, concluido_em, saiu_entrega_em, endereco_entrega, entregador:profiles!pedidos_entregador_id_fkey(nome, telefone), clientes(nome, telefone, endereco), pedido_itens(quantidade_pedida, preco_unitario, total, embalagem_nome, embalagem_unidades, produtos(nome, embalagem))`,
    )
```

E adicione `local_id: string` no tipo `VendaComRelacoes` (logo depois de
`numero_pedido: number`):

```ts
type VendaComRelacoes = {
  id: string
  numero_pedido: number
  local_id: string
  status: string
```

Dentro de `VendaDetailPage`, logo depois de `const venda = vendaRaw as unknown as VendaComRelacoes`, adicione:

```tsx
  const podeAtribuir =
    venda.tipo_fulfillment === 'entrega' && !venda.entregador && venda.status !== 'cancelada'
  const [cargo, entregadoresElegiveis] = podeAtribuir
    ? await Promise.all([getCargoUsuario(), listarEntregadoresElegiveis(venda.local_id)])
    : [null, []]
  const mostraAtribuir = podeAtribuir && (cargo?.admin || cargo?.nome === 'Funcionario')
```

E troque o trecho que hoje só mostra o nome:

```tsx
            {venda.tipo_fulfillment === 'entrega' && (
              <div className="flex items-center gap-2">
                <span>
                  <span className="text-text-muted">Entregador: </span>
                  {venda.entregador?.nome ?? '-'}
                </span>
                {linkAvisarEntregador && (
```

por:

```tsx
            {venda.tipo_fulfillment === 'entrega' && (
              <div className="flex items-center gap-2">
                {mostraAtribuir ? (
                  <AtribuirEntregadorForm pedidoId={venda.id} entregadores={entregadoresElegiveis} />
                ) : (
                  <span>
                    <span className="text-text-muted">Entregador: </span>
                    {venda.entregador?.nome ?? '-'}
                  </span>
                )}
                {linkAvisarEntregador && (
```

(o resto do bloco, `linkAvisarEntregador && (...)`, e o `</div>` que fecha, continuam exatamente como estão).

- [ ] **Step 5: Verificar tipos e lint**

Run: `cd ~/Projects/Depsys && npx tsc --noEmit && npx eslint lib/actions/cargos.ts lib/actions/pedidos.ts "components/pedido/AtribuirEntregadorForm.tsx" "app/(app)/pedidos/[id]/page.tsx" --quiet`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
cd ~/Projects/Depsys
git add lib/actions/cargos.ts lib/actions/pedidos.ts components/pedido/AtribuirEntregadorForm.tsx "app/(app)/pedidos/[id]/page.tsx"
git commit -m "feat: admin/funcionario atribui entregador na mao quando ninguem aceitou"
```

---

### Task 5: Build final, teste manual e push

**Files:** nenhum arquivo novo — só verificação.

- [ ] **Step 1: Build de produção**

Run: `cd ~/Projects/Depsys && npx next build`
Expected: build conclui (avisos de tipo `never` do Supabase são esperados, documentados no `CLAUDE.md`).

- [ ] **Step 2: Teste manual — venda de entrega sem entregador**

```bash
cd ~/Projects/Depsys && npm run dev
```

Logar com `sallesjoaquim111009@gmail.com` / `Deposito2026!`. Ir em Nova Movimentação > Saída, adicionar um produto com estoque, marcar tipo **Entrega**, **não escolher ninguém** em "Quem vai entregar", registrar. Confirmar que a venda salva normalmente (sem toast de erro) e que a tela do pedido mostra o seletor "Atribuir entregador" (já que não há admin/funcionário separado do dono da venda pra testar a diferença de permissão de verdade — anotar como limitação de teste, igual já registrado na spec).

- [ ] **Step 3: Teste manual — atribuir na mão**

Na tela do pedido dessa venda, usar o seletor "Atribuir entregador...", escolher alguém (ex.: Renan), clicar Atribuir. Confirmar toast de sucesso e que o nome aparece no lugar do seletor após o refresh.

- [ ] **Step 4: Limpar o pedido de teste do banco**

Seguir o mesmo processo já usado nesta sessão: pegar o `produto_id`/quantidade do pedido de teste, restaurar o estoque via `ajustar_estoque` com delta positivo, apagar `pedido_itens` e `pedidos` desse id, tudo numa transação `BEGIN`/`COMMIT` via `node -e` com `pg.Pool` (não deixar teste sujando o banco de produção).

- [ ] **Step 5: Push**

```bash
cd ~/Projects/Depsys
git push
```
