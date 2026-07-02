# Pedidos pendentes + CPF opcional

## Contexto

Varredura pedida pelo usuário levantou três pontos:

1. Campo CPF/CNPJ do cadastro de cliente já é opcional (schema e form não
   exigem), mas o rótulo não deixa isso claro — só outros campos opcionais
   do sistema seguem o padrão `Label (opcional)` (ex. "Cliente (opcional)"
   na tela de Nova Venda).
2. Confirmar entrega/retirada (`FulfillmentAcoes.tsx`) só dá um toast e
   pronto — não existe nenhum jeito de ver, de relance, quantos pedidos
   ainda estão aguardando entrega/retirada. O filtro "Aguardando
   entrega"/"Aguardando retirada" já existe, mas fica escondido dentro de
   `/movimentacoes`.
3. Usuário quer um botão de destaque próprio (não um selo discreto)
   levando direto pra essa lista, mais um resumo no Dashboard.

Fora de escopo (confirmado com o usuário): notificação push do navegador
e mensagem via WhatsApp — o sistema não tem integração externa nenhuma
hoje (`CLAUDE.md`: "Sem integração de email/SMS") e não é o momento de
introduzir isso.

## O que muda

### 1. CPF/CNPJ — só rótulo

`app/(app)/clientes/ClienteForm.tsx`: `Campo label="CPF / CNPJ"` vira
`Campo label="CPF / CNPJ (opcional)"`. Nenhuma mudança de validação (já
está certa).

### 2. Contagem de pedidos pendentes — fonte única

Nova função em `lib/actions/pedidos.ts`:

```ts
export async function contarPedidosPendentes(): Promise<number>
```

Conta `pedidos` do local ativo com `status = 'concluida'`,
`tipo_fulfillment in ('entrega', 'retirada')` e `concluido_em is null`.
Mesmo critério que já define os filtros "Aguardando entrega/retirada" em
`/movimentacoes` — só que somando os dois tipos numa contagem só.

### 3. Botão "Pedidos em andamento" na sidebar

Item novo em `components/shell/nav-items.tsx` (`ITEM_PEDIDOS_PENDENTES`),
entre Dashboard e Movimentações. Aponta pra
`/movimentacoes?filtro=pendentes` — reaproveita a página de
Movimentações existente; o filtro `pendentes` é novo ali (union dos dois
filtros que já existem: `tipoFulfillment em ('entrega','retirada') e
!concluidoEm`, sem duplicar lógica).

A contagem (`contarPedidosPendentes()`) é buscada no layout
(`app/(app)/layout.tsx`, que já roda no servidor a cada navegação) e
passada como prop até a Sidebar/MobileNav, que desenham um selo com o
número ao lado do label quando > 0 (nada aparece quando é 0 — não é pra
virar ruído visual permanente).

### 4. Card no Dashboard

Mesmo componente/estilo do banner "N produtos com estoque crítico ou
zerado" que já existe em `app/(app)/dashboard/page.tsx` — banner com o
número de pedidos pendentes e um link "Ver pedidos" pra
`/movimentacoes?filtro=pendentes`. Só aparece quando a contagem é > 0
(estado vazio = banner some, igual ao de estoque crítico).

## Testes

Local: cadastrar cliente sem CPF (deve salvar normal), criar uma venda
com entrega/retirada sem confirmar, ver o selo/card aparecerem com o
número certo, confirmar a entrega, ver o número cair. Produção: mesmo
roteiro depois do deploy.
