# Reorganização da navegação + tela de Pedidos

## Contexto

A sidebar hoje mistura dois padrões: a maioria dos itens usa grupos que
expandem no lugar (`Cadastros`, `Relatórios`), mas `Financeiro` usa abas
internas no topo da própria página — decisão antiga, documentada no
código (`FinanceiroTabs.tsx`: "a sidebar global não pode ser alterada").
Isso criou uma inconsistência real: dentro de `Relatórios`, a aba
"Faturamento & ABC" na verdade navega pra uma URL de `/financeiro/...`
(`RelatoriosTabs.tsx`), uma troca de contexto que confunde ("clicava
dentro da tela aí ia pra outro lugar").

O usuário também sente falta de uma visão operacional de vendas
separada do extrato bruto — hoje `/movimentacoes` mistura entrada
(compra) e saída (venda) num histórico só, sem detalhe de quem entregou
ou quanto tempo levou.

## O que muda

### 1. Sidebar: 3 grupos que expandem no lugar

```
+ Nova Movimentação     (sem mudança)
Dashboard
Operação
  ├─ Pedidos            (novo)
  ├─ Movimentações      (sem mudança de conteúdo, só de posição)
  └─ Estoque
Cadastro                (renomeado de "Cadastros")
  ├─ Clientes / Fornecedores / Produtos / Equipe (sem mudança)
Relatórios
  VENDAS: Por período, Por produto, Por cliente, Faturamento & ABC
  FINANCEIRO: Resultado, A pagar, A receber, Custos Fixos, Formas de pagamento
Configurações           (sem mudança)
```

`Financeiro` deixa de ser item solto; suas 5 telas migram de
`/financeiro/*` pra dentro do grupo `Relatórios`, com um separador
visual (não colapsável, só um rótulo tipo cabeçalho) distinguindo
VENDAS de FINANCEIRO — 9 itens numa lista só ficaria pesado.
`FinanceiroTabs.tsx` deixa de ser necessário (a navegação passa a ser
só pela sidebar); `RelatoriosTabs.tsx` idem.

**Movimentações não muda em nada** — continua o extrato de entrada +
saída, valores de estoque, exatamente como é hoje. Só muda de lugar na
sidebar (entra dentro de Operação).

### 2. Tela nova: Pedidos

Foco operacional (quem entregou, quanto tempo), não financeiro (isso é
papel do extrato em Movimentações). Duas abas:

- **Em andamento**: `pedidos` com `tipo_fulfillment in ('entrega',
  'retirada')` e `concluido_em is null`, do local ativo. É o filtro
  `?tipo=pendentes` que hoje vive em `/movimentacoes` — muda de
  endereço pra `/pedidos` (ou similar), sem mudar a query.
- **Concluídos**: `pedidos` com `concluido_em is not null` (cobre
  balcão automaticamente — já sai com `concluido_em` preenchido na
  hora — e entrega/retirada depois de confirmada). Colunas: nº pedido,
  tipo, local, cliente, entregador, saiu às, confirmado às, duração.

Duração só aparece quando `saiu_entrega_em` E `concluido_em` estão
preenchidos; se faltar um dos dois, a coluna fica vazia (não trava
nada).

### 3. Campo novo: tempo de entrega

Migration adiciona `pedidos.saiu_entrega_em timestamptz null`.

Nova server action `marcarSaiuEntrega(pedidoId)` (mesmo padrão de
`marcarPagoPedido`/`marcarConcluidoPedido` já existentes em
`lib/actions/pedidos.ts`).

`FulfillmentAcoes.tsx` ganha um terceiro botão, "Marcar que saiu para
entrega" — só renderiza quando `tipo_fulfillment === 'entrega'`
(retirada não tem trajeto, o cliente busca) e só antes de
`concluido_em` estar preenchido. Segue o mesmo padrão dos outros dois
botões (toast, `router.refresh()`, sem verificação de quem está
confirmando — mesma filosofia já documentada no CLAUDE.md: "confirmar
entrega/retirada não é restrito a quem foi designado").

### 4. Catálogo de permissões

`lib/nav-catalogo.ts` (`NAV_CATALOGO`) ganha entradas pros itens novos
(`/pedidos`) e pros que mudaram de rota (as 5 telas do financeiro, que
saem de `/financeiro/*` — mantêm a URL, só mudam de onde são
alcançadas na sidebar). `rotaPermitida()` precisa continuar cobrindo
as sub-rotas de cada grupo do jeito que já cobre hoje.

## Fora de escopo (explicitamente)

- Geolocalização/mapa pro trajeto da entrega — só timestamp manual
  ("saiu"/"confirmou"), sem GPS.
- Restringir quem pode marcar "saiu para entrega" a um cargo
  específico — mesma política aberta que já existe pra confirmar
  entrega/retirada.
- Mudar o que já existe em Movimentações — só muda de posição na
  sidebar.

## Testes

Local e produção: navegar pelos 3 grupos, confirmar que cada sub-item
abre a tela certa sem pular de contexto; criar uma venda de entrega,
marcar "saiu para entrega", confirmar entrega, ver a duração calculada
certa na aba Concluídos; conferir que Movimentações continua
mostrando entrada+saída sem nenhuma mudança de comportamento.
