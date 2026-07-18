# Editar tudo do pedido + pagamento dividido — Design

**Data:** 2026-07-18
**Contexto:** Cliente relatou que quer poder editar um pedido já registrado
de forma bem mais completa do que hoje (que só edita itens, ver
`2026-07-18-editar-venda-design.md`): preço, cliente, frete, desconto, tipo
de entrega/retirada e, principalmente, quais formas de pagamento entraram —
incluindo poder dividir o pagamento entre duas formas diferentes (ex.: R$50
em dinheiro + R$30 no cartão), tanto numa venda nova quanto editando uma já
salva.

Esse documento cobre só essa frente. A frente de "imprimir pelo celular
conectando na maquininha" foi propositalmente deixada de fora — é um
subsistema independente (integração de hardware), vai virar spec própria
depois.

## Decisões (das perguntas respondidas)

- Pagamento dividido = as duas formas já pagas na hora (ex. metade dinheiro,
  metade cartão), não só o caso "parte agora + resto fiado depois" que já
  existe hoje.
- Precisa funcionar tanto em **Nova Movimentação** (registrar já dividido)
  quanto em **Editar venda** (corrigir depois).
- Modelo de dados: **2 slots fixos** (generaliza as colunas que já existem
  pro fiado parcial), não uma tabela `pedido_pagamentos` com N linhas sem
  limite — o pedido do cliente foi sempre "duas formas", e o modelo mais
  simples mexe em bem menos relatórios.
- Além de itens e pagamento, também ficam editáveis: **cliente, frete,
  desconto, tipo (balcão/entrega/retirada) e endereço**.
- A trava de elegibilidade **não muda**: só edita venda de hoje, com caixa
  do dia ainda não fechado. Ela só passa a valer pra uma superfície editável
  bem maior.
- `EditarVendaForm` e `FormSaida.tsx` (nova venda) são **unificados** num
  único componente parametrizado por modo (`criar`/`editar`) — o formulário
  de nova venda já tem 1158 linhas, e duplicar toda a lógica de split de
  pagamento, cliente, frete etc. numa segunda cópia seria um risco de
  manutenção maior do que unificar.

## 1. Modelo de dados: pagamento dividido

`pedidos` já tem duas colunas construídas especificamente pro caso "fiado
parcial" (`2026-07-03-fiado-parcial.sql`): `valor_pago_agora` (quanto entrou
na hora) e `forma_pagamento_parcial` (em qual forma à vista entrou). Elas só
fazem sentido hoje quando `forma_pagamento = 'fiado'`.

Generalizo essas duas colunas pra valer pra **qualquer** par de formas,
renomeando pra tirar a ideia de "parcial pago agora" (que não faz sentido
quando as duas pernas são pagas na hora):

```sql
-- supabase/migrations/2026-07-18-pagamento-dividido.sql
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

Regras (validadas em `registrarVenda`/`editarVenda`, não só no banco):

- `forma_pagamento` = 1ª forma (dinheiro/pix/cartão débito/cartão
  crédito/fiado). Continua obrigatória, como hoje.
- `forma_pagamento_secundaria` = 2ª forma, **opcional**. Quando presente,
  tem que ser **diferente** de `forma_pagamento` (não faz sentido dividir a
  mesma forma em duas pernas).
- `valor_secundario` = quanto da 2ª forma (só existe se
  `forma_pagamento_secundaria` existir). Tem que ser > 0 e < `total`.
- O valor da 1ª forma **nunca é armazenado** — é sempre `total -
  valor_secundario` (ou `total` inteiro quando não há split). Evita os dois
  números saírem de sincronia quando o total muda numa edição.
- Fiado: se **qualquer uma das duas pernas** for `'fiado'`, aquela perna
  vira a linha em `contas_receber` (valor = o valor daquela perna
  especificamente). As duas pernas não podem ser `'fiado'` ao mesmo tempo
  (validação: `forma_pagamento === 'fiado' && forma_pagamento_secundaria ===
  'fiado'` é erro).
- Cliente obrigatório se qualquer uma das pernas for fiado (já é a regra
  hoje pra `forma_pagamento === 'fiado'`; passa a valer também quando é a
  secundária).
- Checagem de `limite_credito` (`registrarVenda` linha ~90-111) passa a
  usar o valor da perna fiado (que pode ser o total inteiro ou só uma
  parte), não sempre o total.

### Helper compartilhado pra somar por forma

Hoje existem **3 lugares** que somam pedidos por forma de pagamento, cada
um reimplementando a mesma lógica de "conta a perna principal + a perna
parcial do fiado" (e um deles, `buscarCaixaDia`, nem trata o caso parcial
hoje — bug preexistente que essa mudança também corrige):

- `lib/actions/financeiro.ts::buscarFormasPagamento` (relatório do mês)
- `lib/actions/financeiro.ts::buscarCaixaDia` (preview do caixa de hoje —
  **não trata split hoje**, vai passar a tratar)
- `lib/actions/caixa.ts::resumoDoDia` (usado no fechamento às cegas)

Extraio um helper puro em `lib/pedido-labels.ts`:

```ts
export type LinhaPagamento = {
  forma_pagamento: string
  total: number
  forma_pagamento_secundaria: string | null
  valor_secundario: number | null
}

// Distribui o total de cada pedido entre as formas informadas. Uma venda
// dividida entra com uma fatia em cada forma das duas pernas; uma venda
// fiado (integral ou só uma perna) não soma nada na perna fiado, porque
// dinheiro/pix/cartao_* representam só o que efetivamente entrou no caixa.
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
```

Os 3 call-sites passam a chamar esse helper em vez de reimplementar o
filtro. `resumoDoDia`/`buscarCaixaDia` continuam **não contando** a perna
fiado no total do caixa (ela não é dinheiro em caixa), igual já não contam
hoje.

## 2. `registrarVenda` — mudanças

Schema (`VendaSchema` em `lib/actions/pedidos.ts`) ganha:

```ts
forma_pagamento_secundaria: z
  .enum(['dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'fiado'])
  .optional(),
valor_secundario: z.number().positive().optional(),
```

Validações novas (antes de criar o pedido):

- Se `forma_pagamento_secundaria` presente e igual a `forma_pagamento` →
  erro "As duas formas de pagamento precisam ser diferentes".
- Se `forma_pagamento_secundaria` presente sem `valor_secundario` (ou
  vice-versa) → erro "Informe o valor da segunda forma de pagamento".
- Se `valor_secundario >= total` → erro "O valor da segunda forma não pode
  ser maior ou igual ao total da venda".
- Se as duas formas forem `'fiado'` → erro (já coberto pelo primeiro check,
  já que só há uma forma "fiado" possível — a validação de "diferentes" já
  barra isso).

Determinação de qual perna é fiado (pode ser a principal OU a secundária):

```ts
const pernaFiado =
  forma_pagamento === 'fiado'
    ? { forma: 'fiado' as const, valor: valorSecundario != null ? total - valorSecundario : total }
    : forma_pagamento_secundaria === 'fiado'
      ? { forma: 'fiado' as const, valor: valorSecundario ?? 0 }
      : null
```

- `pernaFiado` é usada pro check de `limite_credito` (soma `divida +
  pernaFiado.valor > limite`) e pra criar a linha em `contas_receber` com
  `valor: pernaFiado.valor`.
- Cliente obrigatório se `pernaFiado !== null`.
- `pago` continua com a mesma regra de hoje (`tipo_fulfillment === 'balcao'
  ? true : (parsed.data.pago ?? false)`) — não depende do split.

## 3. `editarVenda` — expandido pra tudo

Além de itens (já existe), passa a aceitar e recalcular:

- **Cliente** (`cliente_id`): pode trocar, adicionar (balcão sem cliente →
  com cliente) ou remover, com a mesma regra "fiado exige cliente".
- **Frete e desconto**: números livres, recalculam `total` junto com os
  itens (já é feito hoje pra frete/desconto vindos do pedido original; agora
  também aceitam um novo valor).
- **Tipo (balcão/entrega/retirada) e endereço**: ao mudar tipo, dois casos:
  - `balcao → entrega/retirada`: limpa `concluido_em` (a venda deixa de
    estar "concluída na hora" e passa a aguardar entrega/retirada de novo).
  - `entrega/retirada → balcao`: seta `concluido_em = now()` (mesma regra
    de criação).
  - Isso é o motivo de `podeEditarPedido` já levar `tipo_fulfillment` em
    conta (ver fix de hoje) — o tipo pode mudar no meio da edição.
- **Forma(s) de pagamento**: mesma validação do `registrarVenda`
  (diferentes, valor da secundária < total, cliente se fiado). A parte mais
  delicada é reconciliar com `contas_receber`:
  - **Não tinha fiado, passou a ter**: cria a linha em `contas_receber`
    (mesma lógica de `registrarVenda`).
  - **Tinha fiado, deixou de ter** (as duas formas novas são à vista):
    cancela a linha — mas **bloqueia** se já existe `valor_pago > 0`
    registrado nela (não dá pra "desfazer" um recebimento já lançado; erro:
    "Essa venda já tem R$ X,XX recebidos como fiado — não dá pra tirar o
    fiado sem estornar o recebimento primeiro").
  - **Continua tendo fiado** (mudou só o valor da perna, ou trocou qual das
    duas é a fiado): atualiza `valor` da conta existente, com a mesma trava
    de hoje (não reduzir abaixo do `valor_pago`).

`revalidatePath` continua nas mesmas rotas (`/pedidos/[id]`, `/pedidos`,
`/dashboard`), mais `/financeiro/a-receber` quando mexe em `contas_receber`
e `/caixa` (o preview do dia muda se a forma mudou).

## 4. Formulário único (`VendaForm`)

`components/movimentacao/FormSaida.tsx` e
`components/pedido/EditarVendaForm.tsx` viram um componente só,
`components/pedido/VendaForm.tsx`, recebendo um prop `modo: 'criar' |
'editar'`:

- Em `criar`: comportamento idêntico ao `FormSaida` de hoje, chama
  `registrarVenda`.
- Em `editar`: pré-populado com os dados do pedido (itens, cliente, forma(s)
  de pagamento, frete, desconto, tipo, endereço), chama `editarVenda`.
- A seção de pagamento ganha um checkbox "Dividir em duas formas?" — quando
  marcado, mostra um segundo seletor de forma + campo de valor (a forma
  principal mostra o valor restante calculado, não editável diretamente).
  Isso substitui visualmente o checkbox "Cliente já pagou uma parte?" que
  já existe pro caso fiado parcial — vira só mais uma combinação possível
  do mesmo controle genérico.
- `app/(app)/movimentacoes/nova/page.tsx` e
  `app/(app)/pedidos/[id]/editar/page.tsx` passam a montar o mesmo
  `<VendaForm>` com props diferentes. A página de editar busca um pedido
  mais completo agora (cliente, forma(s), frete, desconto, tipo, endereço —
  não só itens como `buscarItensParaEditar` faz hoje).

`FormaVenda`/`ItemPedido` (`types/index.ts`) não mudam — só o pedido em si
ganha os campos novos no tipo usado pelo form.

## 5. Onde mais isso mexe

- `lib/pedido-labels.ts`: `rotuloPagamento` passa a aceitar a venda inteira
  (não só a string) e formatar `"Dinheiro + Pix"` quando há
  `forma_pagamento_secundaria`; mais o helper `somarPorForma` da seção 1.
- `components/romaneio/CupomFiscal.tsx`: linha "PGTO:" vira duas linhas
  quando há split (`"Dinheiro: R$ 50,00"` / `"Pix: R$ 30,00"`).
- `app/(app)/pedidos/[id]/page.tsx`: mostra as duas formas quando há split.
- `lib/actions/clientes-stats.ts` e `lib/actions/movimentacoes.ts`: só
  **exibem** `forma_pagamento` (não somam por forma) — recebem o rótulo
  novo via `rotuloPagamento`, sem mudança estrutural.

## 6. Testes manuais (antes de dar por concluído)

1. Nova venda com split 100% à vista (dinheiro + cartão) — conferir cupom,
   `/pedidos/[id]`, e que `/caixa` soma cada forma separada.
2. Nova venda fiado parcial (caso que já existia) — confirmar que continua
   funcionando com as colunas renomeadas.
3. Editar venda: forma única → split; adicionar cliente que não tinha;
   balcão → entrega e volta; mudar frete/desconto — conferir total e
   `contas_receber` batem em cada caso.
4. Tentar remover fiado de uma venda que já tem valor pago — deve bloquear
   com a mensagem certa.
5. Pedido fora da janela de edição (outro dia ou caixa fechado) — continua
   404 em `/pedidos/[id]/editar`.
6. `npx tsc --noEmit`, `npx eslint . --quiet`, `npx next build` a cada
   task. Toda venda de teste criada é limpa do banco no final (estoque
   restaurado via `ajustar_estoque`, linhas de pedido/contas_receber
   apagadas).
