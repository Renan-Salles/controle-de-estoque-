# Melhorias gerais do DepSys — Design

**Data:** 2026-07-02
**Contexto:** Depois da reorganização da navegação + feature de Pedidos, o
Renan pediu uma leva grande de melhorias no sistema inteiro. Fiz uma
varredura visual (24 telas, desktop + mobile via Playwright) e juntei o
que ele pediu com os bugs que achei na varredura.

O DepSys não é só um controle de estoque: é o sistema operacional do
negócio de bebidas, onde cada função (dono, funcionário de balcão,
entregador) enxerga só a fatia que importa pra ela, tudo puxando do mesmo
dado (a venda) com recortes diferentes. Este design leva essa ideia
adiante em 3 frentes grandes + 4 correções pontuais.

---

## Frente 1 — Cargos e o Entregador

### 1a. Consolidar cargos em Admin / Funcionário / Entregador

Hoje existem os cargos **Administrador**, **Gerente** e **Caixa**. O
Renan quer simplificar pra 3 papéis claros:

- **Admin** — vê tudo (sem mudança).
- **Funcionário** — opera o dia a dia: Pedidos, Movimentações, Estoque,
  Cadastro (Clientes/Fornecedores/Produtos). **Sem** Relatórios nem
  Financeiro. Consolida o que hoje é Gerente + Caixa num cargo só.
- **Entregador** — só a tela de entregas dele (ver 1b).

Migration consolida: apaga Gerente e Caixa, cria Funcionário com o
conjunto certo de `itens_visiveis`. Como nenhum profile real usa
Gerente/Caixa ainda (só o admin Renan existe), não há risco de quebrar
acesso de ninguém — mas a migration é escrita defensiva (só remove
cargos sem nenhum profile vinculado; se algum tiver, converte em vez de
apagar).

### 1b. Tela do Entregador

O cargo Entregador não tem itens na sidebar. Em vez de criar rota nova +
mexer no sistema de redirect de autenticação (que tem gotcha documentado),
a página `/dashboard` — que já é o destino seguro pra qualquer cargo —
passa a renderizar conteúdo diferente por cargo:

- Cargo Entregador → **tela de entregas** (layout mobile-first, sem
  sidebar/topbar de admin, cabeçalho simples com logo + nome + sair).
- Qualquer outro cargo → o dashboard normal de hoje.

A tela de entregas lista **as entregas pendentes dele**
(`entregador_id = ele`, `tipo_fulfillment = 'entrega'`, `concluido_em
is null`, do local dele), um card por entrega mostrando:

- Nº do pedido, cliente, valor total e forma de pagamento (pra saber se
  cobra na entrega).
- **De onde saiu** (R$ Depósito / Império Salles) → **endereço de
  destino** (cadastrado no cliente; se faltar endereço, mostra aviso em
  vez de quebrar).
- Botões **Ligar** (`tel:`) e **WhatsApp** (`wa.me`) com o telefone do
  cliente.
- Os botões que já existem: "Marcar que saiu para entrega" e "Marcar
  como entregue".

Sem histórico/aba de concluídas — só o que falta fazer. Lista vazia =
"Nenhuma entrega pra você agora".

**Confirmação continua aberta:** admin/funcionário seguem podendo marcar
saiu/confirmado de qualquer entrega em `/pedidos` (destrava manual). O
entregador só ganha o poder de fazer isso ele mesmo, pelas dele.

**Fora de escopo:** geolocalização/mapa (só endereço em texto);
restringir quem pode ser designado como entregador (segue "qualquer
pessoa ativa da equipe").

---

## Frente 2 — Produto com várias embalagens de venda

### O problema

Hoje cada produto tem **uma** embalagem só (`embalagem` +
`fator_conversao` em `produtos`). Mas depósito de bebidas vende o mesmo
produto de várias formas ao mesmo tempo: uma lata solta, um fardo de 12,
uma caixa de 24 — cada uma com preço próprio. É o padrão do mercado:
estoque contado sempre na unidade base, e o sistema desconta N unidades
conforme a embalagem escolhida na venda. O sistema atual não modela isso.

### O modelo novo

Tabela nova **`produto_embalagens`** (uma linha por forma de venda de um
produto):

- `produto_id` (FK)
- `nome` (ex. "Fardo 12", "Caixa 24", "Unidade")
- `unidades` (quantas unidades base fecham essa embalagem — 1 pra
  unidade avulsa, 12 pro fardo, etc.)
- `preco` (preço de venda daquela embalagem fechada)
- `padrao` (bool — a embalagem sugerida por default no PDV)

Todo produto **sempre** tem ao menos a embalagem "Unidade"
(`unidades=1`), criada automaticamente. As demais são opcionais e o
Renan adiciona quantas quiser.

**Cadastro de Produto** ganha uma seção "Formas de venda" com uma
lista editável: a Unidade (preço, sempre presente) + botão "adicionar
embalagem" pra cada caixa/fardo, cada uma com nome + unidades + preço.

**Migration de dados:** converte o que já existe. Cada produto atual
vira: 1 embalagem "Unidade" (preço = `preco_venda_padrao`) + se o
produto tinha `embalagem != 'unidade'`, uma segunda embalagem com aquele
nome/fator (preço = `preco_venda_padrao * fator`, uma estimativa que o
Renan ajusta depois). Os campos antigos `embalagem`/`fator_conversao`
ficam por ora (não quebra nada que lê eles), mas param de ser a fonte da
verdade pra venda.

**Na venda:** ao adicionar um produto na comanda, em vez do botão único
"vender caixa fechada" de hoje, aparece um seletor das embalagens
cadastradas daquele produto. Escolheu "Fardo 12" → a linha entra já com
12 unidades e o preço do fardo. O backend continua recebendo tudo em
unidade base (não muda `registrarVenda`/`ajustar_estoque`), só a UI que
traduz. O `pedido_itens` passa a guardar qual embalagem foi vendida
(nome + unidades), pro recibo/romaneio/detalhe mostrarem certo — hoje
isso se perde.

---

## Frente 3 — Visual da tela de vendas

Decorre da Frente 2 (mudar o dado força mexer na tela), mas vale tratar
como item próprio de polish:

- Seletor de embalagem claro na linha da comanda, mostrando "= N
  unidades" e o preço batendo na hora.
- Deixar explícito quanto de estoque (em unidades) aquela escolha
  consome, pra não vender caixa fechada sem saldo.
- Ajustes de leitura/toque no fluxo (o balcão é rápido, mobile importa).

Escopo fechado junto com a Frente 2 no plano — não é reescrita da tela,
é a adaptação dela ao modelo de múltiplas embalagens + refino visual.

---

## Frente 4 — Correções encontradas na varredura

### 4a. Reposição: status "OK" contraditório com sugestão de compra
`buscarReposicao()` usa um piso fixo de 12 unidades (`PISO`) diferente do
`estoque_minimo` do produto, então um item com saldo acima do próprio
mínimo mas abaixo de 12 aparece como "OK" **e** sugerindo comprar. É
proposital (o piso evita ruptura de itens sem mínimo configurado), mas a
etiqueta confunde. Ajustar o texto/status pra refletir "abaixo do piso
de segurança", não "OK".

### 4b. Relatórios não batem quando há frete
Uma venda com frete de R$50 aparece como R$196,40 em "Vendas por
período", "Por cliente" e "Formas de pagamento" (que somam `pedidos.total`,
incluindo frete), mas como R$146,40 em "Vendas por produto" e Curva ABC
(que somam `pedido_itens.total`, sem frete). Reconciliado na varredura:
é inconsistência real. Definir a regra (frete não é faturamento de
mercadoria → relatórios de venda/faturamento devem excluir frete, ou
mostrá-lo em linha separada) e aplicar consistente nas 5 telas.

### 4c. Faturamento & ABC mostrando mês errado (fuso)
`v_faturamento_mensal` usa `date_trunc('month', data_pedido)` sem
converter pro fuso de Brasília; servidor em UTC joga vendas do fim do dia
pro mês seguinte na virada. Mesma classe do bug de fuso já corrigido em
`lib/formatos.ts`, mas essa View escapou. Corrigir a View pra truncar no
fuso `America/Sao_Paulo`.

### 4d. Rótulo de embalagem confuso no catálogo
Lista de Produtos mostra "Fardo 500ml" (mistura tipo de embalagem com
volume da unidade). Resolvido naturalmente pela Frente 2, que separa
"formas de venda" de "volume da bebida" — mas fica registrado aqui.

---

## Ordem de execução sugerida

Blocos independentes, executáveis em sequência (cada um testável e
commitável sozinho):

1. **Bugs de relatório** (4a, 4b, 4c) — pequenos, isolados, destravam
   confiança nos números. Bom aquecimento.
2. **Cargos + Entregador** (1a, 1b) — feature vertical fechada.
3. **Múltiplas embalagens + tela de vendas** (2, 3, 4d) — a maior,
   mexe em migration de dados + cadastro + PDV + recibo. Por último
   porque é a de maior superfície.

## Fora de escopo (registrado)

- Geolocalização/rota de entrega.
- Cargo dedicado que limita quem pode ser entregador.
- Reescrita visual completa do PDV (só adaptação + refino).
- Mexer em `registrarVenda`/`ajustar_estoque` (o backend continua em
  unidade base; só a UI e o `pedido_itens` mudam).
