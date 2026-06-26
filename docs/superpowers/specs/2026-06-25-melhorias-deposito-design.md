# Melhorias R$ DEPÓSITO — Design

**Data:** 2026-06-25
**Escopo:** Navegação (sidebar accordion), Relatórios PDF, ajustes de banco, mobile (cards + PWA)

## Contexto

Sistema de depósito de bebidas (Next.js 16 App Router + Supabase). Já em uso.
Decisões do usuário que guiam este design:

- Sidebar deve ter seções que abrem/fecham (modelo NTB Estoque), a atual com tudo
  aberto confunde.
- Relatórios PDF prioritários: vendas por período, por produto, por cliente.
- "Histórico de vendas" — a tabela `pedidos` já é esse histórico.
- Usa muito no celular → mobile é prioridade real.

### O que já existe (não refazer)

- `/financeiro/relatorios`: faturamento mensal (`v_faturamento_mensal`) + Curva ABC
  (`v_curva_abc`, fixa em 90 dias).
- Grupo de rotas `(print)` com layout de impressão (usado pelo romaneio).
- `cancelarVenda()` já é **soft delete**: muda `status` para `cancelada`, devolve
  estoque, nunca apaga. Histórico preservado por construção.
- Navegação compartilhada entre desktop (`Sidebar`) e drawer mobile via
  `components/shell/nav-items.tsx` (`NavConteudo`).

## Decisões de design (4 correções sobre o rascunho inicial)

1. **Consolidar relatórios num só lugar.** Toda análise de vendas vai para
   `/relatorios`. A antiga `/financeiro/relatorios` é movida/redirecionada para lá
   (não manter venda em dois lugares).
2. **PDF gerado no servidor, vetorial** (`@react-pdf/renderer`), não rasterizando a
   tela nem `window.print()`. Paginação correta, texto nítido, baixa como arquivo via
   rota — funciona igual em PC e celular. Única dependência nova; open source, custo
   zero.
3. **Soft delete já existe** → nada a construir; os relatórios apenas filtram
   `status = 'concluida'` (ignoram canceladas).
4. **Não mexer na `v_curva_abc`** (a página de financeiro depende dela, é fixa em
   90 dias). Criar views novas parametrizáveis por data.

---

## 1. Sidebar com seções colapsáveis

**Arquivo principal:** `components/shell/nav-items.tsx` (consumido por `Sidebar.tsx`
desktop e pelo drawer mobile — uma só fonte).

Estrutura nova:

```
+ Nova Movimentação        (botão destacado, topo)
■ Dashboard                (item solto, topo)

▾ Vendas        → Pedidos · Clientes · Movimentações
▾ Estoque       → Posição · Reposição · Produtos · Fornecedores
▾ Financeiro    → Resultado · A receber · A pagar · Formas de pagamento
▾ Relatórios    → Vendas por período · Por produto · Por cliente

⚙ Configurações            (rodapé)
```

**Comportamento:**

- Cada grupo é um botão que expande/recolhe seus itens.
- Estado aberto/fechado persistido em `localStorage` (lembra entre visitas).
- A seção que contém a rota atual abre automaticamente no carregamento.
- Mesmo componente serve desktop e drawer mobile (paridade garantida).
- Ícone de chevron rotaciona; animação curta respeitando `MOTION_INTENSITY=4`.

**Interface do componente:**

- `Grupo = { titulo, icone, itens: Item[] }` (grupos agora têm ícone próprio).
- `<GrupoColapsavel grupo aberto onToggle pathname onNavegar />` — unidade isolada,
  testável: dado um grupo e estado, renderiza header clicável + lista.
- Hook `useSecoesAbertas(pathname)`: encapsula o estado + persistência. Retorna
  `{ aberta, alternar }`. Isola toda a lógica de localStorage do render.

## 2. Relatórios PDF

**Rota:** `/relatorios` (área nova) com 3 sub-relatórios. `/financeiro/relatorios`
redireciona para `/relatorios` (faturamento + Curva ABC viram abas/seções lá).

Cada relatório tem: filtro de período (data início/fim, default = mês corrente),
tabela na tela, botão **Baixar PDF**.

| Relatório | Conteúdo | Fonte de dados |
|---|---|---|
| Vendas por período | Total vendido, nº de pedidos, ticket médio, quebra por dia | `pedidos` filtrado por data, `status='concluida'` |
| Vendas por produto | Ranking unidades + R$ no período | view nova `v_vendas_produto_periodo` (ou RPC) |
| Vendas por cliente | Quanto cada cliente comprou no período | view nova `v_vendas_cliente` |

**Geração de PDF — no servidor, vetorial (`@react-pdf/renderer`):**

Decisão: o PDF é montado no servidor com texto real, não rasterizando a tela. Isso
elimina por construção os dois problemas de gerar PDF no navegador (corte de linha
entre páginas e baixa qualidade) e funciona idêntico no celular.

- **Route handler** `app/relatorios/[tipo]/pdf/route.ts` recebe `ini`, `fim`
  (e `cliente` quando aplicável), roda a mesma server action de dados do relatório e
  responde `application/pdf` com `Content-Disposition: attachment`.
- O botão "Baixar PDF" é um `<a href>` para essa rota → download normal, sem JS
  pesado no cliente, sem diálogo de impressão. No celular abre/baixa direto.
- **Paginação automática:** `@react-pdf/renderer` quebra páginas sozinho, nunca corta
  uma linha no meio, e repete o cabeçalho da tabela com `fixed` em cada página.
- Texto selecionável e nítido (vetorial). Fonte registrada com suporte a acentos
  (Geist ou Helvetica embutida — ambas cobrem latim com acento).
- Open source, roda no servidor Next, custo zero.

O cupom fiscal atual (80mm, já funcionando) **não muda** nesta rodada; só os
relatórios usam o caminho server-side. Migrar o cupom para cá depois é opcional.

**Layout do PDF:** componente `RelatorioDocumento` em `@react-pdf/renderer` (A4
retrato, cabeçalho com nome do local + CNPJ + período, tabela com cabeçalho fixo,
linha de totais, rodapé com data de emissão e numeração de página). A tela usa o
visual padrão do sistema (`Tabela`); o PDF é um documento próprio com o mesmo
conteúdo — não tenta espelhar pixel a pixel a tela, e sim apresentar os mesmos dados
de forma impressa limpa.

## 3. Banco de dados

- **Nenhuma tabela nova.** `pedidos` + `pedido_itens` já são o histórico.
- **Funções RPC novas** (não alteram views existentes). Decisão: RPC Postgres com
  parâmetros `local_id`, `data_ini`, `data_fim` é mais limpo que view + filtro do
  PostgREST para agregação por período:
  - `vendas_por_cliente(local_id, data_ini, data_fim)` — faturamento por cliente.
  - `vendas_por_produto(local_id, data_ini, data_fim)` — unidades e R$ por produto
    (a Curva ABC continua usando `v_curva_abc` de 90 dias, intocada).
  - Vendas por período: query direta em `pedidos` na server action (sem RPC, é
    agregação simples por dia).
- **Índices** (performance dos relatórios conforme cresce o volume):
  - `pedidos(local_id, data_pedido, status)`
  - `pedido_itens(pedido_id)`, `pedido_itens(produto_id)`
- Todas as consultas de relatório filtram `status = 'concluida'`.

## 4. Mobile (cards + PWA)

**Tabelas → cards no celular, dirigido por descritor de campos.** Sem componente
mágico que adivinha colunas e sem cada página reinventar markup. O padrão:

- Desktop (≥ lg): a `Tabela` atual, intocada (`hidden lg:block`).
- Celular: um único componente `<CardLinha titulo destaque campos[] acoes>` renderiza
  o card. Cada página **declara** um descritor — uma função que mapeia uma linha de
  dado para `{ titulo, destaque, campos: [{label, valor}], acoes }`.
- O componente é genérico de verdade (só recebe o descritor pronto); a página é dona
  de quais campos mostrar. Markup compartilhado, dados declarados — zero duplicação.
- Mesma fonte de dados da tabela (o array já carregado na página), sem fetch a mais.
- Aplicado em: Estoque, Produtos, Clientes, Pedidos, Movimentações, Relatórios.

**PWA (instalável):**

- `app/manifest.ts` (Next metadata) com nome, cores do tema (base teal `#07151a`),
  ícones (192/512) e display `standalone`.
- Ícones: quadrado teal com "R$" dourado, gerados direto de SVG → PNG (sem IA, sem
  dependência externa).
- Meta `apple-mobile-web-app-*` para iOS.
- Resultado: "Adicionar à tela inicial" abre o sistema em tela cheia, sem barra do
  navegador.

**Verificações de toque:** drawer de navegação, sheets de entrada/ajuste e botões de
ação revisados em viewport de celular (alvos ≥ 40px).

---

## Ordem de execução

1. **Fase 1 — Sidebar accordion.** Rápida, resolve a confusão visual imediatamente.
2. **Fase 2 — Relatórios + banco.** Views/RPC novas, índices, 3 relatórios com PDF,
   consolidação do `/financeiro/relatorios`.
3. **Fase 3 — Mobile.** `<ListaResponsiva>` nas páginas-chave + PWA.

Cada fase é entregável e verificável de forma independente.

## Fora de escopo (YAGNI)

- Tabela de auditoria geral (quem fez o quê no sistema).
- Histórico de preços / log de crédito de cliente (não pedidos nesta rodada).
- Posição de estoque em PDF (não priorizado; fácil de somar depois reusando
  `gerarPdf` + `v_posicao_estoque`).
