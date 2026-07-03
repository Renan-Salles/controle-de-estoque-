# Backlog pós-teste ao vivo (03/07/2026)

## Contexto

Depois do mega pacote de 03/07, o Renan testou o sistema inteiro ao vivo
(uma sessão de QA completa cobrindo cadastros, venda, entrega, financeiro,
estoque) e trouxe 4 pedidos concretos. Achados de bug já foram corrigidos
à parte (fornecedor não listava, rótulo errado no card de entrega, tela de
contagem não atualizando, layout pulando por causa da scrollbar). Este
documento cobre as 4 features novas, na ordem combinada com o usuário:

1. Mover "Fiado" pro grupo Operação do menu
2. Fiado parcial (paga uma parte agora, resto vira fiado)
3. Endereço de entrega em texto livre quando não tem cliente cadastrado
4. Tela do entregador: saudação, expediente/disponibilidade, estimativa

O item "polimento geral de design/animações do sistema inteiro" citado
pelo usuário fica **fora** deste documento — é vago demais pra virar spec
agora; tratar tela por tela conforme for aparecendo necessidade.

## 1. Nav: mover Fiado pra Operação

Hoje "A receber" vive em `GRUPO_RELATORIOS` (sub-rótulo "Financeiro"),
`components/shell/nav-items.tsx`. Passa a virar um item chamado **"Fiado"**
dentro de `GRUPO_OPERACAO`, na última posição (depois de Caixa):
Pedidos → Movimentações → Estoque → Caixa → **Fiado**.

- A rota não muda (`/financeiro/a-receber`) — só o rótulo e o grupo do
  menu. Evita quebrar link/atalho existente.
- Ícone mantém `HandCoins`.
- `lib/nav-catalogo.ts` (catálogo de permissões da tela de Cargos) muda o
  campo `grupo` desse item de `'Relatórios'` pra `'Operação'`, só por
  consistência visual na tela de Cargos — não muda o comportamento de
  permissão em si (já funciona por cargo hoje, `itens_visiveis`).

## 2. Fiado parcial

**Problema:** hoje uma venda tem uma única `forma_pagamento`. Se é
`'fiado'`, o **valor total** vira uma linha em `contas_receber`. Não dá
pra registrar "cliente pagou R$20 agora em dinheiro, os R$30 restantes
ficam fiado com vencimento em 7 dias" numa venda só.

**Modelo de dados** — 2 colunas novas em `pedidos`:
- `valor_pago_agora` (numeric, not null, default 0) — quanto do total já
  entrou fisicamente no ato da venda.
- `forma_pagamento_parcial` (varchar, nullable, check in
  `dinheiro | pix | cartao_debito | cartao_credito`) — em qual forma
  esse valor entrou. Só preenchido quando `forma_pagamento = 'fiado'` e
  `valor_pago_agora > 0`.

Nenhuma coluna nova em `contas_receber` — a tabela **já tem**
`valor` (total) e `valor_pago` (usado até hoje só quando alguém abate um
fiado depois). `registrarVenda` passa a inserir
`valor_pago = valor_pago_agora` (em vez de sempre `0`) na criação da
conta a receber. "Quanto falta pagar" (`valor - valor_pago`) já funciona
sem mudar a tela de Fiado.

**`registrarVenda` (`lib/actions/pedidos.ts`):**
- Novos campos opcionais no payload: `valor_pago_agora` (number, min 0),
  `forma_pagamento_parcial` (enum das 4 formas à vista).
- Validação: só aceita os dois campos quando `forma_pagamento === 'fiado'`.
  Se `valor_pago_agora > 0`, exige `forma_pagamento_parcial` preenchido.
  `valor_pago_agora` não pode passar de `total`.
- Cálculo do limite de crédito (que hoje soma `valor - valor_pago` das
  contas abertas) já funciona sem mudança, porque a conta nasce com o
  `valor_pago` certo.

**FormSaida (UI):** ao escolher forma de pagamento "Fiado", aparece um
checkbox **"Cliente já pagou uma parte?"** (desmarcado por padrão). Se
marcado, abrem 2 campos: **"Valor pago agora (R$)"** (número, máx =
total) e **"Forma de pagamento"** (select com as 4 formas à vista).
Abaixo, uma linha de resumo: *"Vai ficar fiado: R$ X, vencimento em
DD/MM"* (X = total − valor pago agora), recalculada ao digitar.

**Caixa e Formas de pagamento (o que precisa somar o valor parcial):**
- `resumoDoDia()` em `lib/actions/caixa.ts` — hoje filtra
  `pago = true` e soma `total` por `forma_pagamento`. Passa a também
  somar, pra cada forma, o `valor_pago_agora` dos pedidos com
  `forma_pagamento = 'fiado'` e `forma_pagamento_parcial` igual à forma
  em questão (esses pedidos entram nessa segunda soma independente do
  campo `pago`, que continua descrevendo se o **saldo fiado dessa
  entrega/retirada** foi resolvido, não se o valor à vista já entrou).
- `buscarFormasPagamento()` em `lib/actions/financeiro.ts` — mesmo
  ajuste: soma adicional de `valor_pago_agora` por
  `forma_pagamento_parcial`, dentro do bucket da forma correspondente.
- `buscarCaixaDia()` (mesmo arquivo) é uma função legada que parece não
  ser mais consumida por nenhuma tela atual (superada por `resumoDoDia`)
  — não mexer nela agora; se o plano confirmar que está morta, remover
  em vez de duplicar a lógica.

**Cupom/comprovante e tela do pedido:** quando houver `valor_pago_agora`,
mostrar as duas linhas separadas ("Pago agora: R$X (Dinheiro)" / "Fiado:
R$Y, vence em DD/MM") em vez de só "PGTO: Fiado (N dias)".

**Fora de escopo:** misturar duas formas **à vista** entre si (ex.: metade
dinheiro, metade Pix, sem fiado envolvido) fica fora — o usuário confirmou
que o caso real é especificamente "parte à vista + resto fiado".

## 3. Endereço de entrega em texto livre sem cliente

**Problema:** com tipo "Entrega" e sem cliente selecionado, o formulário
só mostra "Quem vai entregar" + "Frete" — não existe onde digitar o
endereço. O card do entregador (`CardEntrega.tsx`) então mostra "Endereço
não cadastrado" pra sempre nesse caso.

**Modelo de dados:** 1 coluna nova em `pedidos`:
- `endereco_entrega` (jsonb, nullable) — mesmo formato usado em
  `clientes.endereco`: `{ rua, numero, bairro, cidade }`. Escolhido esse
  formato (em vez de texto único) pra poder reaproveitar
  `enderecoPartes()` (já existe em `CardEntrega.tsx`) sem duplicar lógica
  de formatação, e pra permitir que o bairro digitado dispare a mesma
  busca de taxa de entrega que já existe pra cliente cadastrado.

**FormSaida (UI):** quando tipo = Entrega **e** nenhum cliente
selecionado, aparecem os 4 campos de endereço (Rua, Número, Bairro,
Cidade) — mesmo `FormSection`/`Campo` usado em `ClienteForm.tsx`. Digitar
o bairro dispara a mesma busca de taxa cadastrada (`Configurações >
Taxas`) que já auto-preenche o frete pro fluxo com cliente. Quando um
cliente **é** selecionado, os campos de endereço somem (usa o endereço do
cadastro do cliente, como já funciona hoje) — assim não há ambiguidade
sobre qual endereço vale.

**`registrarVenda`:** novo campo opcional `endereco_entrega` (mesmo shape
do jsonb), só aceito/gravado quando `tipo_fulfillment === 'entrega'` e
`cliente_id` é nulo.

**Leitura (card do entregador e tela do pedido):** `listarMinhasEntregas()`
e a query de `/pedidos/[id]` passam a selecionar também
`pedidos.endereco_entrega`. `CardEntrega.tsx` usa
`entrega.cliente?.endereco ?? entrega.endereco_entrega` (nessa ordem —
cliente sempre tem prioridade se por algum motivo os dois existirem) em
vez de só `entrega.cliente?.endereco`. Só quando os dois forem nulos é
que continua mostrando "Endereço não cadastrado".

## 4. Tela do entregador: saudação, expediente, estimativa

**Modelo de dados** — tabela nova `entregador_turnos`:
- `id` (uuid, pk)
- `entregador_id` (uuid, FK `profiles`)
- `local_id` (uuid, FK `locais`)
- `iniciado_em` (timestamptz, not null, default now())
- `encerrado_em` (timestamptz, nullable — null = turno em aberto/em curso)

Um entregador só pode ter **um** turno em aberto por vez (índice único
parcial `where encerrado_em is null`). "Iniciar expediente" insere uma
linha; "Encerrar expediente" grava `encerrado_em = now()` na linha aberta.

**`TelaEntregador.tsx` — mudanças:**
- **Saudação por horário:** troca "Fala, {nome}!" por Bom dia / Boa
  tarde / Boa noite conforme a hora local (Brasil), mantendo o nome:
  "Bom dia, {nome}!".
- **Toggle de expediente:** card no topo (abaixo do cabeçalho) com botão
  **"Iniciar expediente"** quando não há turno aberto, ou, quando há,
  mostra **"Em expediente há Xh Ymin"** + botão **"Encerrar expediente"**.
  O tempo de expediente é calculado a partir de `iniciado_em` (client
  component com re-render por `setInterval`, não precisa ser
  segundo-a-segundo preciso).
- **Disponibilidade = ter turno aberto ou não** — não cria um status
  "disponível/indisponível" separado do turno, pra não duplicar conceito
  (turno aberto **é** "disponível pra receber entrega"; turno fechado
  **é** "indisponível"). Times/admin enxergam isso no relatório de
  entregadores (ver abaixo).
- **Estimativa de tempo por entrega:** não existe geolocalização no
  sistema (fora de escopo confirmado em CLAUDE.md), então a "estimativa"
  é o **tempo médio histórico desse entregador**, o mesmo número que já
  é calculado em `/relatorios/entregadores` — mostrado como texto
  auxiliar tipo "Você costuma levar ~12 min por entrega" no topo da
  tela, não uma previsão por pedido específico.

**Relatório de entregadores (`/relatorios/entregadores`):** ganha uma
coluna/indicador de turno atual (em expediente agora / fora de
expediente), lendo `entregador_turnos` por `encerrado_em is null`.

**Fora de escopo:** notificação push quando inicia turno, geolocalização
real, cálculo de rota/ETA por endereço — nada disso existe no sistema e
não entra aqui.

## Testes (todos os 4 itens)

- Nav: item "Fiado" aparece em Operação, sumiu de Relatórios/Financeiro;
  rota e conteúdo da página inalterados; some/aparece por cargo igual
  antes.
- Fiado parcial: venda fiado sem marcar "pagou uma parte" continua
  idêntica a hoje (valor_pago nasce 0). Marcando e informando R$20 de
  R$50 em dinheiro: conta a receber nasce com valor=50, valor_pago=20
  (falta R$30 na tela de Fiado); Caixa do dia soma os R$20 em "Dinheiro
  esperado"; Formas de pagamento do mês soma os R$20 em "Dinheiro".
- Endereço livre: venda tipo Entrega sem cliente, preenchendo bairro
  "Pituba" com taxa cadastrada, auto-preenche frete igual ao fluxo com
  cliente. Card do entregador mostra o endereço digitado em vez de
  "Endereço não cadastrado".
- Tela do entregador: saudação muda conforme horário do teste. Botão
  "Iniciar expediente" cria turno e passa a mostrar o cronômetro +
  "Encerrar expediente"; ao encerrar, volta a mostrar "Iniciar
  expediente". Relatório de entregadores reflete o turno aberto/fechado.
