# Impressão do cupom fiscal para impressora térmica 80mm — Design

**Data:** 2026-07-16
**Contexto:** O Renan vai testar amanhã uma impressora térmica de cupom
USB 80mm (modelo VT-8360, sem Wi-Fi/Bluetooth) num PC Windows no ponto de
venda. Precisamos garantir que a impressão do cupom saia perfeita nela —
e aproveitar pra unificar os dois documentos de impressão que existem
hoje, que estavam divergentes.

## Estado atual (antes deste design)

Existem dois templates de impressão completamente diferentes:

1. **`CupomFiscal.tsx`** — usado só dentro de `FormSaida.tsx`, no fluxo
   de venda (`/movimentacoes/nova`). Já é formatado como cupom térmico
   (fonte monoespaçada, layout estreito) e já tem CSS dedicado pra 80mm
   (`@page { size: 80mm auto }`, classe `.cupom-print-area` isolando o
   conteúdo do resto da página no `@media print`).
2. **`RomaneioView.tsx`** — usado na rota `/pedidos/[id]/romaneio`
   (botão "Romaneio" na tela do pedido e na lista de Movimentações). É um
   documento A4 completamente diferente (tabela com bordas, tipografia
   Arial, CNPJ hardcoded), com CSS marcado `/* NÃO ALTERAR */` em
   `app/globals.css`.

Ou seja: a venda já imprime cupom térmico corretamente, mas reabrir o
mesmo pedido depois pela tela de Pedidos ("Romaneio") imprime um
documento A4 totalmente diferente — inconsistente e não serve pra essa
impressora térmica.

## Decisão

O Romaneio deixa de existir como documento A4. A partir de agora **todo**
pedido imprime como cupom fiscal térmico 80mm, seja na hora da venda ou
ao reabrir depois pelo botão "Romaneio". Um template só, uma fonte de
verdade só.

## Mudanças

### 1. `CupomData` ganha os campos que só existiam no Romaneio

`components/romaneio/CupomFiscal.tsx` — a interface `CupomData` ganha:

```ts
tipo_fulfillment?: string | null
entregador?: { nome: string } | null
```

O componente passa a renderizar, logo abaixo do bloco do cliente, uma
linha com `rotuloFulfillment(tipo_fulfillment)` e, quando houver,
"Entregador: {nome}" — mesma informação que o `RomaneioView` mostrava,
só que dentro do layout estreito do cupom térmico.

### 2. `/pedidos/[id]/romaneio` passa a renderizar `CupomFiscal`

`app/(print)/pedidos/[id]/romaneio/page.tsx` troca `<RomaneioView
pedido={p} />` por `<CupomFiscal data={...} />`, mapeando os campos que a
query do Supabase já busca (ela já traz `entregador` e o restante que o
`CupomData` precisa). Continua usando `<PrintActions>` (Imprimir /
Baixar PDF / Fechar), sem mudança de UX — o clique em "Imprimir" continua
abrindo o diálogo nativo do Windows (decisão explícita do Renan/Joaquim:
sem impressão silenciosa via `--kiosk-printing`, que exigiria configurar
a máquina do cliente).

A rota e o botão "Romaneio" continuam com o mesmo nome — só o que é
renderizado dentro muda.

`components/romaneio/RomaneioView.tsx` é apagado.

### 3. CSS de impressão: uma regra só, em mm reais

Hoje o bloco "esconder tudo, mostrar só `.cupom-print-area`, `@page
80mm`" está duplicado dentro de `FormSaida.tsx` (injetado via `<style>`
inline). Ele sai de lá e vira uma regra global em `app/globals.css`:

```css
@media print {
  body * { visibility: hidden !important; }
  .cupom-print-area,
  .cupom-print-area * { visibility: visible !important; }
  .cupom-print-area {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 80mm !important;
    background: white !important;
  }
}
@page { size: 80mm auto; margin: 0 !important; }
```

`FormSaida.tsx` e a página do romaneio passam a só aplicar a classe
`cupom-print-area` no wrapper, sem duplicar CSS.

O bloco A4 atual em `globals.css` (comentado `/* Impressão A4 - romaneio
(NAO alterar) */`) é removido — não sobra nenhuma rota que imprime em
A4.

Dentro do `CupomFiscal`, a largura do cupom troca de `maxWidth: '320px'`
(aproximação em pixels) para `width: 72mm` (área útil real de uma
bobina de 80mm, descontando a margem mecânica do cabeçote térmico — o
padrão de mercado pra impressoras 80mm é ~72mm de área imprimível). Isso
faz o conteúdo bater exatamente com o papel físico em vez de depender de
uma conversão px↔mm aproximada que varia com o DPI da tela.

## O que NÃO muda

- O fluxo de impressão da venda (`FormSaida.tsx`) já funciona hoje e
  mantém o mesmo botão/comportamento — só passa a puxar o CSS
  compartilhado em vez do bloco duplicado.
- Sem impressão silenciosa/kiosk mode — o diálogo do Windows é o
  comportamento desejado (confirmado).
- Nenhuma mudança em `PrintActions.tsx` (Imprimir / Baixar PDF / Fechar
  já fazem o que precisa).

## Fora do controle deste código (ponto de validação com o cliente)

A impressora VT-8360 precisa estar instalada como impressora do Windows
(driver do fabricante ou driver USB genérico) e o Windows precisa
reconhecer/oferecer o tamanho de papel "80mm" (ou equivalente) no
diálogo de impressão. Se o driver não expuser esse tamanho de papel, é
um ajuste de configuração do Windows/driver, não algo corrigível só no
código do app. Isso fica para o teste do Renan amanhã — se o cupom sair
cortado ou em tamanho errado mesmo com o CSS correto, o próximo passo é
verificar o tamanho de papel configurado na fila de impressão do
Windows, não mexer no app de novo.

## Verificação

- `npx tsc --noEmit`
- `npx eslint . --quiet`
- `npx next build`
- Sem suite de testes automatizada (conforme `CLAUDE.md`) — teste manual
  no browser aqui, teste real na impressora fica para amanhã no cliente.
