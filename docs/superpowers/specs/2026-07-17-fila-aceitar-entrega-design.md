# Entregador aceita entrega da fila — Design

**Data:** 2026-07-17
**Contexto:** Hoje quem registra a venda é obrigado a escolher um
entregador específico na hora (`FormSaida.tsx` bloqueia o envio se
`tipo_fulfillment === 'entrega'` e não tiver `entregador_id`). O Renan
quer poder registrar a entrega sem já saber quem vai levar, e deixar
que qualquer entregador disponível aceite a corrida — modelo de fila,
não de atribuição forçada.

## Decisão (das perguntas respondidas)

- Só quem tem **cargo Entregador** vê e aceita a fila de disponíveis
  (não é "qualquer um da equipe ativa").
- O seletor "Quem vai entregar" na tela de venda **continua existindo**,
  mas vira opcional — se o balconista já sabe quem vai, ainda pode
  escolher ali. Se deixar em branco, a entrega cai na fila.
- Admin/funcionário ganham um jeito de **atribuir na mão** depois,
  como escape se a fila travar.
- Sem "devolver pra fila" depois de aceitar (fora de escopo por agora).

## 1. Registrar venda sem entregador

`lib/actions/pedidos.ts`, `registrarVenda()`: remove a validação

```ts
if (parsed.data.tipo_fulfillment === 'entrega' && !parsed.data.entregador_id) {
  return { error: 'Escolha quem vai entregar' }
}
```

`entregador_id` passa a gravar `null` quando `tipo_fulfillment === 'entrega'`
e nada foi escolhido no `Select` de `FormSaida.tsx` (que já manda `null`
nesse caso — `entregador_id: tipoFulfillment === 'entrega' ? entregadorId : null`,
onde `entregadorId` pode ser string vazia; só precisa normalizar
`''` para `null` explicitamente no payload).

## 2. Aceitar entrega: função Postgres `security definer`

Mesmo padrão de `criar_convite`/`resgatar_convite` (migration
`2026-07-01-convites-equipe.sql`): um entregador precisa escrever numa
linha de `pedidos` que ainda não é dele, e a política de RLS de
`pedidos` não deixa isso passar por uma escrita comum client-side (nem
`createServiceClient()` bypassa com sessão ativa — gotcha já documentado
no `CLAUDE.md`). A trava de concorrência (dois entregadores aceitando ao
mesmo tempo) é resolvida pelo próprio `UPDATE ... WHERE entregador_id IS
NULL`: só um consegue, o outro não acha a linha pra atualizar.

```sql
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

A checagem `local_id = (select local_id from profiles where id =
auth.uid())` impede um entregador de um local aceitar entrega do outro
— mesma regra multi-local já aplicada em `listarEntregadoresElegiveis()`.
Entregador com `local_id` nulo (hoje não existe na prática, mas por
consistência) não aceita nada, já que a comparação com `null` nunca
bate — aceitável, porque entregador sempre tem local fixo pelo convite.

`lib/actions/pedidos.ts` ganha o wrapper:

```ts
export async function aceitarEntrega(pedidoId: string) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('aceitar_entrega', { p_pedido_id: pedidoId })
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { success: true }
}
```

## 3. Fila de disponíveis

Nova função em `lib/actions/pedidos.ts`, espelhando
`listarMinhasEntregas()` (mesmas colunas, mesmo formato de retorno —
`CardEntrega` já sabe renderizar esse shape):

```ts
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

Só é chamada dentro de `TelaEntregador.tsx`, que só renderiza pra quem
já tem cargo Entregador (roteamento em `/dashboard` via
`ehEntregador()`) — não precisa checar cargo de novo aqui, mas a RLS de
leitura de `pedidos` (se existir) precisa permitir o `select` pra
qualquer usuário autenticado do mesmo local; como `listarMinhasEntregas`
já faz esse mesmo tipo de select com sucesso hoje, o padrão de RLS já
suporta.

## 4. UI em `TelaEntregador.tsx`

Nova seção **"Disponíveis pra aceitar"** acima de "Minhas entregas",
só renderizada quando `entregasDisponiveis.length > 0`. Reaproveita
`CardEntrega`, mas com uma variante: em vez dos botões de
`FulfillmentAcoes` (pago/saiu/concluído — que não fazem sentido antes
de aceitar), mostra um botão único **"Aceitar entrega"** que chama
`aceitarEntrega(id)` (client component novo, `BotaoAceitarEntrega.tsx`,
com `useTransition` + `toast` de erro se alguém aceitou primeiro) e
depois `router.refresh()`.

`CardEntrega` ganha uma prop opcional `acoes?: React.ReactNode` que,
quando passada, substitui o bloco de `<FulfillmentAcoes>` — assim o
card de "disponível" e o card de "minha entrega" continuam sendo o
mesmo componente visual, só trocando a área de ação embaixo.

## 5. Atribuir manual (admin/funcionário)

Em `app/(app)/pedidos/[id]/page.tsx`, o trecho que hoje só mostra
`{venda.entregador?.nome ?? '-'}` (linha ~195) vira: se já tem
entregador, continua mostrando o nome (texto simples, não editável por
esse design — trocar quem já aceitou não é o problema que estamos
resolvendo agora); se **não tem**, mostra um `Select` (mesmo padrão do
`FormSaida.tsx`, usando `listarEntregadoresElegiveis()` já existente,
escopado ao local do pedido) com um botão "Atribuir".

Nova server action:

```ts
export async function atribuirEntregadorManual(pedidoId: string, entregadorId: string) {
  const cargo = await getCargoUsuario()
  if (!cargo?.admin && cargo?.nome !== 'Funcionario') return { error: 'Sem permissão' }
  const s = await createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (s.from('pedidos') as any)
    .update({ entregador_id: entregadorId })
    .eq('id', pedidoId)
    .is('entregador_id', null)
  if (error) return { error: error.message }
  revalidatePath(`/pedidos/${pedidoId}`)
  return { success: true }
}
```

`.is('entregador_id', null)` na cláusula evita sobrescrever por acidente
uma entrega que alguém acabou de aceitar entre o carregamento da página
e o clique no botão — mesma defesa de corrida usada na função SQL.

## O que NÃO muda

- Cliente continua opcional, frete/endereço iguais.
- Sem botão de "devolver pra fila" depois de aceitar.
- `FulfillmentAcoes` (pago/saiu em rota/concluído) não muda — só passa
  a aparecer depois que a entrega tem entregador (aceito ou atribuído).

## Verificação

- `npx tsc --noEmit`, `npx eslint . --quiet`, `npx next build`.
- Migration aplicada via `node -e` com `pg.Pool` (padrão do projeto).
- Teste manual: registrar venda de entrega sem escolher entregador →
  logar como Joaquim (dev, hoje sem cargo Entregador de verdade pra
  testar o "aceitar" fim a fim — anotar como limitação de teste, já que
  não existe conta com cargo Entregador em produção ainda) → conferir
  que a entrega aparece em `/pedidos` sem entregador e que o `Select` de
  atribuição manual funciona.
