# Editar tudo do pedido + pagamento dividido — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir editar cliente, frete, desconto, tipo (balcão/entrega/
retirada), endereço e forma(s) de pagamento (incluindo pagamento dividido
entre 2 formas) numa venda já registrada — além dos itens, que já eram
editáveis desde `2026-07-18-editar-venda-plan.md`.

**Architecture:** Generaliza as colunas `valor_pago_agora`/
`forma_pagamento_parcial` (hoje só usadas pro caso "fiado parcial") pra
`valor_secundario`/`forma_pagamento_secundaria`, que passam a valer pra
qualquer par de 2 formas de pagamento diferentes, sejam elas à vista ou
fiado. Extrai dois componentes compartilhados (`SeletorPagamento`,
`CamposEntrega`) de `FormSaida.tsx` pra reusar em `EditarVendaForm.tsx` sem
duplicar a lógica de split/entrega — sem fundir os dois arquivos inteiros
num monólito só, já que `FormSaida.tsx` tem bastante coisa exclusiva de
venda nova (comanda em espera, QR Pix, atalhos de mais vendidos, tela de
sucesso) que não faz sentido em edição.

**Tech Stack:** Next.js 16 App Router, Server Actions, Supabase Postgres,
Zod, React 19 (client components controlados).

## Global Constraints

- Português correto, com acentos — nunca simplificar pra ASCII.
- Sem travessão (—) no copy voltado pro usuário (labels, toasts, dashboards).
- Um commit por task, sempre com `git push` no final (Task 5).
- `npx tsc --noEmit`, `npx eslint <arquivos-tocados> --quiet` e
  `npx next build` ao final de cada task.
- Toda venda/cliente de teste criado durante verificação manual é limpo do
  banco no final (estoque restaurado via `ajustar_estoque`, linhas de
  pedido/pedido_itens/contas_receber/clientes apagadas) — ver Task 5.
- A trava de elegibilidade de edição (`podeEditarPedido`: hoje, caixa não
  fechado) não muda nesse trabalho.

---

### Task 1: Renomear `valor_pago_agora`/`forma_pagamento_parcial` (migration + consumers), sem mudar comportamento

**Files:**
- Create: `supabase/migrations/2026-07-18-pagamento-dividido.sql`
- Modify: `lib/actions/pedidos.ts` (VendaSchema, `registrarVenda`,
  `buscarPedidoParaCupom`)
- Modify: `lib/actions/caixa.ts` (`resumoDoDia`)
- Modify: `lib/actions/financeiro.ts` (`buscarFormasPagamento`)
- Modify: `components/romaneio/CupomFiscal.tsx`
- Modify: `app/(app)/pedidos/[id]/page.tsx`
- Modify: `components/movimentacao/FormSaida.tsx` (só o payload enviado pra
  `registrarVenda`, não a UI)

**Interfaces:**
- Produces: colunas `pedidos.valor_secundario` (numeric) e
  `pedidos.forma_pagamento_secundaria` (varchar, nullable) substituindo
  `valor_pago_agora`/`forma_pagamento_parcial`. Comportamento idêntico ao
  de hoje (só funciona quando `forma_pagamento === 'fiado'`) — a
  generalização de regra vem na Task 2.

- [ ] **Step 1: Criar e aplicar a migration**

```sql
-- supabase/migrations/2026-07-18-pagamento-dividido.sql
-- Generaliza as colunas do "fiado parcial" pra qualquer split de 2 formas
-- de pagamento. Essa migration so renomeia; a regra de negocio que aceita
-- split fora do fiado vem no codigo da Task 2.
alter table public.pedidos
  rename column forma_pagamento_parcial to forma_pagamento_secundaria;
alter table public.pedidos
  rename column valor_pago_agora to valor_secundario;

alter table public.pedidos
  drop constraint if exists pedidos_forma_pagamento_parcial_check;
alter table public.pedidos
  add constraint pedidos_forma_pagamento_secundaria_check
  check (
    forma_pagamento_secundaria in
      ('dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'fiado')
    or forma_pagamento_secundaria is null
  );
```

Aplicar:

```bash
node -e "require('dotenv').config({path:'.env.local'}); const {Pool}=require('pg'); const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); pool.query(require('fs').readFileSync('./supabase/migrations/2026-07-18-pagamento-dividido.sql','utf8')).then(()=>{console.log('ok');pool.end()}).catch(e=>{console.error(e.message);pool.end()})"
```

Expected: `ok` impresso, sem erro.

- [ ] **Step 2: Renomear em `lib/actions/pedidos.ts`**

No `VendaSchema` (linhas 42-46), trocar:

```ts
  valor_pago_agora: z.number().min(0).optional(),
  forma_pagamento_parcial: z.enum(['dinheiro', 'pix', 'cartao_debito', 'cartao_credito']).optional(),
```

por:

```ts
  // Pagamento dividido em 2 formas (generalizado na Task 2 — por enquanto
  // so faz sentido quando forma_pagamento = 'fiado', igual antes).
  valor_secundario: z.number().min(0).optional(),
  forma_pagamento_secundaria: z.enum(['dinheiro', 'pix', 'cartao_debito', 'cartao_credito']).optional(),
```

Em `registrarVenda` (linhas 61-70), trocar:

```ts
  const valorPagoAgora = parsed.data.forma_pagamento === 'fiado' ? (parsed.data.valor_pago_agora ?? 0) : 0
  if (valorPagoAgora > 0 && !parsed.data.forma_pagamento_parcial) {
    return { error: 'Escolha em qual forma o valor pago agora entrou' }
  }
```

por:

```ts
  const valorSecundario = parsed.data.forma_pagamento === 'fiado' ? (parsed.data.valor_secundario ?? 0) : 0
  if (valorSecundario > 0 && !parsed.data.forma_pagamento_secundaria) {
    return { error: 'Escolha em qual forma o valor pago agora entrou' }
  }
```

E as demais ocorrências de `valorPagoAgora` no corpo da função (linhas 84,
162-163, 190-198) — trocar o nome da variável pra `valorSecundario` e os
campos do insert:

```ts
      valor_secundario: valorSecundario,
      forma_pagamento_secundaria: valorSecundario > 0 ? parsed.data.forma_pagamento_secundaria : null,
```

e no bloco de `contas_receber` (linha 191): `total - valorPagoAgora` →
`total - valorSecundario`, `valor_pago: valorPagoAgora` → `valor_pago:
valorSecundario`.

Em `buscarPedidoParaCupom` (linha 253), trocar `valor_pago_agora,
forma_pagamento_parcial` por `valor_secundario, forma_pagamento_secundaria`
na string do `.select(...)`.

- [ ] **Step 3: Renomear em `lib/actions/caixa.ts`**

Em `resumoDoDia` (linhas 27-50), trocar `valor_pago_agora,
forma_pagamento_parcial` no `.select(...)` por `valor_secundario,
forma_pagamento_secundaria`, o type `Linha` (`valor_pago_agora` →
`valor_secundario`, `forma_pagamento_parcial` → `forma_pagamento_secundaria`)
e no corpo de `soma`:

```ts
  const soma = (forma: string) =>
    rows.filter((r) => r.pago && r.forma_pagamento === forma).reduce((a, r) => a + Number(r.total ?? 0), 0) +
    rows
      .filter((r) => r.forma_pagamento === 'fiado' && r.forma_pagamento_secundaria === forma)
      .reduce((a, r) => a + Number(r.valor_secundario ?? 0), 0)
```

- [ ] **Step 4: Renomear em `lib/actions/financeiro.ts`**

Em `buscarFormasPagamento` (linhas 55, 67-81), mesmo rename: `select`,
type `Linha`, e:

```ts
    const parciais = rows.filter((r) => r.forma_pagamento === 'fiado' && r.forma_pagamento_secundaria === f)
    const valor =
      dela.reduce((a, r) => a + Number(r.total ?? 0), 0) +
      parciais.reduce((a, r) => a + Number(r.valor_secundario ?? 0), 0)
```

- [ ] **Step 5: Renomear em `components/romaneio/CupomFiscal.tsx`**

Na interface `CupomData` (linhas 12-13): `valor_pago_agora` →
`valor_secundario`, `forma_pagamento_parcial` → `forma_pagamento_secundaria`.

No JSX (linhas 218-227):

```tsx
        {data.forma_pagamento === 'fiado' && Number(data.valor_secundario ?? 0) > 0 ? (
          <>
            <div>
              Pago agora: {formatarReal(Number(data.valor_secundario))} (
              {rotuloPagamento(data.forma_pagamento_secundaria ?? '')})
            </div>
            <div>
              Fiado: {formatarReal(data.total - Number(data.valor_secundario))} ({prazo})
            </div>
          </>
        ) : (
```

- [ ] **Step 6: Renomear em `app/(app)/pedidos/[id]/page.tsx`**

No type `VendaComRelacoes` (linhas 35-36): `valor_pago_agora` →
`valor_secundario`, `forma_pagamento_parcial` → `forma_pagamento_secundaria`.

No `.select(...)` (linha 96): mesma troca de nomes.

No JSX (linhas 296-301):

```tsx
            venda.forma_pagamento === 'fiado' && Number(venda.valor_secundario) > 0 ? (
              <>
                {rotuloPagamento(venda.forma_pagamento_secundaria ?? '')} (pago agora):{' '}
                <Money valor={venda.valor_secundario} /> · Fiado:{' '}
                <Money valor={venda.total - Number(venda.valor_secundario)} />
              </>
            ) : (
```

- [ ] **Step 7: Renomear o payload em `components/movimentacao/FormSaida.tsx`**

No `registrarVenda(...)` (linhas 216-219), só o payload muda de nome (os
estados `valorPagoAgora`/`formaPagamentoParcial` continuam com esse nome
por enquanto — renomear os estados fica pra Task 2, junto da mudança de
comportamento visual):

```ts
      valor_secundario:
        formaPagamento === 'fiado' && pagouParte ? Number(valorPagoAgora) || 0 : undefined,
      forma_pagamento_secundaria:
        formaPagamento === 'fiado' && pagouParte ? formaPagamentoParcial : undefined,
```

- [ ] **Step 8: Verificar**

```bash
npx tsc --noEmit
npx eslint lib/actions/pedidos.ts lib/actions/caixa.ts lib/actions/financeiro.ts components/romaneio/CupomFiscal.tsx "app/(app)/pedidos/[id]/page.tsx" components/movimentacao/FormSaida.tsx --quiet
npx next build
```

Expected: sem erros. Teste manual: registrar uma venda fiado com "Cliente
já pagou uma parte?" marcado (fluxo que já existia) e conferir que o cupom,
`/pedidos/[id]`, `/caixa` e `/financeiro/formas-pagamento` mostram os
valores certos — comportamento idêntico a antes da migration. Limpar a
venda de teste do banco antes de prosseguir (estoque + pedido +
contas_receber).

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/2026-07-18-pagamento-dividido.sql lib/actions/pedidos.ts lib/actions/caixa.ts lib/actions/financeiro.ts components/romaneio/CupomFiscal.tsx "app/(app)/pedidos/[id]/page.tsx" components/movimentacao/FormSaida.tsx
git commit -m "refactor: renomeia valor_pago_agora/forma_pagamento_parcial pra valor_secundario/forma_pagamento_secundaria"
```

---

### Task 2: Generalizar o split pra qualquer par de formas (backend + FormSaida)

**Files:**
- Modify: `lib/actions/pedidos.ts` (`VendaSchema`, `registrarVenda`)
- Modify: `lib/pedido-labels.ts` (novo helper `somarPorForma` e
  `rotuloPagamentoVenda`)
- Modify: `lib/actions/caixa.ts` (`resumoDoDia` usa o helper)
- Modify: `lib/actions/financeiro.ts` (`buscarFormasPagamento` usa o helper)
- Modify: `components/romaneio/CupomFiscal.tsx` (exibição genérica)
- Modify: `app/(app)/pedidos/[id]/page.tsx` (exibição genérica)
- Modify: `components/movimentacao/FormSaida.tsx` (checkbox "Dividir em
  duas formas?" passa a existir pra qualquer forma principal, não só fiado)

**Interfaces:**
- Consumes: `pedidos.valor_secundario`/`forma_pagamento_secundaria` (Task 1)
- Produces: `somarPorForma(rows, formas)` em `lib/pedido-labels.ts`,
  `rotuloPagamentoVenda(venda)` em `lib/pedido-labels.ts` — usados pelas
  próximas tasks também.

- [ ] **Step 1: Helper `somarPorForma` e `rotuloPagamentoVenda` em `lib/pedido-labels.ts`**

Adicionar ao final do arquivo:

```ts
export type LinhaPagamento = {
  forma_pagamento: string
  total: number
  forma_pagamento_secundaria: string | null
  valor_secundario: number | null
}

// Distribui o total de cada pedido entre as formas informadas. Uma venda
// dividida entra com uma fatia em cada forma das duas pernas; a perna
// fiado nunca soma em dinheiro/pix/cartao_* (nao e dinheiro em caixa).
export function somarPorForma(
  rows: LinhaPagamento[],
  formas: readonly string[],
): { forma: string; valor: number; quantidade: number }[] {
  return formas.map((f) => {
    const principal = rows.filter(
      (r) => r.forma_pagamento === f && r.forma_pagamento_secundaria !== f,
    )
    const secundaria = rows.filter((r) => r.forma_pagamento_secundaria === f)
    const valor =
      principal.reduce((a, r) => {
        const valorPrincipal =
          r.forma_pagamento_secundaria != null
            ? r.total - (r.valor_secundario ?? 0)
            : r.total
        return a + valorPrincipal
      }, 0) + secundaria.reduce((a, r) => a + (r.valor_secundario ?? 0), 0)
    return { forma: f, valor, quantidade: principal.length + secundaria.length }
  })
}

// Rotulo combinado pra exibicao (cupom, detalhe do pedido): "Dinheiro" se
// nao ha split, "Dinheiro + Pix" se ha.
export function rotuloPagamentoVenda(venda: {
  forma_pagamento: string
  forma_pagamento_secundaria: string | null
}): string {
  if (!venda.forma_pagamento_secundaria) return rotuloPagamento(venda.forma_pagamento)
  return `${rotuloPagamento(venda.forma_pagamento)} + ${rotuloPagamento(venda.forma_pagamento_secundaria)}`
}
```

- [ ] **Step 2: Generalizar validação em `registrarVenda` (`lib/actions/pedidos.ts`)**

No `VendaSchema`, o enum de `forma_pagamento_secundaria` passa a incluir
`'fiado'`:

```ts
  valor_secundario: z.number().min(0).optional(),
  forma_pagamento_secundaria: z.enum(['dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'fiado']).optional(),
```

Logo após o parse (onde hoje calcula `valorSecundario` restrito a fiado),
trocar todo o bloco:

```ts
  const valorSecundario = parsed.data.forma_pagamento === 'fiado' ? (parsed.data.valor_secundario ?? 0) : 0
  if (valorSecundario > 0 && !parsed.data.forma_pagamento_secundaria) {
    return { error: 'Escolha em qual forma o valor pago agora entrou' }
  }
```

por:

```ts
  const formaSecundaria = parsed.data.forma_pagamento_secundaria ?? null
  const valorSecundario = formaSecundaria ? (parsed.data.valor_secundario ?? 0) : 0
  if (formaSecundaria) {
    if (formaSecundaria === parsed.data.forma_pagamento) {
      return { error: 'As duas formas de pagamento precisam ser diferentes' }
    }
    if (valorSecundario <= 0) {
      return { error: 'Informe o valor da segunda forma de pagamento' }
    }
  }
```

Depois de calcular `total` (linha ~83), adicionar a checagem que hoje é
implícita:

```ts
  if (valorSecundario >= total && formaSecundaria) {
    return { error: 'O valor da segunda forma não pode ser maior ou igual ao total da venda' }
  }
```

Substituir o bloco que determina a perna fiado e o check de `cliente_id`
(hoje espalhado: linha 64 `forma_pagamento === 'fiado' && !cliente_id`, e
linha 90 `if (forma_pagamento === 'fiado' && ...)`) por uma determinação
única logo depois dos checks acima:

```ts
  const pernaFiado =
    forma_pagamento === 'fiado'
      ? { valor: total - valorSecundario }
      : formaSecundaria === 'fiado'
        ? { valor: valorSecundario }
        : null
  if (pernaFiado && !parsed.data.cliente_id) {
    return { error: 'Selecione um cliente para venda fiado' }
  }
```

(Remover a checagem antiga `if (parsed.data.forma_pagamento === 'fiado' &&
!parsed.data.cliente_id)` logo no início da função, que fica redundante.)

No bloco de checagem de `limite_credito` (linhas 90-112), trocar a
condição `if (forma_pagamento === 'fiado' && parsed.data.cliente_id)` e o
uso de `total` por:

```ts
  if (pernaFiado && parsed.data.cliente_id) {
    const { data: cli } = await serviceClient
      .from('clientes')
      .select('nome, limite_credito')
      .eq('id', parsed.data.cliente_id)
      .single()
    const limite = Number((cli as { limite_credito?: number } | null)?.limite_credito ?? 0)
    if (limite > 0) {
      const { data: abertas } = await serviceClient
        .from('contas_receber')
        .select('valor, valor_pago')
        .eq('cliente_id', parsed.data.cliente_id)
        .eq('status', 'aberto')
      const divida = ((abertas ?? []) as { valor: number; valor_pago: number }[])
        .reduce((a, c) => a + Number(c.valor ?? 0) - Number(c.valor_pago ?? 0), 0)
      if (divida + pernaFiado.valor > limite) {
        const nome = (cli as { nome?: string } | null)?.nome ?? 'Cliente'
        return {
          error: `Fiado recusado: ${nome} já deve R$ ${divida.toFixed(2).replace('.', ',')} e o limite é R$ ${limite.toFixed(2).replace('.', ',')}. Receba o que está aberto ou aumente o limite no cadastro.`,
        }
      }
    }
  }
```

No insert de `pedidos` (linhas 162-163), trocar:

```ts
      valor_secundario: valorSecundario,
      forma_pagamento_secundaria: valorSecundario > 0 ? parsed.data.forma_pagamento_secundaria : null,
```

por:

```ts
      valor_secundario: formaSecundaria ? valorSecundario : 0,
      forma_pagamento_secundaria: formaSecundaria,
```

No bloco de criação de `contas_receber` (linhas 190-206), trocar a
condição `if (forma_pagamento === 'fiado')` e o cálculo do `restante` por:

```ts
  if (pernaFiado) {
    const restante = +(pernaFiado.valor).toFixed(2)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: errReceber } = await (serviceClient.from('contas_receber') as any).insert({
      pedido_id: venda.id,
      cliente_id: parsed.data.cliente_id,
      descricao: `Venda #${String(venda.numero_pedido).padStart(4, '0')}`,
      valor: restante,
      valor_pago: 0,
      status: restante <= 0 ? 'pago' : 'aberto',
      data_emissao: hoje,
      data_pagamento: restante <= 0 ? hoje : null,
      data_vencimento: dataVencimento,
      forma_pagamento: 'fiado',
    })
    if (errReceber) return { error: errReceber.message }
  }
```

(Antes, `valor: total` e `valor_pago: valorPagoAgora` faziam sentido
porque a perna fiado sempre era "o pedido inteiro menos o que já pagou".
Agora a perna fiado é só o valor dela mesma, e `valor_pago` sempre começa
em 0 já que o outro valor entrou por outra forma, não como pagamento
parcial dessa dívida.)

- [ ] **Step 3: Usar o helper em `resumoDoDia` (`lib/actions/caixa.ts`)**

Trocar o corpo (linhas 34-60) pelo helper:

```ts
  const rows = (data ?? []) as (Linha & { pago: boolean })[]
  const pagas = rows.filter((r) => r.pago)
  const resumo = somarPorForma(pagas, ['dinheiro', 'pix', 'cartao_debito', 'cartao_credito'])
  const porForma = (f: string) => resumo.find((r) => r.forma === f)?.valor ?? 0

  return {
    data: hoje,
    dinheiro: porForma('dinheiro'),
    pix: porForma('pix'),
    debito: porForma('cartao_debito'),
    credito: porForma('cartao_credito'),
    totalVendas: pagas.length,
  }
```

Adicionar o import: `import { somarPorForma } from '@/lib/pedido-labels'`.

Nota: `somarPorForma` já trata a perna fiado corretamente (não soma
dinheiro/pix/cartão pra ela), mas o filtro `pago` de hoje era só sobre a
linha inteira (`r.pago`) — como uma venda com `forma_pagamento = 'fiado'`
tem `pago = false` mesmo tendo uma perna à vista, o filtro `pagas` sozinho
excluiria a perna à vista de uma venda fiado+split. Ajustar: passar pro
helper todas as linhas `concluida` (sem filtrar por `pago`), e dentro do
helper a perna fiado já não soma nada mesmo — então o filtro `pago` deixa
de ser necessário pra generalizar corretamente. Usar:

```ts
  const rows = (data ?? []) as Linha[]
  const resumo = somarPorForma(rows, ['dinheiro', 'pix', 'cartao_debito', 'cartao_credito'])
  const porForma = (f: string) => resumo.find((r) => r.forma === f)?.valor ?? 0

  return {
    data: hoje,
    dinheiro: porForma('dinheiro'),
    pix: porForma('pix'),
    debito: porForma('cartao_debito'),
    credito: porForma('cartao_credito'),
    totalVendas: rows.length,
  }
```

E remover `pago` do `.select(...)` e do type `Linha` já que não é mais
usado (a query já filtra `status = 'concluida'`, que é o que importa).

- [ ] **Step 4: Usar o helper em `buscarFormasPagamento` (`lib/actions/financeiro.ts`)**

Trocar o corpo (linhas 73-84) por:

```ts
  const rows = (data ?? []) as LinhaPagamento[]
  const formas = ['dinheiro', 'pix', 'cartao_debito', 'cartao_credito'] as const
  const resumo = somarPorForma(rows, formas)
  const totalGeral = resumo.reduce((a, r) => a + r.valor, 0)
  const totalVendas = rows.length
```

Remover o type `Linha` local e importar `type LinhaPagamento` +
`somarPorForma` de `@/lib/pedido-labels`. Ajustar o `.select(...)` (linha
55) pra bater com `LinhaPagamento` (já bate: `forma_pagamento, total,
forma_pagamento_secundaria, valor_secundario` — remover `data_pedido` do
tipo já que não é usado no cálculo, mas manter no select pro filtro de
período que já existe).

- [ ] **Step 5: Exibição genérica no cupom e no detalhe do pedido**

Em `CupomFiscal.tsx`, trocar o bloco condicional (Step 5 da Task 1) por
uma versão que não depende mais de `forma_pagamento === 'fiado'`:

```tsx
        {data.forma_pagamento_secundaria ? (
          <>
            <div>
              {rotuloPagamento(data.forma_pagamento)}: {formatarReal(data.total - Number(data.valor_secundario ?? 0))}
            </div>
            <div>
              {rotuloPagamento(data.forma_pagamento_secundaria)}: {formatarReal(Number(data.valor_secundario ?? 0))}
              {data.forma_pagamento_secundaria === 'fiado' || data.forma_pagamento === 'fiado' ? ` (${prazo})` : ''}
            </div>
          </>
        ) : (
```

Em `app/(app)/pedidos/[id]/page.tsx`, mesma generalização (linhas 296-301):

```tsx
            venda.forma_pagamento_secundaria ? (
              <>
                {rotuloPagamento(venda.forma_pagamento)}:{' '}
                <Money valor={venda.total - Number(venda.valor_secundario)} /> ·{' '}
                {rotuloPagamento(venda.forma_pagamento_secundaria)}:{' '}
                <Money valor={venda.valor_secundario} />
              </>
            ) : (
```

- [ ] **Step 6: Generalizar o checkbox em `FormSaida.tsx`**

Renomear os estados (linha 146-150) pra refletir o novo significado geral:

```ts
  const [dividirPagamento, setDividirPagamento] = useState(false)
  const [valorSecundario, setValorSecundario] = useState('')
  const [formaPagamentoSecundaria, setFormaPagamentoSecundaria] = useState<
    'dinheiro' | 'pix' | 'cartao_debito' | 'cartao_credito' | 'fiado'
  >('pix')
```

(renomeado de `pagouParte`/`valorPagoAgora`/`formaPagamentoParcial`;
`useState('pix')` como default evita que a secundária comece igual à
principal, que é `'dinheiro'` por padrão.)

Mover o bloco JSX que hoje só aparece dentro de `formaPagamento ===
'fiado'` (linhas 959-1007, o checkbox + inputs) pra **fora** desse `if`,
mostrando sempre (independente da forma principal), e trocar o rótulo:

```tsx
          <label className="mt-2 flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={dividirPagamento}
              onChange={(e) => setDividirPagamento(e.target.checked)}
              className="size-4 rounded border-border"
            />
            Dividir em duas formas de pagamento?
          </label>

          {dividirPagamento && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="inline-flex h-9 flex-1 items-center rounded-lg border border-border bg-surface pl-2">
                  <span className="font-mono text-xs text-text-muted">R$</span>
                  <input
                    type="number"
                    min={0}
                    max={total}
                    step="0.01"
                    value={valorSecundario}
                    onChange={(e) => setValorSecundario(e.target.value)}
                    placeholder="0,00"
                    className="h-9 w-full bg-transparent px-2 text-sm text-text outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    aria-label="Valor da segunda forma"
                  />
                </div>
                <Select
                  value={formaPagamentoSecundaria}
                  onValueChange={(v) => v && setFormaPagamentoSecundaria(v as typeof formaPagamentoSecundaria)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue>{(v: string) => rotuloPagamento(v)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="pix">Pix</SelectItem>
                    <SelectItem value="cartao_debito">Cartão débito</SelectItem>
                    <SelectItem value="cartao_credito">Cartão crédito</SelectItem>
                    <SelectItem value="fiado">Fiado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-text-muted">
                Resta pagar em {rotuloPagamento(formaPagamento)}:{' '}
                {formatarReal(Math.max(total - (Number(valorSecundario) || 0), 0))}
                {(formaPagamento === 'fiado' || formaPagamentoSecundaria === 'fiado') &&
                  ` · vencimento em ${formatarData(addDias(hojeBrasil(), Number(prazoDias) || 0))}`}
              </p>
            </div>
          )}
```

O bloco `formaPagamento === 'fiado'` continua existindo só pro aviso "sem
cliente" e o campo de prazo (linhas 936-958), sem o checkbox que saiu de
lá. Ajustar `podeRegistrar` (linha 399-402) e o payload de `registrar`
(linhas 187-190, 216-219) pra:

```ts
  const cliente_obrigatorio =
    (formaPagamento === 'fiado' || (dividirPagamento && formaPagamentoSecundaria === 'fiado')) && !cliente
  const podeRegistrar = itens.length > 0 && !registrando && !cliente_obrigatorio
```

```ts
    if (formaPagamento === 'fiado' && !cliente) {
      toast.error('Selecione um cliente para venda fiado')
      return
    }
    if (dividirPagamento && formaPagamentoSecundaria === 'fiado' && !cliente) {
      toast.error('Selecione um cliente para venda fiado')
      return
    }
    if (dividirPagamento && formaPagamentoSecundaria === formaPagamento) {
      toast.error('As duas formas de pagamento precisam ser diferentes')
      return
    }
```

```ts
      valor_secundario: dividirPagamento ? Number(valorSecundario) || 0 : undefined,
      forma_pagamento_secundaria: dividirPagamento ? formaPagamentoSecundaria : undefined,
```

E atualizar `novaVenda()` (linhas 419-421) e `ComandaEspera`/`segurarComanda`/
`retomarComanda` (linhas 100-106, 146-150, 441-456, 461-477) pros nomes
novos (`pagouParte` → `dividirPagamento`, `valorPagoAgora` →
`valorSecundario`, `formaPagamentoParcial` → `formaPagamentoSecundaria`).

- [ ] **Step 7: Verificar**

```bash
npx tsc --noEmit
npx eslint lib/actions/pedidos.ts lib/pedido-labels.ts lib/actions/caixa.ts lib/actions/financeiro.ts components/romaneio/CupomFiscal.tsx "app/(app)/pedidos/[id]/page.tsx" components/movimentacao/FormSaida.tsx --quiet
npx next build
```

Teste manual: (a) registrar venda split 100% à vista (dinheiro + cartão),
conferir cupom, `/pedidos/[id]`, `/caixa` e `/financeiro/formas-pagamento`
somam cada forma certa; (b) registrar fiado parcial como antes
(regressão); (c) tentar dividir com a mesma forma nas duas pernas — deve
bloquear. Limpar as vendas de teste do banco (estoque + pedido +
pedido_itens + contas_receber, se houver).

- [ ] **Step 8: Commit**

```bash
git add lib/actions/pedidos.ts lib/pedido-labels.ts lib/actions/caixa.ts lib/actions/financeiro.ts components/romaneio/CupomFiscal.tsx "app/(app)/pedidos/[id]/page.tsx" components/movimentacao/FormSaida.tsx
git commit -m "feat: pagamento dividido entre 2 formas quaisquer (nao so fiado parcial)"
```

---

### Task 3: Extrair `SeletorPagamento` e `CamposEntrega` de `FormSaida.tsx`

**Files:**
- Create: `components/pedido/SeletorPagamento.tsx`
- Create: `components/pedido/CamposEntrega.tsx`
- Modify: `components/movimentacao/FormSaida.tsx` (passa a usar os dois,
  sem mudar comportamento)

**Interfaces:**
- Produces:
  ```ts
  export type ValorPagamento = {
    formaPagamento: 'dinheiro' | 'pix' | 'cartao_debito' | 'cartao_credito' | 'fiado'
    prazoDias: string
    dividir: boolean
    formaPagamentoSecundaria: 'dinheiro' | 'pix' | 'cartao_debito' | 'cartao_credito' | 'fiado'
    valorSecundario: string
    recebido: string
  }
  export function SeletorPagamento(props: {
    cliente: ClienteResumo | null
    total: number
    value: ValorPagamento
    onChange: (v: ValorPagamento) => void
  }): JSX.Element

  export type ValorEntrega = {
    tipoFulfillment: 'balcao' | 'entrega' | 'retirada'
    entregadorId: string
    frete: string
    jaPago: boolean
    enderecoRua: string
    enderecoNumero: string
    enderecoBairro: string
    enderecoCidade: string
  }
  export function CamposEntrega(props: {
    cliente: ClienteResumo | null
    equipe: UsuarioComCargo[]
    value: ValorEntrega
    onChange: (v: ValorEntrega) => void
  }): JSX.Element
  ```
- Consumes (Task 4): `EditarVendaForm.tsx` vai importar os dois com essa
  mesma interface.

- [ ] **Step 1: Criar `components/pedido/SeletorPagamento.tsx`**

```tsx
'use client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatarReal, formatarData, addDias, hojeBrasil } from '@/lib/formatos'
import { rotuloPagamento } from '@/lib/pedido-labels'
import { cn } from '@/lib/utils'
import type { ClienteResumo } from '@/components/pedido/BuscaCliente'

export type FormaPagamentoVenda = 'dinheiro' | 'pix' | 'cartao_debito' | 'cartao_credito' | 'fiado'

export type ValorPagamento = {
  formaPagamento: FormaPagamentoVenda
  prazoDias: string
  dividir: boolean
  formaPagamentoSecundaria: FormaPagamentoVenda
  valorSecundario: string
  recebido: string
}

export const PAGAMENTO_INICIAL: ValorPagamento = {
  formaPagamento: 'dinheiro',
  prazoDias: '7',
  dividir: false,
  formaPagamentoSecundaria: 'pix',
  valorSecundario: '',
  recebido: '',
}

// Secao "Forma de pagamento" completa: forma principal, split opcional em
// 2 formas (qualquer combinacao, incl. fiado nas duas pontas), prazo/aviso
// de fiado, e recebido/troco quando dinheiro esta envolvido. Controlado:
// nao guarda estado proprio, so emite onChange -- reusado por FormSaida
// (venda nova) e EditarVendaForm (venda existente).
export function SeletorPagamento({
  cliente,
  total,
  value,
  onChange,
}: {
  cliente: ClienteResumo | null
  total: number
  value: ValorPagamento
  onChange: (v: ValorPagamento) => void
}) {
  const set = <K extends keyof ValorPagamento>(k: K, v: ValorPagamento[K]) =>
    onChange({ ...value, [k]: v })

  const envolveFiado = value.formaPagamento === 'fiado' || (value.dividir && value.formaPagamentoSecundaria === 'fiado')
  const envolveDinheiro = value.formaPagamento === 'dinheiro' || (value.dividir && value.formaPagamentoSecundaria === 'dinheiro')
  const recebidoNum = Number(value.recebido) || 0
  const troco = recebidoNum > 0 ? +(recebidoNum - total).toFixed(2) : null

  function selecionarFormaPagamento(v: FormaPagamentoVenda) {
    const next: ValorPagamento = { ...value, formaPagamento: v }
    if (v === 'fiado' && cliente?.prazo_pagamento_dias) {
      next.prazoDias = String(cliente.prazo_pagamento_dias)
    }
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        Forma de pagamento
      </label>
      <Select value={value.formaPagamento} onValueChange={(v) => v && selecionarFormaPagamento(v as FormaPagamentoVenda)}>
        <SelectTrigger className="w-full">
          <SelectValue>{(v: string) => rotuloPagamento(v)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="dinheiro">Dinheiro</SelectItem>
          <SelectItem value="pix">Pix</SelectItem>
          <SelectItem value="cartao_debito">Cartão débito</SelectItem>
          <SelectItem value="cartao_credito">Cartão crédito</SelectItem>
          <SelectItem value="fiado">Fiado</SelectItem>
        </SelectContent>
      </Select>

      {value.formaPagamento === 'fiado' && (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-warn/30 bg-warn/[0.06] p-3">
          {!cliente ? (
            <p className="text-xs font-medium text-warn">
              Selecione um cliente acima para venda fiado.
            </p>
          ) : (
            <>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Prazo para pagamento (dias)
              </label>
              <input
                type="number"
                min="1"
                value={value.prazoDias}
                onChange={(e) => set('prazoDias', e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-ring/50"
              />
              <p className="text-xs text-text-muted">
                Vence em {formatarData(addDias(hojeBrasil(), Number(value.prazoDias) || 0))}
              </p>
            </>
          )}
        </div>
      )}

      <label className="mt-2 flex items-center gap-2 text-sm text-text">
        <input
          type="checkbox"
          checked={value.dividir}
          onChange={(e) => set('dividir', e.target.checked)}
          className="size-4 rounded border-border"
        />
        Dividir em duas formas de pagamento?
      </label>

      {value.dividir && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-9 flex-1 items-center rounded-lg border border-border bg-surface pl-2">
              <span className="font-mono text-xs text-text-muted">R$</span>
              <input
                type="number"
                min={0}
                max={total}
                step="0.01"
                value={value.valorSecundario}
                onChange={(e) => set('valorSecundario', e.target.value)}
                placeholder="0,00"
                className="h-9 w-full bg-transparent px-2 text-sm text-text outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                aria-label="Valor da segunda forma"
              />
            </div>
            <Select
              value={value.formaPagamentoSecundaria}
              onValueChange={(v) => v && set('formaPagamentoSecundaria', v as FormaPagamentoVenda)}
            >
              <SelectTrigger className="w-40">
                <SelectValue>{(v: string) => rotuloPagamento(v)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="cartao_debito">Cartão débito</SelectItem>
                <SelectItem value="cartao_credito">Cartão crédito</SelectItem>
                <SelectItem value="fiado">Fiado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-text-muted">
            Resta pagar em {rotuloPagamento(value.formaPagamento)}:{' '}
            {formatarReal(Math.max(total - (Number(value.valorSecundario) || 0), 0))}
            {envolveFiado && ` · vencimento em ${formatarData(addDias(hojeBrasil(), Number(value.prazoDias) || 0))}`}
          </p>
        </div>
      )}

      {envolveDinheiro && (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-surface-2/60 px-3 py-2">
          <div className="inline-flex h-8 items-center gap-2">
            <span className="text-sm text-text-muted">Recebido</span>
            <div className="inline-flex h-8 items-center rounded-lg border border-border bg-bg pl-2">
              <span className="font-mono text-xs text-text-muted">R$</span>
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={value.recebido}
                placeholder="0,00"
                onChange={(e) => set('recebido', e.target.value)}
                className="h-8 w-20 bg-transparent px-2 text-right font-mono text-sm tabular-nums text-text outline-none placeholder:text-text-muted/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                aria-label="Valor recebido em dinheiro"
              />
            </div>
          </div>
          {troco != null && (
            <span className={cn('font-mono text-sm font-bold tabular-nums', troco >= 0 ? 'text-ok' : 'text-err')}>
              {troco >= 0 ? `Troco ${formatarReal(troco)}` : `Falta ${formatarReal(-troco)}`}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Criar `components/pedido/CamposEntrega.tsx`**

```tsx
'use client'
import { useEffect } from 'react'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatarReal } from '@/lib/formatos'
import { taxaPorBairro } from '@/lib/actions/taxas'
import { cn } from '@/lib/utils'
import type { ClienteResumo } from '@/components/pedido/BuscaCliente'
import type { UsuarioComCargo } from '@/lib/actions/cargos'

export type TipoFulfillment = 'balcao' | 'entrega' | 'retirada'

export type ValorEntrega = {
  tipoFulfillment: TipoFulfillment
  entregadorId: string
  frete: string
  jaPago: boolean
  enderecoRua: string
  enderecoNumero: string
  enderecoBairro: string
  enderecoCidade: string
}

export const ENTREGA_INICIAL: ValorEntrega = {
  tipoFulfillment: 'balcao',
  entregadorId: '',
  frete: '',
  jaPago: false,
  enderecoRua: '',
  enderecoNumero: '',
  enderecoBairro: '',
  enderecoCidade: '',
}

const TIPOS: Array<{ valor: TipoFulfillment; label: string }> = [
  { valor: 'balcao', label: 'Balcão' },
  { valor: 'entrega', label: 'Entrega' },
  { valor: 'retirada', label: 'Retirar depois' },
]

// Secao "Tipo" completa: balcao/entrega/retirada, quem vai entregar, frete
// (com sugestao pela taxa do bairro cadastrado do cliente ou digitado),
// endereco de entrega quando nao ha cliente. Controlado, sem estado
// proprio -- reusado por FormSaida e EditarVendaForm.
export function CamposEntrega({
  cliente,
  equipe,
  value,
  onChange,
}: {
  cliente: ClienteResumo | null
  equipe: UsuarioComCargo[]
  value: ValorEntrega
  onChange: (v: ValorEntrega) => void
}) {
  const set = <K extends keyof ValorEntrega>(k: K, v: ValorEntrega[K]) =>
    onChange({ ...value, [k]: v })

  function sugerirFrete(bairro: string | undefined) {
    if (!bairro) return
    taxaPorBairro(bairro)
      .then((taxa) => {
        if (taxa != null) {
          onChange((atual) => (atual.frete === '' ? { ...atual, frete: String(taxa) } : atual))
          toast.info(`Frete de ${bairro}: ${formatarReal(taxa)} (ajuste se precisar)`)
        }
      })
      .catch(() => {})
  }

  // Ao trocar cliente com bairro cadastrado, sugere o frete (uma vez).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (value.tipoFulfillment === 'entrega') sugerirFrete(cliente?.endereco?.bairro)
  }, [cliente?.id])

  return (
    <>
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          Tipo
        </label>
        <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-border bg-surface p-1">
          {TIPOS.map((t) => (
            <button
              key={t.valor}
              type="button"
              onClick={() => {
                set('tipoFulfillment', t.valor)
                if (t.valor === 'entrega') sugerirFrete(cliente?.endereco?.bairro)
              }}
              className={cn(
                'u-motion rounded-md px-3 py-1.5 text-sm font-medium',
                value.tipoFulfillment === t.valor
                  ? 'bg-brand text-primary-foreground'
                  : 'text-text-muted hover:bg-surface-2 hover:text-text',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {value.tipoFulfillment === 'entrega' && (
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Quem vai entregar
          </label>
          <Select value={value.entregadorId} onValueChange={(v) => v && set('entregadorId', v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione...">
                {(v: string) => equipe.find((u) => u.id === v)?.nome ?? v}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {equipe.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {value.tipoFulfillment === 'entrega' && (
        <div className="flex flex-col gap-2">
          <label htmlFor="frete" className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Frete (R$)
          </label>
          <input
            id="frete"
            type="number"
            step="0.01"
            min="0"
            value={value.frete}
            onChange={(e) => set('frete', e.target.value)}
            placeholder="0,00"
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </div>
      )}

      {value.tipoFulfillment === 'entrega' && !cliente && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Endereço de entrega
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={value.enderecoRua}
              onChange={(e) => set('enderecoRua', e.target.value)}
              placeholder="Rua"
              className="col-span-2 h-9 rounded-md border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand"
            />
            <input
              value={value.enderecoNumero}
              onChange={(e) => set('enderecoNumero', e.target.value)}
              placeholder="Número"
              className="h-9 rounded-md border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand"
            />
            <input
              value={value.enderecoBairro}
              onChange={(e) => set('enderecoBairro', e.target.value)}
              onBlur={() => sugerirFrete(value.enderecoBairro)}
              placeholder="Bairro"
              className="h-9 rounded-md border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand"
            />
            <input
              value={value.enderecoCidade}
              onChange={(e) => set('enderecoCidade', e.target.value)}
              placeholder="Cidade"
              className="col-span-2 h-9 rounded-md border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand"
            />
          </div>
        </div>
      )}

      {(value.tipoFulfillment === 'entrega' || value.tipoFulfillment === 'retirada') && (
        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={value.jaPago}
            onChange={(e) => set('jaPago', e.target.checked)}
            className="size-4 rounded border-border"
          />
          Já foi pago
        </label>
      )}
    </>
  )
}
```

Nota: `onChange((atual) => ...)` na assinatura de `sugerirFrete` não é
compatível com a prop `onChange: (v: ValorEntrega) => void` — ajustar
`sugerirFrete` pra receber o `value` atual por closure em vez de updater
funcional:

```ts
  function sugerirFrete(bairro: string | undefined) {
    if (!bairro) return
    taxaPorBairro(bairro)
      .then((taxa) => {
        if (taxa != null && value.frete === '') {
          onChange({ ...value, frete: String(taxa) })
          toast.info(`Frete de ${bairro}: ${formatarReal(taxa)} (ajuste se precisar)`)
        }
      })
      .catch(() => {})
  }
```

- [ ] **Step 3: `FormSaida.tsx` passa a usar os dois componentes**

Remover de `FormSaida.tsx` os estados que migraram pros subcomponentes
(`tipoFulfillment`, `entregadorId`, `frete`, `jaPago`, `enderecoRua`,
`enderecoNumero`, `enderecoBairro`, `enderecoCidade`, `formaPagamento`,
`prazoDias`, `dividirPagamento`, `valorSecundario`, `formaPagamentoSecundaria`,
`recebido`) e substituir por dois objetos de estado:

```ts
  const [pagamento, setPagamento] = useState<ValorPagamento>(PAGAMENTO_INICIAL)
  const [entrega, setEntrega] = useState<ValorEntrega>(ENTREGA_INICIAL)
```

com os imports:

```ts
import { SeletorPagamento, PAGAMENTO_INICIAL, type ValorPagamento } from '@/components/pedido/SeletorPagamento'
import { CamposEntrega, ENTREGA_INICIAL, type ValorEntrega } from '@/components/pedido/CamposEntrega'
```

Atualizar todas as referências no arquivo (o `useMemo`/`useCallback` de
`registrar`, `podeRegistrar`, `novaVenda`, `ComandaEspera`,
`segurarComanda`, `retomarComanda`, `selecionarCliente`) pra ler/escrever
via `pagamento.formaPagamento`, `entrega.tipoFulfillment` etc. em vez das
variáveis soltas. Trocar o JSX das seções "Tipo"/"Quem vai
entregar"/"Frete"/"Endereço"/"Já foi pago" por `<CamposEntrega cliente=
{cliente} equipe={equipe} value={entrega} onChange={setEntrega} />`, e a
seção "Forma de pagamento" por `<SeletorPagamento cliente={cliente}
total={total} value={pagamento} onChange={setPagamento} />`.

`ComandaEspera` (o tipo salvo em localStorage) passa a guardar `pagamento`
e `entrega` como sub-objetos em vez de campos soltos:

```ts
type ComandaEspera = {
  id: string
  hora: string
  cliente: ClienteResumo | null
  itens: ItemPedido[]
  pagamento: ValorPagamento
  entrega: ValorEntrega
  desconto: string
  total: number
}
```

- [ ] **Step 4: Verificar**

```bash
npx tsc --noEmit
npx eslint components/pedido/SeletorPagamento.tsx components/pedido/CamposEntrega.tsx components/movimentacao/FormSaida.tsx --quiet
npx next build
```

Teste manual de regressão em `/movimentacoes/nova?tipo=saida`: registrar
venda balcão simples, venda com split, venda fiado, venda entrega com
frete sugerido por bairro, segurar/retomar comanda em espera — tudo deve
se comportar exatamente como antes da extração. Limpar vendas de teste.

- [ ] **Step 5: Commit**

```bash
git add components/pedido/SeletorPagamento.tsx components/pedido/CamposEntrega.tsx components/movimentacao/FormSaida.tsx
git commit -m "refactor: extrai SeletorPagamento e CamposEntrega de FormSaida pra reuso"
```

---

### Task 4: `editarVenda` expandido (cliente, tipo, frete, desconto, pagamento) + `EditarVendaForm` reescrito

**Files:**
- Modify: `lib/actions/pedidos.ts` (`editarVenda`, substitui
  `buscarItensParaEditar` por `buscarPedidoParaEditar`)
- Modify: `lib/pedido-labels.ts` (`podeEditarPedido` já leva
  `tipo_fulfillment` em conta — sem mudança aqui, só referência)
- Modify: `app/(app)/pedidos/[id]/editar/page.tsx`
- Modify: `components/pedido/EditarVendaForm.tsx`

**Interfaces:**
- Consumes: `SeletorPagamento`/`CamposEntrega` (Task 3),
  `somarPorForma`/`rotuloPagamentoVenda` (Task 2)
- Produces: `editarVenda(pedidoId, payload)` com assinatura nova (payload
  objeto único em vez de só `itens`).

- [ ] **Step 1: `buscarPedidoParaEditar` substitui `buscarItensParaEditar`**

Em `lib/actions/pedidos.ts`, renomear `buscarItensParaEditar` pra retornar
o pedido inteiro, não só os itens:

```ts
export type PedidoParaEditar = {
  itens: ItemPedido[]
  cliente: { id: string; nome: string; telefone: string | null; prazo_pagamento_dias: number | null; endereco: Record<string, string> | null } | null
  forma_pagamento: string
  forma_pagamento_secundaria: string | null
  valor_secundario: number
  prazo_pagamento_dias: number
  frete: number
  desconto_total: number
  tipo_fulfillment: string
  entregador_id: string | null
  endereco_entrega: Record<string, string> | null
}

export async function buscarPedidoParaEditar(pedidoId: string): Promise<PedidoParaEditar> {
  const supabase = await createClient()
  const { data: pedidoRaw } = await supabase
    .from('pedidos')
    .select(
      'forma_pagamento, forma_pagamento_secundaria, valor_secundario, prazo_pagamento_dias, frete, desconto_total, tipo_fulfillment, entregador_id, endereco_entrega, clientes(id, nome, telefone, prazo_pagamento_dias, endereco)',
    )
    .eq('id', pedidoId)
    .single()

  type Rel<T> = T | T[] | null
  const umaRel = <T,>(rel: Rel<T>): T | null => (Array.isArray(rel) ? (rel[0] ?? null) : rel)
  type PedidoRaw = {
    forma_pagamento: string
    forma_pagamento_secundaria: string | null
    valor_secundario: number
    prazo_pagamento_dias: number
    frete: number
    desconto_total: number
    tipo_fulfillment: string
    entregador_id: string | null
    endereco_entrega: Record<string, string> | null
    clientes: Rel<{ id: string; nome: string; telefone: string | null; prazo_pagamento_dias: number | null; endereco: Record<string, string> | null }>
  }
  const p = pedidoRaw as PedidoRaw

  const itens = await buscarItensDoPedido(pedidoId)

  return {
    itens,
    cliente: umaRel(p.clientes),
    forma_pagamento: p.forma_pagamento,
    forma_pagamento_secundaria: p.forma_pagamento_secundaria,
    valor_secundario: Number(p.valor_secundario ?? 0),
    prazo_pagamento_dias: p.prazo_pagamento_dias,
    frete: Number(p.frete ?? 0),
    desconto_total: Number(p.desconto_total ?? 0),
    tipo_fulfillment: p.tipo_fulfillment,
    entregador_id: p.entregador_id,
    endereco_entrega: p.endereco_entrega,
  }
}
```

Renomear a função existente `buscarItensParaEditar` pra
`buscarItensDoPedido` (mesmo corpo, só o nome muda, já que agora é uma
função auxiliar interna chamada por `buscarPedidoParaEditar`) — manter
export pra não quebrar nada que já importe (checar com grep antes de
remover o export antigo; hoje só a página de editar usa, que também está
sendo modificada nesta task, então pode remover o export velho).

- [ ] **Step 2: `editarVenda` aceita o payload completo**

Trocar a assinatura de `editarVenda` em `lib/actions/pedidos.ts`:

```ts
const EdicaoVendaSchema = z.object({
  itens: z.array(ItemSchema).min(1, 'Adicione pelo menos 1 item'),
  cliente_id: z.string().uuid().nullable().optional(),
  forma_pagamento: z.enum(['dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'fiado']),
  forma_pagamento_secundaria: z.enum(['dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'fiado']).optional(),
  valor_secundario: z.number().min(0).optional(),
  prazo_dias: z.number().int().min(1).max(180).optional(),
  frete: z.number().min(0).default(0),
  desconto: z.number().min(0).default(0),
  tipo_fulfillment: z.enum(['balcao', 'entrega', 'retirada']).default('balcao'),
  entregador_id: z.string().uuid().nullable().optional(),
  endereco_entrega: z
    .object({
      rua: z.string().optional(),
      numero: z.string().optional(),
      bairro: z.string().optional(),
      cidade: z.string().optional(),
    })
    .optional(),
})

export async function editarVenda(pedidoId: string, data: unknown) {
  const parsed = EdicaoVendaSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { itens, forma_pagamento, tipo_fulfillment, frete, desconto } = parsed.data

  const formaSecundaria = parsed.data.forma_pagamento_secundaria ?? null
  const valorSecundario = formaSecundaria ? (parsed.data.valor_secundario ?? 0) : 0
  if (formaSecundaria) {
    if (formaSecundaria === forma_pagamento) {
      return { error: 'As duas formas de pagamento precisam ser diferentes' }
    }
    if (valorSecundario <= 0) {
      return { error: 'Informe o valor da segunda forma de pagamento' }
    }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const serviceClient = await createServiceClient()

  const { data: pedidoRaw, error: errPedido } = await serviceClient
    .from('pedidos')
    .select('id, local_id, status, data_pedido, concluido_em, tipo_fulfillment')
    .eq('id', pedidoId)
    .single()
  type PedidoRow = {
    id: string
    local_id: string
    status: string
    data_pedido: string
    concluido_em: string | null
    tipo_fulfillment: string
  }
  const pedido = pedidoRaw as PedidoRow | null
  if (errPedido || !pedido) return { error: errPedido?.message ?? 'Venda não encontrada' }

  const fechado = await caixaFechadoHoje(pedido.local_id)
  if (!podeEditarPedido(pedido, fechado)) {
    return { error: 'Essa venda não pode mais ser editada (fora do dia, caixa fechado ou já concluída)' }
  }

  const subtotal = +itens.reduce((acc, i) => acc + i.total, 0).toFixed(2)
  if (desconto > subtotal) {
    return { error: 'Desconto maior que o valor da mercadoria.' }
  }
  const novoTotal = +(subtotal + frete - desconto).toFixed(2)
  if (valorSecundario >= novoTotal && formaSecundaria) {
    return { error: 'O valor da segunda forma não pode ser maior ou igual ao total da venda' }
  }

  const pernaFiado =
    forma_pagamento === 'fiado'
      ? { valor: novoTotal - valorSecundario }
      : formaSecundaria === 'fiado'
        ? { valor: valorSecundario }
        : null
  if (pernaFiado && !parsed.data.cliente_id) {
    return { error: 'Selecione um cliente para venda fiado' }
  }

  const { data: itensAntigosRaw, error: errItensAntigos } = await serviceClient
    .from('pedido_itens')
    .select('produto_id, quantidade_pedida')
    .eq('pedido_id', pedidoId)
  if (errItensAntigos) return { error: errItensAntigos.message }
  const itensAntigos = (itensAntigosRaw ?? []) as { produto_id: string; quantidade_pedida: number }[]

  const qtdAntiga = new Map<string, number>()
  for (const i of itensAntigos) qtdAntiga.set(i.produto_id, i.quantidade_pedida)
  const qtdNova = new Map<string, number>()
  for (const i of itens) qtdNova.set(i.produto_id, (qtdNova.get(i.produto_id) ?? 0) + i.quantidade)

  const produtoIds = new Set([...qtdAntiga.keys(), ...qtdNova.keys()])
  const deltas = new Map<string, number>()
  for (const produtoId of produtoIds) {
    const delta = (qtdNova.get(produtoId) ?? 0) - (qtdAntiga.get(produtoId) ?? 0)
    if (delta !== 0) deltas.set(produtoId, delta)
  }

  // Pre-checagem de estoque: todo produto que precisa de MAIS unidades
  // (delta > 0) tem que ter saldo suficiente antes de mexer em qualquer coisa.
  for (const [produtoId, delta] of deltas) {
    if (delta <= 0) continue
    const { data: est } = await serviceClient
      .from('estoque')
      .select('saldo_atual, produtos(nome)')
      .eq('produto_id', produtoId)
      .single()
    const saldo = (est as { saldo_atual: number } | null)?.saldo_atual ?? 0
    if (saldo < delta) {
      const rel = (est as { produtos: { nome: string } | { nome: string }[] | null } | null)?.produtos
      const nome = (Array.isArray(rel) ? rel[0] : rel)?.nome ?? 'produto'
      return { error: `Estoque insuficiente de ${nome}: tem ${saldo}, precisa de mais ${delta}.` }
    }
  }

  for (const [produtoId, delta] of deltas) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ajusteRaw, error: errAjuste } = await (serviceClient as any).rpc('ajustar_estoque', {
      p_produto_id: produtoId,
      p_delta: -delta,
    })
    if (errAjuste) return { error: `Falha ao ajustar estoque: ${errAjuste.message}` }
    const ajuste = (ajusteRaw as { saldo_novo: number; custo_medio: number }[] | null)?.[0]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (serviceClient.from('movimentacoes_estoque') as any).insert({
      produto_id: produtoId,
      tipo: delta > 0 ? 'saida_venda' : 'devolucao_cliente',
      quantidade: -delta,
      custo_unitario: ajuste?.custo_medio ?? 0,
      saldo_apos: ajuste?.saldo_novo ?? 0,
      referencia_tipo: 'pedido',
      referencia_id: pedidoId,
      usuario_id: user.id,
      observacao: 'Edição da venda',
    })
  }

  await serviceClient.from('pedido_itens').delete().eq('pedido_id', pedidoId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: errInsert } = await (serviceClient.from('pedido_itens') as any).insert(
    itens.map((i) => ({
      pedido_id: pedidoId,
      produto_id: i.produto_id,
      quantidade_pedida: i.quantidade,
      preco_unitario: i.preco_unitario,
      total: i.total,
      embalagem_nome: i.embalagem_nome ?? null,
      embalagem_unidades: i.embalagem_unidades ?? null,
    })),
  )
  if (errInsert) return { error: errInsert.message }
```

Esse bloco é idêntico ao `editarVenda` de hoje (mesmo cálculo de deltas de
estoque, pré-checagem, `ajustar_estoque`, delete+insert de `pedido_itens`)
— a única mudança da task é que `frete`/`desconto` agora vêm do payload
(campos editáveis) em vez de serem só lidos do pedido original.

Depois do bloco de itens/estoque, o trecho final muda bastante — trocar
todo o bloco de `contas_receber` + `update` de `pedidos` (linhas 763-790
de hoje) por:

```ts
  // Reconcilia contas_receber com a nova situacao de fiado (pode ter
  // deixado de existir, passado a existir, ou so mudado de valor).
  const { data: contaRaw } = await serviceClient
    .from('contas_receber')
    .select('id, valor_pago')
    .eq('pedido_id', pedidoId)
    .maybeSingle()
  const conta = contaRaw as { id: string; valor_pago: number } | null

  if (pernaFiado) {
    if (conta) {
      if (pernaFiado.valor < conta.valor_pago) {
        return {
          error: `Não é possível reduzir o fiado abaixo do que já foi pago (R$ ${conta.valor_pago.toFixed(2).replace('.', ',')})`,
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (serviceClient.from('contas_receber') as any)
        .update({ valor: pernaFiado.valor, status: conta.valor_pago >= pernaFiado.valor ? 'pago' : 'aberto' })
        .eq('id', conta.id)
    } else {
      const hoje = hojeBrasil()
      const prazoDias = parsed.data.prazo_dias ?? 7
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: errReceber } = await (serviceClient.from('contas_receber') as any).insert({
        pedido_id: pedidoId,
        cliente_id: parsed.data.cliente_id,
        descricao: `Venda #${pedidoId}`,
        valor: pernaFiado.valor,
        valor_pago: 0,
        status: 'aberto',
        data_emissao: hoje,
        data_vencimento: addDias(hoje, prazoDias),
        forma_pagamento: 'fiado',
      })
      if (errReceber) return { error: errReceber.message }
    }
  } else if (conta) {
    if (conta.valor_pago > 0) {
      return {
        error: `Essa venda já tem R$ ${conta.valor_pago.toFixed(2).replace('.', ',')} recebidos como fiado — não dá pra tirar o fiado sem estornar o recebimento primeiro.`,
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (serviceClient.from('contas_receber') as any).update({ status: 'cancelado' }).eq('id', conta.id)
  }

  // Tipo mudou de/para balcao: concluido_em segue a mesma regra da criacao
  // (balcao ja fecha na hora; entrega/retirada volta a aguardar).
  const concluidoEm =
    tipo_fulfillment === 'balcao'
      ? new Date().toISOString()
      : pedido.tipo_fulfillment === 'balcao'
        ? null
        : pedido.concluido_em

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: errUpdate } = await (serviceClient.from('pedidos') as any)
    .update({
      subtotal,
      total: novoTotal,
      cliente_id: parsed.data.cliente_id ?? null,
      forma_pagamento,
      forma_pagamento_secundaria: formaSecundaria,
      valor_secundario: formaSecundaria ? valorSecundario : 0,
      frete,
      desconto_total: desconto,
      tipo_fulfillment,
      entregador_id: tipo_fulfillment === 'entrega' ? parsed.data.entregador_id : null,
      endereco_entrega: parsed.data.endereco_entrega ?? null,
      concluido_em: concluidoEm,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pedidoId)
  if (errUpdate) return { error: errUpdate.message }

  revalidatePath(`/pedidos/${pedidoId}`)
  revalidatePath('/pedidos')
  revalidatePath('/dashboard')
  revalidatePath('/financeiro/a-receber')
  revalidatePath('/caixa')
  return { success: true as const }
}
```

Adicionar o import de `hojeBrasil`/`addDias` (já importados no topo do
arquivo, conferir).

- [ ] **Step 3: Página `app/(app)/pedidos/[id]/editar/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { caixaFechadoHoje, buscarPedidoParaEditar } from '@/lib/actions/pedidos'
import { podeEditarPedido } from '@/lib/pedido-labels'
import { listarEntregadoresElegiveis } from '@/lib/actions/cargos'
import { EditarVendaForm } from '@/components/pedido/EditarVendaForm'

export default async function EditarVendaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: pedidoRaw } = await supabase
    .from('pedidos')
    .select('id, numero_pedido, local_id, status, data_pedido, concluido_em, tipo_fulfillment')
    .eq('id', id)
    .single()

  type PedidoBasico = {
    id: string
    numero_pedido: number
    local_id: string
    status: string
    data_pedido: string
    concluido_em: string | null
    tipo_fulfillment: string
  }
  const pedido = pedidoRaw as PedidoBasico | null
  if (!pedido) notFound()

  const fechado = await caixaFechadoHoje(pedido.local_id)
  if (!podeEditarPedido(pedido, fechado)) notFound()

  const [dados, equipe] = await Promise.all([
    buscarPedidoParaEditar(id),
    listarEntregadoresElegiveis(pedido.local_id),
  ])

  return (
    <div className="mx-auto max-w-3xl">
      <EditarVendaForm
        pedidoId={id}
        numeroPedido={pedido.numero_pedido}
        dados={dados}
        equipe={equipe}
      />
    </div>
  )
}
```

- [ ] **Step 4: `EditarVendaForm.tsx` reescrito**

```tsx
'use client'
import { useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { BuscaProduto, type ProdutoParaAdicionar } from '@/components/pedido/BuscaProduto'
import { BuscaCliente, type ClienteResumo } from '@/components/pedido/BuscaCliente'
import { ListaItensPedido } from '@/components/pedido/ListaItensPedido'
import { SeletorPagamento, type ValorPagamento } from '@/components/pedido/SeletorPagamento'
import { CamposEntrega, type ValorEntrega } from '@/components/pedido/CamposEntrega'
import { Money } from '@/components/ui-kit/Money'
import { editarVenda, type PedidoParaEditar } from '@/lib/actions/pedidos'
import type { UsuarioComCargo } from '@/lib/actions/cargos'
import type { ItemPedido } from '@/types'

function aplicarForma(item: ItemPedido, formaId: string, qtdFormas: number, precoForma?: number): ItemPedido {
  const forma = item.formas.find((f) => f.id === formaId) ?? item.formas[0]
  const preco = precoForma ?? forma.preco
  return {
    ...item,
    formaId: forma.id,
    qtdFormas,
    precoForma: preco,
    quantidade: qtdFormas * forma.unidades,
    total: +(qtdFormas * preco).toFixed(2),
    preco_unitario: forma.unidades > 0 ? +(preco / forma.unidades).toFixed(2) : preco,
  }
}

export function EditarVendaForm({
  pedidoId,
  numeroPedido,
  dados,
  equipe,
}: {
  pedidoId: string
  numeroPedido: number
  dados: PedidoParaEditar
  equipe: UsuarioComCargo[]
}) {
  const router = useRouter()
  const [itens, setItens] = useState<ItemPedido[]>(dados.itens)
  const [cliente, setCliente] = useState<ClienteResumo | null>(
    dados.cliente
      ? { id: dados.cliente.id, nome: dados.cliente.nome, telefone: dados.cliente.telefone, prazo_pagamento_dias: dados.cliente.prazo_pagamento_dias, endereco: dados.cliente.endereco }
      : null,
  )
  const [desconto, setDesconto] = useState(String(dados.desconto_total || ''))
  const [pagamento, setPagamento] = useState<ValorPagamento>({
    formaPagamento: dados.forma_pagamento as ValorPagamento['formaPagamento'],
    prazoDias: String(dados.prazo_pagamento_dias || 7),
    dividir: !!dados.forma_pagamento_secundaria,
    formaPagamentoSecundaria: (dados.forma_pagamento_secundaria ?? 'pix') as ValorPagamento['formaPagamentoSecundaria'],
    valorSecundario: dados.valor_secundario ? String(dados.valor_secundario) : '',
    recebido: '',
  })
  const [entrega, setEntrega] = useState<ValorEntrega>({
    tipoFulfillment: dados.tipo_fulfillment as ValorEntrega['tipoFulfillment'],
    entregadorId: dados.entregador_id ?? '',
    frete: dados.frete ? String(dados.frete) : '',
    jaPago: false,
    enderecoRua: dados.endereco_entrega?.rua ?? '',
    enderecoNumero: dados.endereco_entrega?.numero ?? '',
    enderecoBairro: dados.endereco_entrega?.bairro ?? '',
    enderecoCidade: dados.endereco_entrega?.cidade ?? '',
  })
  const [salvando, startTransition] = useTransition()
  const numeroFmt = `#${String(numeroPedido).padStart(4, '0')}`

  const adicionarItem = useCallback((produto: ProdutoParaAdicionar) => {
    setItens((prev) => {
      const existe = prev.find((i) => i.produto_id === produto.produto_id)
      if (existe) {
        return prev.map((i) =>
          i.produto_id === produto.produto_id ? aplicarForma(i, i.formaId, i.qtdFormas + 1, i.precoForma) : i,
        )
      }
      const forma = produto.formas.find((f) => f.padrao) ?? produto.formas[0]
      const base: ItemPedido = {
        produto_id: produto.produto_id,
        nome: produto.nome,
        categoria: produto.categoria,
        saldo_atual: produto.saldo_atual,
        formas: produto.formas,
        formaId: forma.id,
        qtdFormas: 1,
        precoForma: forma.preco,
        preco_unitario: 0,
        quantidade: 0,
        total: 0,
      }
      return [...prev, aplicarForma(base, forma.id, 1)]
    })
  }, [])

  const alterarQtdFormas = useCallback((produtoId: string, qtd: number) => {
    setItens((prev) => prev.map((i) => (i.produto_id === produtoId ? aplicarForma(i, i.formaId, qtd, i.precoForma) : i)))
  }, [])

  const alterarForma = useCallback((produtoId: string, formaId: string) => {
    setItens((prev) => prev.map((i) => (i.produto_id === produtoId ? aplicarForma(i, formaId, i.qtdFormas) : i)))
  }, [])

  const alterarPrecoForma = useCallback((produtoId: string, preco: number) => {
    setItens((prev) => prev.map((i) => (i.produto_id === produtoId ? aplicarForma(i, i.formaId, i.qtdFormas, preco) : i)))
  }, [])

  const alterarFormaCustom = useCallback((produtoId: string, unidades: number) => {
    setItens((prev) =>
      prev.map((i) => {
        if (i.produto_id !== produtoId) return i
        const customId = `custom-${i.produto_id}`
        const unidadeBase = i.formas.find((f) => f.unidades === 1)
        const precoSugerido = +(unidades * (unidadeBase?.preco ?? i.preco_unitario)).toFixed(2)
        const jaCustom = i.formaId === customId
        const formaCustom = {
          id: customId,
          nome: `Pacote ${unidades}`,
          unidades,
          preco: jaCustom ? i.precoForma : precoSugerido,
          padrao: false,
        }
        const formas = [...i.formas.filter((f) => f.id !== customId), formaCustom]
        return aplicarForma({ ...i, formas }, customId, i.qtdFormas, formaCustom.preco)
      }),
    )
  }, [])

  const remover = useCallback((produtoId: string) => {
    setItens((prev) => prev.filter((i) => i.produto_id !== produtoId))
  }, [])

  const subtotal = itens.reduce((acc, i) => acc + i.total, 0)
  const freteNum = entrega.tipoFulfillment === 'entrega' ? Number(entrega.frete) || 0 : 0
  const descontoNum = Math.min(Math.max(Number(desconto) || 0, 0), subtotal)
  const total = +(subtotal + freteNum - descontoNum).toFixed(2)

  function salvar() {
    if (itens.length === 0) {
      toast.error('A venda precisa ter pelo menos 1 item')
      return
    }
    if (pagamento.formaPagamento === 'fiado' && !cliente) {
      toast.error('Selecione um cliente para venda fiado')
      return
    }
    if (pagamento.dividir && pagamento.formaPagamentoSecundaria === 'fiado' && !cliente) {
      toast.error('Selecione um cliente para venda fiado')
      return
    }
    if (pagamento.dividir && pagamento.formaPagamentoSecundaria === pagamento.formaPagamento) {
      toast.error('As duas formas de pagamento precisam ser diferentes')
      return
    }
    startTransition(async () => {
      const resultado = await editarVenda(pedidoId, {
        itens: itens.map((i) => ({
          produto_id: i.produto_id,
          quantidade: i.quantidade,
          preco_unitario: i.preco_unitario,
          total: i.total,
          embalagem_nome: i.formas.find((f) => f.id === i.formaId)?.nome,
          embalagem_unidades: i.formas.find((f) => f.id === i.formaId)?.unidades,
        })),
        cliente_id: cliente?.id ?? null,
        forma_pagamento: pagamento.formaPagamento,
        forma_pagamento_secundaria: pagamento.dividir ? pagamento.formaPagamentoSecundaria : undefined,
        valor_secundario: pagamento.dividir ? Number(pagamento.valorSecundario) || 0 : undefined,
        prazo_dias: pagamento.formaPagamento === 'fiado' ? Number(pagamento.prazoDias) || 7 : undefined,
        frete: freteNum,
        desconto: descontoNum,
        tipo_fulfillment: entrega.tipoFulfillment,
        entregador_id: entrega.tipoFulfillment === 'entrega' && entrega.entregadorId ? entrega.entregadorId : null,
        endereco_entrega:
          entrega.tipoFulfillment === 'entrega' && !cliente
            ? {
                rua: entrega.enderecoRua || undefined,
                numero: entrega.enderecoNumero || undefined,
                bairro: entrega.enderecoBairro || undefined,
                cidade: entrega.enderecoCidade || undefined,
              }
            : undefined,
      })
      if (resultado.error) {
        toast.error(resultado.error)
        return
      }
      toast.success(`Venda ${numeroFmt} atualizada.`)
      router.push(`/pedidos/${pedidoId}`)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-5 py-5">
      <div className="flex items-center gap-3">
        <Link
          href={`/pedidos/${pedidoId}`}
          className="u-motion flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text-muted hover:bg-surface-2 hover:text-text"
          aria-label="Voltar"
        >
          <ArrowLeft className="size-4" strokeWidth={1.5} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">Editar venda {numeroFmt}</h1>
          <p className="text-sm text-text-muted">Mude qualquer dado da venda: itens, pagamento, cliente, entrega.</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          Cliente {pagamento.formaPagamento === 'fiado' ? '(obrigatório p/ fiado)' : '(opcional)'}
        </label>
        <BuscaCliente selecionado={cliente} onSelecionar={setCliente} />
      </div>

      <CamposEntrega cliente={cliente} equipe={equipe} value={entrega} onChange={setEntrega} />

      <BuscaProduto onAdicionar={adicionarItem} />

      {itens.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text-muted">
          Nenhum item. Busque um produto acima pra adicionar.
        </p>
      ) : (
        <ListaItensPedido
          itens={itens}
          onAlterarQtdFormas={alterarQtdFormas}
          onAlterarForma={alterarForma}
          onAlterarPrecoForma={alterarPrecoForma}
          onAlterarFormaCustom={alterarFormaCustom}
          onRemover={remover}
        />
      )}

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-text-muted">Subtotal</span>
          <Money valor={subtotal} className="text-sm text-text-muted" />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-text-muted">Desconto</span>
          <div className="inline-flex h-8 items-center rounded-lg border border-border bg-bg pl-2">
            <span className="font-mono text-xs text-text-muted">R$</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={desconto}
              placeholder="0,00"
              onChange={(e) => setDesconto(e.target.value)}
              className="h-8 w-20 bg-transparent px-2 text-right font-mono text-sm tabular-nums text-text outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              aria-label="Desconto em reais"
            />
          </div>
        </div>
        {freteNum > 0 && (
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-text-muted">Frete</span>
            <Money valor={freteNum} className="text-sm text-text-muted" />
          </div>
        )}
        <div className="flex items-baseline justify-between border-t border-border pt-2">
          <span className="text-sm font-semibold text-text">Total</span>
          <Money valor={total} destaque className="text-lg font-semibold" />
        </div>
      </div>

      <SeletorPagamento cliente={cliente} total={total} value={pagamento} onChange={setPagamento} />

      <button
        type="button"
        onClick={salvar}
        disabled={salvando}
        className="u-motion inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-primary-foreground hover:bg-brand-strong disabled:pointer-events-none disabled:opacity-50"
      >
        {salvando ? <Loader2 className="size-4 animate-spin" strokeWidth={2} /> : <Save className="size-4" strokeWidth={1.75} />}
        Salvar alterações
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Verificar**

```bash
npx tsc --noEmit
npx eslint lib/actions/pedidos.ts "app/(app)/pedidos/[id]/editar/page.tsx" components/pedido/EditarVendaForm.tsx --quiet
npx next build
```

Teste manual: editar uma venda mudando forma única → split; adicionar
cliente a uma venda balcão sem cliente; trocar balcão → entrega (conferir
que `concluido_em` fica nulo e o pedido passa a aparecer em "Em
andamento") e voltar pra balcão; mudar frete/desconto; tentar tirar o
fiado de uma venda que já tem valor pago (deve bloquear); pedido fora da
janela de edição continua 404. Limpar tudo do banco no final (Task 5 cobre
isso com mais detalhe, mas já limpar aqui o que for gerado nesta
verificação).

- [ ] **Step 6: Commit**

```bash
git add lib/actions/pedidos.ts "app/(app)/pedidos/[id]/editar/page.tsx" components/pedido/EditarVendaForm.tsx
git commit -m "feat: editar venda agora cobre cliente, tipo, frete, desconto e pagamento (incl. split)"
```

---

### Task 5: Build final, testes manuais completos, limpeza, push

- [ ] **Step 1: Build e lint completos**

```bash
npx tsc --noEmit
npx eslint . --quiet
npx next build
```

Expected: sem erros.

- [ ] **Step 2: Teste manual — venda nova com split 100% à vista**

Registrar venda em `/movimentacoes/nova?tipo=saida` com forma dinheiro +
split cartão débito. Conferir cupom mostra as duas linhas, `/pedidos/[id]`
mostra as duas, `/caixa` soma cada forma certa, `/financeiro/formas-pagamento`
bate.

- [ ] **Step 3: Teste manual — editar venda mudando tudo**

Registrar uma venda simples de balcão. Editar: adicionar cliente (ZZTESTE
apagar, criado inline), mudar forma pra split dinheiro+fiado, mudar frete/
desconto, mudar tipo pra entrega (escolher entregador). Conferir total,
`contas_receber` criada com o valor certo da perna fiado, e que o pedido
passa a aparecer em "Em andamento" (`/pedidos`) por não ter mais
`concluido_em`.

- [ ] **Step 4: Teste manual — remover fiado de venda com valor já pago**

Criar venda fiado, marcar pagamento parcial em `/financeiro/a-receber`
pra essa conta ficar com `valor_pago > 0`, depois tentar editar a venda
pra tirar o fiado (trocar as duas formas pra à vista) — deve bloquear com
a mensagem de erro certa.

- [ ] **Step 5: Teste manual — elegibilidade continua igual**

Visitar `/pedidos/[id]/editar` de um pedido de outro dia — 404.

- [ ] **Step 6: Limpar todo dado de teste do banco**

Restaurar estoque via `ajustar_estoque` (deltas positivos pra cada produto
tocado), apagar `contas_receber`/`pedido_itens`/`pedidos`/`clientes` de
teste, dentro de uma transação `BEGIN`/`COMMIT` via `node -e` + `pg.Pool`
(mesmo padrão já usado nas fases anteriores desta sessão). Confirmar com
uma query de verificação que nada de teste restou.

- [ ] **Step 7: Push**

```bash
git push
```
