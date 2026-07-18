# Editar venda (itens) + Pedidos recentes no Dashboard — Design

**Data:** 2026-07-18
**Contexto:** Cliente relatou que às vezes quer adicionar ou tirar item
de um pedido já registrado (mudou de ideia). Hoje o sistema só tem
"Cancelar venda" (`BotaoCancelar`/`cancelarVenda`), que devolve tudo pro
estoque e marca `status = 'cancelada'` — não existe edição. O Renan
também quer ver os últimos pedidos direto no Dashboard, com botão de
reimprimir (já existe, é a rota do romaneio) e editar.

## Decisões (das perguntas respondidas)

- Só é possível editar venda **do dia atual**, com o **caixa daquele dia
  ainda não fechado**. Depois de fechado, só cancelar — evita mudar
  retroativamente um número que o Renan já bateu "às cegas".
- Decisão própria, não perguntada mas necessária: só edita venda que
  **ainda não foi entregue/retirada** (`concluido_em` vazio) — depois de
  entregue não tem mais o que trocar de item fisicamente.
- Venda **fiado também pode ser editada**: o valor da conta a receber
  vinculada é atualizado junto. Se o novo total ficar **menor que o que
  já foi pago**, bloqueia com erro (não dá pra dever menos que já
  recebeu).
- Escopo: só **itens** (adicionar/tirar/mudar quantidade). Cliente,
  forma de pagamento, frete, desconto e dados de entrega não mudam
  nessa versão.

## 1. Regra de elegibilidade

```ts
function podeEditarPedido(p: {
  status: string
  data_pedido: string
  concluido_em: string | null
}, caixaFechadoHoje: boolean): boolean {
  const hoje = hojeBrasil()
  return (
    p.status === 'concluida' &&
    !p.concluido_em &&
    p.data_pedido.startsWith(hoje) &&
    !caixaFechadoHoje
  )
}
```

`caixaFechadoHoje` vem de checar se existe linha em `caixa_fechamentos`
pra `(local_id, data = hoje)` — mesma tabela/chave que `fecharCaixa()`
já usa (`upsert(..., { onConflict: 'local_id,data' })` em
`lib/actions/caixa.ts`).

## 2. `editarVenda(pedidoId, novosItens)` — o motor

Em `lib/actions/pedidos.ts`, mesma responsabilidade de
`registrarVenda`/`cancelarVenda`, mas recalculando a diferença em vez de
criar do zero:

1. Busca o pedido (`status`, `data_pedido`, `concluido_em`, `local_id`,
   `forma_pagamento`, `frete`, `desconto_total`) e os `pedido_itens`
   atuais (`produto_id`, `quantidade_pedida`). Revalida
   `podeEditarPedido` no servidor (não confiar só na UI escondendo o
   botão).
2. Monta um mapa `produto_id -> quantidade` do estado **antigo** e do
   **novo** (`novosItens`). Pra cada `produto_id` que aparece em
   qualquer um dos dois lados, calcula `delta = qtdNova - qtdAntiga`.
3. Pré-checagem de estoque (mesmo padrão de `registrarVenda`): pra todo
   `produto_id` com `delta > 0` (aumentou), confere se
   `estoque.saldo_atual >= delta` antes de mexer em qualquer coisa —
   erro com nome do produto se não tiver.
4. Pra cada `produto_id` com `delta != 0`, chama
   `ajustar_estoque(produto_id, -delta)` (delta positivo = baixa mais
   estoque, negativo = devolve) e loga em `movimentacoes_estoque`:
   - `delta < 0` (aumentou a venda, saiu mais estoque) → `tipo:
     'saida_venda'` (mesmo tipo que uma venda nova usa).
   - `delta > 0` (diminuiu/removeu, estoque volta) → `tipo:
     'devolucao_cliente'` (mesmo tipo que `cancelarVenda` usa).
   - **Importante:** `movimentacoes_estoque.tipo` tem um CHECK
     constraint no banco limitado a
     `['entrada_compra','saida_venda','ajuste_inventario','descarte','devolucao_cliente','devolucao_fornecedor']`
     — não dá pra inventar um tipo novo tipo `'edicao_venda'` sem
     migration. Reusar esses dois já cobre o significado real da
     mudança, sem precisar mexer no schema.
5. Deleta os `pedido_itens` antigos e insere os novos (mesmo formato de
   `registrarVenda`: `produto_id, quantidade_pedida, preco_unitario,
   total, embalagem_nome, embalagem_unidades`).
6. Recalcula `subtotal = soma dos totais dos novos itens` e `total =
   subtotal + frete - desconto_total` (frete/desconto do pedido não
   mudam). Atualiza a linha de `pedidos`.
7. Se `forma_pagamento === 'fiado'`: busca a `contas_receber` vinculada
   (`pedido_id = pedidoId`). Se `novoTotal < valor_pago` já registrado,
   erro: "Não é possível reduzir o total abaixo do que já foi pago
   (R$ X)". Senão, atualiza `valor = novoTotal` e recalcula `status`
   (`'pago'` se `valor_pago >= novoTotal`, senão `'aberto'`).
8. `revalidatePath('/pedidos/' + pedidoId)`, `revalidatePath('/pedidos')`,
   `revalidatePath('/dashboard')`.

## 3. Buscar os itens atuais no formato certo pra editar

Nova função `buscarItensParaEditar(pedidoId)` em `lib/actions/pedidos.ts`,
que devolve `ItemPedido[]` (mesmo tipo usado por `FormSaida.tsx` /
`ListaItensPedido`) já pronto pra popular a tela de edição:

- Busca `pedido_itens` do pedido, joinado com `produtos(nome, categoria,
  preco_venda_padrao, produto_embalagens(id, nome, unidades, preco,
  padrao), estoque(saldo_atual))` — mesmo shape que `buscarProdutos()`
  já usa em `lib/actions/produtos.ts`.
- Pra cada item, monta a lista `formas` igual a `BuscaProduto.tsx`
  (`selecionar()`): embalagens cadastradas ordenadas (padrão primeiro,
  depois por unidades), ou um fallback `Unidade` se o produto não tiver
  nenhuma.
- Acha o `formaId` que bate com o que foi vendido (`forma.nome ===
  embalagem_nome && forma.unidades === embalagem_unidades`). Se não
  achar (embalagem foi renomeada/apagada depois da venda), cria uma
  entrada sintética `custom-${produto_id}` com esse nome/unidades —
  mesmo padrão da opção "Outra" que `ListaItensPedido` já trata
  (`customId = \`custom-${item.produto_id}\``).
- `qtdFormas = quantidade_pedida / (embalagem_unidades ?? 1)`,
  `precoForma = preco_unitario * (embalagem_unidades ?? 1)`.

## 4. Tela `/pedidos/[id]/editar`

- `app/(app)/pedidos/[id]/editar/page.tsx` (server component): busca o
  pedido, checa `podeEditarPedido` (se não elegível, `notFound()` — não
  dá pra chegar nessa URL por fora se a venda não pode ser editada),
  chama `buscarItensParaEditar`, renderiza `EditarVendaForm`.
- `components/pedido/EditarVendaForm.tsx` (client, novo, próprio —
  **não** mexe em `FormSaida.tsx`): estado local `itens: ItemPedido[]`
  inicializado com os itens vindos do servidor, reaproveitando
  `BuscaProduto` (adicionar) e `ListaItensPedido` (listar/remover/mudar
  qtd) exatamente como a comanda da venda usa. Botão "Salvar alterações"
  chama `editarVenda(pedidoId, itens)`; sucesso volta pra
  `/pedidos/[id]`.

## 5. Botão "Editar" nos lugares certos

- `/pedidos/[id]`: ao lado do botão "Romaneio"/"Cancelar venda",
  aparece "Editar" só quando `podeEditarPedido` (checado no server
  component da página, mesma função do item 1).
- `/pedidos` (listagem): idem, um botão/link por linha quando elegível.
- **Dashboard**: nova seção "Pedidos recentes" (5 últimos do local,
  qualquer status), cada linha com número, cliente, total, status, e
  dois botões: **Reimprimir** (sempre, link pra
  `/pedidos/[id]/romaneio`, já existe) e **Editar** (só se elegível,
  link pra `/pedidos/[id]/editar`).

## O que NÃO muda

- Cancelar venda continua igual, sem relação com editar.
- Cliente, forma de pagamento, frete, desconto, entrega/retirada não são
  editáveis nessa versão — só itens.
- Sem histórico de edições (não grava "o que era antes"), só o estado
  final.

## Verificação

- `npx tsc --noEmit`, `npx eslint . --quiet`, `npx next build`.
- Teste manual: registrar venda de teste, editar (adicionar item, tirar
  item, mudar quantidade), conferir que o total e o estoque batem
  depois. Testar também com fiado (conferir que a conta a receber
  acompanha). Limpar o teste do banco no final, como já vem sendo feito
  nesta sessão.
