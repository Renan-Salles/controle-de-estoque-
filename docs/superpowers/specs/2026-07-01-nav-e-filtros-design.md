# Reorganização de navegação + filtros em Produtos

## Contexto

O pedido original do usuário envolvia 4 sub-projetos independentes:
1. Reorganização de navegação (este spec)
2. Filtros na tabela de Produtos (este spec)
3. Equipe + login por convite com permissões
4. Entrega/retirada de pedidos (depende do #3)

Este spec cobre **apenas os sub-projetos 1 e 2** — os itens rápidos e mecânicos,
aprovados para implementação imediata. Os sub-projetos 3 e 4 são maiores,
genuinamente ambíguos, e terão seus próprios ciclos de brainstorm → spec →
plano → implementação em sessões futuras.

## Problema

- **Estoque** tinha 4 itens no menu (Posição, Reposição, Produtos, Fornecedores)
  misturando duas responsabilidades diferentes: gestão de saldo/estoque
  (Posição, Reposição) e cadastro de dado mestre (Produtos, Fornecedores).
- **Vendas** só tinha 2 itens (Movimentações, Clientes) — Clientes não tem
  relação direta com "vendas" como conceito de navegação, é cadastro.
- **Financeiro ↔ Relatórios**: a aba "Faturamento & ABC" existe duplicada em
  `FinanceiroTabs` (aponta pra `/financeiro/relatorios`) E em `RelatoriosTabs`
  (também aponta pra `/financeiro/relatorios`). Só que `/financeiro/relatorios`
  renderiza `FinanceiroTabs`, não `RelatoriosTabs` — então quem chega vindo de
  Relatórios perde a barra de abas de Relatórios e fica preso na barra do
  Financeiro, sem caminho de volta óbvio. Essa inconsistência é a causa raiz
  da confusão relatada ("clico em faturamento vai pra relatórios, no relatório
  clico e volta pro financeiro").
- **Produtos** não tem nenhum filtro além de busca por texto livre — com o
  catálogo crescendo (embalagens variadas, categorias diferentes), fica difícil
  achar rápido "só os produtos críticos da categoria X", por exemplo.

## Sub-projeto 1: Reorganização de navegação

### Estrutura final do menu

```
Dashboard                         (item, inalterado)
+ Nova Movimentação                (botão destacado, inalterado)
Movimentações                     (item direto — era "Vendas" com 2 sub-itens,
                                    agora só tem Movimentações e vira link direto)
Cadastros                         (grupo NOVO)
  ├─ Clientes                      (movido de Vendas)
  ├─ Fornecedores                  (movido de Estoque)
  └─ Produtos                      (movido de Estoque)
Estoque                           (item direto — era grupo, agora só tem a
                                    posição/reposição mesclada, vira link direto
                                    pra /estoque, igual o Financeiro já é hoje)
Financeiro                        (item, inalterado — só perde a aba interna
                                    "Faturamento & ABC")
Relatórios                        (grupo, inalterado — "Faturamento & ABC"
                                    passa a existir só aqui)
```

Cargos com `itens_visiveis` restrito continuam funcionando: os hrefs
`/clientes`, `/fornecedores`, `/produtos` já existem no `NAV_CATALOGO`, só
mudam de agrupamento visual — nenhuma migração de permissões necessária.

### Estoque: Posição + Reposição em abas

`/estoque` e `/estoque/reposicao` continuam sendo páginas/rotas separadas
(cada uma mantém sua própria busca de dados client-side, sem risco de mexer
na lógica interna). Adiciona-se um componente `EstoqueTabs` (mesmo padrão de
`FinanceiroTabs`/`RelatoriosTabs`: barra de links) renderizado no topo de
ambas as páginas, com 2 abas: "Posição" e "Reposição". O botão "Perdas" que já
existe no header de `/estoque` continua como atalho secundário, sem virar
aba (não foi pedido).

### Financeiro/Relatórios: remover duplicação

Remove a entrada "Faturamento & ABC" de `FinanceiroTabs` (fica só as 5 abas:
Resultado, A pagar, A receber, Custos Fixos, Formas de pagamento).
`RelatoriosTabs` mantém as 4 abas como estão hoje, incluindo "Faturamento &
ABC" apontando pra `/financeiro/relatorios` (a página em si não muda de
lugar/URL, só o ponto de entrada pela aba do Financeiro é removido).

### Detalhe técnico: catálogo de permissões

`lib/nav-catalogo.ts` tem um agrupamento próprio (`grupo` em `NAV_CATALOGO`)
usado só pelos checkboxes da tela de Cargos — é separado do agrupamento visual
da sidebar (`NAV` em `nav-items.tsx`) e não precisa mudar pra nada funcionar,
mas fica com os grupos desatualizados (mostraria "Estoque" com
Produtos/Fornecedores/Posição/Reposição juntos) se não acompanhar. Atualiza
os `grupo` de `/clientes`, `/fornecedores`, `/produtos` pra `'Cadastros'` e
mantém `/estoque` + `/estoque/reposicao` em `'Estoque'`. A checagem de rota
permitida (`rotaPermitida`) já trata `/financeiro/relatorios` como parte de
`/relatorios` (linha 48) — confirma que a decisão de mover "Faturamento &
ABC" pra Relatórios já era a intenção original, não precisa mexer nessa
função.

### Fora de escopo

- Não vamos mover a página `/financeiro/relatorios` de URL — só ajustar de
  qual barra de abas ela é alcançável.
- Não vamos criar a página "Equipe" ainda (isso é sub-projeto 3) — o grupo
  Cadastros nasce com 3 itens e ganha o 4º depois.

## Sub-projeto 2: Filtros em Produtos

A página `/produtos` ganha dois filtros (segmented control, mesmo componente
`Tabs`/`TabsList`/`TabsTrigger` já usado em `/estoque`), combinados com a
busca por texto que já existe:

- **Categoria**: Todas + uma opção por categoria cadastrada (dinâmico, vem do
  banco).
- **Status de estoque**: Todos / OK / Alerta / Crítico / Ruptura (mesmo
  vocabulário de `status_estoque` já usado em `StatusPill`).

Os filtros são combináveis (ex: categoria=Cerveja + status=Crítico) e operam
sobre a mesma lista já carregada (`buscarPosicaoProdutos()`), filtrando
client-side — sem nova query ao banco, já que a lista completa do local ativo
já é buscada hoje.

## Testes

- Navegar por todos os itens do menu novo e confirmar que cada rota carrega.
- Confirmar que um cargo com `itens_visiveis` restrito (ex: só Movimentações)
  continua escondendo os outros itens corretamente após a reorganização.
- `/estoque` e `/estoque/reposicao` mostram a mesma barra de abas, cada uma
  marcando a aba certa como ativa.
- `/financeiro/resultado` não mostra mais "Faturamento & ABC"; `/relatorios`
  mostra normalmente.
- Filtro de categoria + status combinados na tela de Produtos retornam a
  interseção correta.
