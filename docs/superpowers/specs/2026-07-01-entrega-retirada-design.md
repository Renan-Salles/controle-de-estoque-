# Entrega / Retirada

## Contexto

Sub-projeto 4 dos 4 levantados na sessão de reorganização de navegação
(01/07/2026): opção de entrega ou retirada na loja, com controle de
pagamento e conclusão. Dependia do sub-projeto 3 (Equipe + convite), já
implementado — agora dá pra saber "quem é entregador" via login próprio.

Pedido original do usuário (verbatim, resumido): quer poder escolher, na
venda, se é entrega ou retirada na loja. Na retirada, controlar se o
pagamento foi feito e se a pessoa já retirou ou não. Na entrega, escolher
quem vai entregar, esse alguém confirma se entregou ou não, e também se
teve pagamento. Quer também poder cobrar frete ou não.

## Modelo de dados

4 colunas novas em `pedidos` (nenhuma mudança em `pedido_itens`,
`contas_receber` ou no restante do modelo):

- `tipo_fulfillment` (varchar, check in `'balcao' | 'entrega' | 'retirada'`,
  default `'balcao'`, not null). Vendas de balcão (a esmagadora maioria
  hoje) continuam com esse valor implícito — nenhuma mudança de
  comportamento pra elas.
- `entregador_id` (uuid, FK `profiles`, nullable) — só preenchido quando
  `tipo_fulfillment = 'entrega'`. Qualquer pessoa ativa da Equipe pode ser
  escolhida (sem exigir um cargo "Entregador" específico).
- `frete` (numeric, default 0, not null) — valor livre digitado pelo caixa,
  soma no `total` do pedido.
- `pago` (boolean, default true, not null) — pra `'balcao'` sempre `true`
  (pagamento acontece junto da venda, como hoje). Pra `'entrega'`/`'retirada'`
  o caixa decide na hora do registro (desmarcado por padrão, mas pode já
  marcar como pago se o cliente pagou adiantado).
- `concluido_em` (timestamptz, nullable) — quando confirma que
  entregou/retirou. `null` = ainda pendente. Só relevante quando
  `tipo_fulfillment != 'balcao'`.

O estoque continua baixando no momento do registro da venda, igual hoje —
`tipo_fulfillment`/`pago`/`concluido_em` só controlam o acompanhamento
comercial (pagamento e entrega), não o estoque.

## Nova Venda (FormSaida)

Ganha um segmented control logo abaixo do cliente: **Balcão** (padrão) /
**Entrega** / **Retirar depois**.

- **Balcão**: nenhum campo extra — formulário idêntico ao de hoje.
- **Entrega**: aparecem 3 campos novos:
  - **Quem vai entregar** — select com as pessoas ativas da Equipe
    (reaproveita `listarUsuariosComCargo()`, filtrado por `status='ativo'`).
  - **Frete (R$)** — campo numérico, `0` por padrão.
  - **Já foi pago** — checkbox, desmarcado por padrão.
- **Retirar depois**: só o checkbox **Já foi pago**, desmarcado por padrão.

Forma de pagamento continua sendo escolhida no mesmo lugar de sempre
(dinheiro/pix/cartão/fiado), mesmo pra entrega/retirada — só o "aconteceu
de verdade" (o checkbox "Já foi pago") fica pendente até confirmar.

`registrarVenda` (já existente em `lib/actions/pedidos.ts`) recebe os 4
campos novos no payload e grava tudo na mesma inserção em `pedidos` que já
faz hoje. `total` passa a ser `subtotal + frete`.

## Confirmar entrega/retirada

Direto na tela que já existe (`/pedidos/[id]`), sem página nova e sem
trava de "só o entregador confirma" — qualquer pessoa com acesso a pedidos
pode confirmar (mais simples, e cobre o caso de alguém confirmar por
telefone/WhatsApp em nome do entregador).

A tela ganha:
- Um card mostrando tipo (Entrega/Retirada), quem vai entregar (se
  aplicável), frete (se > 0), e o status de pagamento/conclusão.
- Dois botões independentes, cada um só aparece se ainda pendente:
  **"Marcar como pago"** (grava `pago = true`) e **"Marcar como
  entregue"**/**"Marcar como retirado"** (rótulo muda conforme o tipo;
  grava `concluido_em = now()`). São ações separadas — pode confirmar
  entrega sem ter confirmado pagamento ainda, e vice-versa.

Nova server action `marcarPagoPedido(pedidoId)` e `marcarConcluidoPedido(pedidoId)`
em `lib/actions/pedidos.ts`.

## Movimentações: filtros novos

A barra de filtros (hoje: Todas/Vendas/Entradas) ganha **"Aguardando
entrega"** e **"Aguardando retirada"** — pedidos com
`tipo_fulfillment` correspondente e `concluido_em is null`. Cada linha da
lista, quando `tipo_fulfillment != 'balcao'`, ganha um badge de status
("Aguardando entrega"/"Entregue" ou "Aguardando retirada"/"Retirado").

## Fora de escopo

- Não há geolocalização, cálculo automático de frete, nem rastreamento de
  rota do entregador — é tudo manual (o próprio usuário confirmou: frete é
  valor livre, sem regra automática).
- Não cria cargo "Entregador" — qualquer pessoa ativa da Equipe pode ser
  escolhida.
- Não trava a confirmação de entrega só pra quem foi designado como
  entregador — qualquer um com acesso a pedidos confirma.
- Não muda `contas_receber`/fiado — pagamento de fiado continua com seu
  próprio fluxo já existente, independente do `pago` desta feature (uma
  venda fiado com entrega ainda usa `contas_receber` pra cobrança, e o
  campo `pago` aqui só reflete se o valor da entrega/retirada já entrou
  fisicamente, não o status do fiado).

## Testes

- Registrar venda Balcão: nenhuma mudança visível, comportamento idêntico
  a hoje.
- Registrar venda Entrega: escolhe entregador + frete, total soma o
  frete corretamente, pedido nasce com `pago=false`/`concluido_em=null`.
- Registrar venda Retirar depois com "Já foi pago" marcado: pedido nasce
  `pago=true`, `concluido_em=null`.
- Na tela do pedido: marcar "pago" e depois "entregue"/"retirado"
  separadamente, cada botão some depois de confirmado.
- Movimentações: filtro "Aguardando entrega" mostra só pedidos de entrega
  com `concluido_em is null`; some da lista depois de confirmado.
