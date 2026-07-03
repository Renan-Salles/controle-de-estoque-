# Mega pacote de features — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Entregar as 16 features aprovadas (spec `2026-07-03-mega-features-design.md`) em 6 blocos independentes, cada um testado e deployado sozinho.

**Architecture:** Cada feature segue o padrão do projeto: migration SQL (aplicada via pooler `aws-1-us-east-2` se o IPv6 direto estiver fora) → server action com escopo por local → tela/ajuste de UI reusando ui-kit → teste Playwright com dados reais criados e removidos → commit. Nav novo entra em `nav-items.tsx` (visual) E `nav-catalogo.ts` (permissões).

**Tech Stack:** Next.js 16 App Router, Supabase, TypeScript, Tailwind 4, `@base-ui/react`, `qrcode` (dependência nova, F8). Verificação: `npx tsc --noEmit`, `npx eslint . --quiet`, `npx next build`, Playwright (login `renan@deposito.com`/`Deposito2026!`, seletores `#email`/`#senha`/`text=Entrar`).

**Regras herdadas:** português com acentos; sem travessão em copy de usuário; commits pequenos + push por bloco; estoque sempre em unidade base; datas no fuso `America/Sao_Paulo` (`hojeBrasil()`/`mesAtualBrasil()`); RLS por local via `pode_acessar_local()`; escrita privilegiada = função `security definer`, não `createServiceClient()`.

---

## BLOCO 1 — Financeiro

### Task 1.1: Fechamento de caixa às cegas (F1)
**Files:** Create `supabase/migrations/2026-07-03-caixa-fechamentos.sql`, `lib/actions/caixa.ts`, `app/(app)/caixa/page.tsx`, `components/caixa/FormFechamento.tsx`. Modify `components/shell/nav-items.tsx` (item Caixa no grupo Operação, ícone `Vault` ou `Landmark`), `lib/nav-catalogo.ts` (`{href:'/caixa', label:'Caixa', grupo:'Operação'}`) e migration de backfill dos cargos que têm `/movimentacoes` (Funcionario ganha `/caixa`).
1. Migration: tabela `caixa_fechamentos` (design F1), RLS por local, unique (local_id, data).
2. Actions: `resumoDoDia()` → soma vendas concluídas E pagas do dia (fuso) por forma de pagamento, do local ativo, MENOS frete? NÃO — caixa é dinheiro que entrou de verdade: soma `total` (com frete). `fecharCaixa(dinheiroContado, observacoes)` → upsert com snapshot dos esperados + diferença; `listarFechamentos(30)`.
3. Tela: passo 1 só o input do dinheiro contado (às cegas, sem mostrar esperado) + obs; ao confirmar, mostra o comparativo (esperado x contado por forma, diferença colorida) já gravado. Histórico embaixo (data, contado, esperado, diferença, quem). Refechar o mesmo dia = aviso "substitui o fechamento de hoje".
4. tsc/eslint → teste Playwright (criar 2-3 vendas pagas de formas diferentes no dia via SQL, fechar caixa com valor divergente, conferir comparativo e histórico; limpar) → commit `feat: fechamento de caixa as cegas`.

### Task 1.2: Metas de venda (F2)
**Files:** Create `supabase/migrations/2026-07-03-metas-venda.sql`, `lib/actions/metas.ts`, `components/configuracoes/MetaVendas.tsx`. Modify `app/(app)/configuracoes/page.tsx` (card novo), `app/(app)/dashboard/page.tsx` (card meta com barra).
1. Migration: `metas_venda` (local_id, mes text, valor, unique) + RLS local.
2. Actions: `getMeta(mes)`, `salvarMeta(mes, valor)` (admin only — checar cargo).
3. Configurações: seção com mês corrente + valor. Dashboard: card com barra `min(100, receita/meta*100)%`, texto "R$ X de R$ Y (Z%)"; some sem meta.
4. Teste (definir meta, conferir barra no dashboard) → commit `feat: metas de venda mensais`.

### Task 1.3: DRE mês a mês (F4)
**Files:** Modify `lib/actions/dre.ts` (nova `getDreSerie(n)` — uma query agregada por mês no fuso, reusando as mesmas fontes do getDre), `app/(app)/financeiro/resultado/page.tsx` (tabela 6 meses abaixo do DRE).
1. Action SQL única agrupando por mês (receita, cmv, custos fixos, perdas, lucro). 2. Tabela com mês formatado + valores, lucro colorido. 3. Teste visual → commit `feat: DRE comparativo 6 meses`.

### Task 1.4: Comparativo entre locais (F3)
**Files:** Create `lib/actions/comparativo.ts`, `app/(app)/relatorios/locais/page.tsx`. Modify `nav-items.tsx` (Relatórios/VENDAS: "Entre locais"), `nav-catalogo.ts`.
1. Action admin-only (checa `getCargoUsuario().admin`; service client): mês corrente por local — receita s/ frete, vendas, ticket, CMV→lucro bruto.
2. Página: cards lado a lado + tabela. Não-admin: `rotaPermitida` barra via catálogo (item não incluído nos cargos não-admin).
3. Teste → commit `feat: comparativo entre locais`.

### Task 1.5: Deploy Bloco 1
`npx next build` → push → poll produção → smoke test /caixa + dashboard meta.

## BLOCO 2 — Clientes / Fiado

### Task 2.1: WhatsApp de cobrança (F9)
**Files:** Modify `app/(app)/financeiro/a-receber/page.tsx`.
Botão por linha aberta (telefone existente): `wa.me/55{digits}?text=...` com nome, valor (formatarReal), vencimento (formatarData). `target=_blank`. Commit `feat: cobranca de fiado por whatsapp`.

### Task 2.2: Limite de crédito (F10)
**Files:** Modify `lib/actions/pedidos.ts` (registrarVenda).
Fiado + cliente com limite>0: somar contas_receber abertas (valor − valor_pago), recusar se soma+total > limite com mensagem clara. Teste SQL/Playwright (cliente com limite baixo + fiado aberto → venda recusada; sem limite → passa). Commit `feat: limite de credito trava fiado`.

### Task 2.3: Extrato do cliente (F11)
**Files:** Modify `app/(app)/clientes/[id]/page.tsx` (+ examinar `lib/actions/clientes-stats.ts` primeiro). Create `components/cliente/ExtratoCliente.tsx` se a página estiver grande.
Últimas 30 compras, fiados abertos, totais; botão Imprimir (CSS `@media print` escondendo shell — ver padrão do cupom). Commit `feat: extrato do cliente com impressao`.

### Task 2.4: Deploy Bloco 2
Build → push → smoke em produção.

## BLOCO 3 — PDV

### Task 3.1: Troco (F5)
**Files:** Create `supabase/migrations/2026-07-03-pedidos-valor-recebido.sql` (`valor_recebido numeric null`). Modify `FormSaida.tsx` (campo Recebido quando dinheiro; troco calculado ao lado; envia no payload), `lib/actions/pedidos.ts` (schema + insert), `CupomFiscal.tsx` + `buscarPedidoParaCupom` (linhas Recebido/Troco quando valor_recebido).
Commit `feat: troco calculado na venda em dinheiro`.

### Task 3.2: Desconto (F6)
**Files:** Modify `FormSaida.tsx` (campo Desconto entre subtotal e total), `lib/actions/pedidos.ts` (VendaSchema `desconto` 0..subtotal; `desconto_total` no insert; `total = subtotal + frete - desconto`; fiado usa total), `CupomFiscal.tsx` (linha desconto).
Atenção F10: limite usa total já com desconto. Teste: venda com desconto → total certo no banco/cupom → commit `feat: desconto na venda`.

### Task 3.3: Comanda em espera (F7)
**Files:** Modify `FormSaida.tsx`.
Estado serializável (itens, cliente, tipo, entregador, frete, obs, pagamento). "Segurar comanda" → push em localStorage (`depsys.comandas_espera`, máx 10) + limpa. Botão "Em espera (N)" abre Sheet com lista (hora, cliente, nº itens, total) → Retomar (repõe estado e remove) / Descartar. Commit `feat: comanda em espera no PDV`.

### Task 3.4: QR Pix (F8)
**Files:** Create `lib/pix.ts` (payload EMV + CRC16, função pura testável via node -e), migration `2026-07-03-config-chave-pix.sql` (coluna na tabela de config do depósito — conferir nome real da tabela antes), `components/pedido/QrPix.tsx`. Modify tela Dados do Depósito (campo chave Pix), `FormSaida.tsx` tela de sucesso (botão QR quando forma=pix e chave cadastrada). `npm i qrcode @types/qrcode`.
Payload: Merchant Account Info GUI br.gov.bcb.pix + chave; valor; nome/cidade truncados (25/15, sem acento); txid `***`. Validar CRC com gerador de referência (testar payload conhecido). Commit `feat: QR Code Pix na venda`.

### Task 3.5: Deploy Bloco 3
Build → push → smoke.

## BLOCO 4 — Estoque

### Task 4.1: Inventário (F12)
**Files:** Create migration `2026-07-03-inventarios.sql` (`inventarios` + `inventario_itens`, RLS local), `lib/actions/inventario.ts` (`concluirInventario(itens[{produto_id, contado}])` — para cada divergente: `ajustar_estoque(p_novo_saldo)` + mov `ajuste_inventario`; grava cabeçalho+itens), `app/(app)/estoque/contagem/page.tsx` + client component. Modify `EstoqueTabs.tsx` (aba Contagem), `nav-catalogo.ts` (`/estoque/contagem`, grupo Operação) + backfill cargos com `/estoque`.
Tela: tabela produto/saldo esperado OCULTO? Não — contagem de estoque não precisa ser às cegas (decisão: mostrar esperado, foco em agilidade; quem conta é o dono/funcionário de confiança). Inputs por produto, vazio = pula; resumo antes de concluir (N conferidos, M divergentes); histórico embaixo. Commit `feat: inventario de estoque com ajuste em massa`.

### Task 4.2: Sugestão por giro (F15)
**Files:** Modify `lib/actions/estoque.ts` (buscarReposicao: query extra em pedido_itens últimos 28d agrupada por produto → giro semanal; sugestão = max(ceil(giro*2 − saldo), 0), fallback critério atual quando giro=0), `app/(app)/estoque/reposicao/page.tsx` (coluna Vende/semana), `types/index.ts`.
Commit `feat: sugestao de compra por giro real`.

### Task 4.3: Validade (F14)
**Files:** Create migration `2026-07-03-validade-entradas.sql` (`movimentacoes_estoque.validade date null`). Modify `FormEntrada.tsx` (+ types + action da entrada — conferir onde grava as movimentações de entrada) com campo Validade opcional por item; `lib/actions/estoque.ts` (`listarVencendo()`: entradas com validade ≤ hoje+30 e produto com saldo>0); `app/(app)/estoque/page.tsx` (seção/aviso Vencendo); `app/(app)/dashboard/page.tsx` (contador junto do card de estoque crítico).
Commit `feat: validade nas entradas com alerta de vencimento`.

### Task 4.4: Transferência entre locais (F13)
**Files:** Create migration `2026-07-03-transferencias.sql` (tabela + RLS), `lib/actions/transferencias.ts` (admin only; origem: ajustar_estoque(−qtd)+mov; destino: acha produto por nome (ilike exato) ou clona cadastro+embalagens com código novo; ajustar_estoque(+qtd, custo médio origem)+mov; registra transferência — sequência com validações, sem transação distribuída: validar saldo antes, ordem destino-depois-origem? NÃO: origem primeiro (se falhar destino, devolve origem e reporta)), `components/estoque/TransferirDialog.tsx`. Modify tela Estoque (botão por linha, admin) + histórico.
Teste: transferir produto existente nos 2 locais e um que só existe na origem (clona) → saldos conferidos nos 2 lados → commit `feat: transferencia de estoque entre locais`.

### Task 4.5: Deploy Bloco 4
Build → push → smoke.

## BLOCO 5 — Entregas

### Task 5.1: Taxa por bairro (F16)
**Files:** Create migration `2026-07-03-taxas-entrega.sql` (local_id, bairro, valor, unique(local_id, lower(bairro))), `lib/actions/taxas.ts` (CRUD admin), `components/configuracoes/TaxasEntrega.tsx`. Modify `configuracoes/page.tsx`, `FormSaida.tsx` (ao selecionar cliente em tipo entrega: casar `endereco.bairro` com taxa → preencher frete, editável; action `taxaPorBairro(bairro)`).
Commit `feat: taxa de entrega por bairro`.

### Task 5.2: Relatório de entregadores (F17)
**Files:** Create `lib/actions/relatorio-entregadores.ts`, `app/(app)/relatorios/entregadores/page.tsx`. Modify `nav-items.tsx` (Relatórios/VENDAS "Entregadores"), `nav-catalogo.ts`.
Por entregador no período: entregas concluídas, tempo médio (avg em minutos das com saiu+concluido), frete total. Reusa FiltroPeriodo. Commit `feat: relatorio de entregadores`.

### Task 5.3: Avisar entregador (F18)
**Files:** Create migration `2026-07-03-profiles-telefone.sql`. Modify tela Equipe (campo telefone editável + action), `app/(app)/pedidos/[id]/page.tsx` e tela de sucesso do FormSaida (botão wa.me com resumo da entrega quando entregador tem telefone).
Commit `feat: avisar entregador por whatsapp`.

### Task 5.4: Deploy Bloco 5
Build → push → smoke.

## BLOCO 6 — PWA + fechamento

### Task 6.1: PWA (F19)
Revisar `app/manifest.ts`: name/short_name, display standalone, start_url /dashboard, theme/background do tema claro, ícones 192/512 + maskable (gerar do icon.png se preciso). Testar instalação. Commit `polish: manifest PWA completo`.

### Task 6.2: Verificação final
tsc + eslint + build. Roteiro manual dos 6 blocos em produção após push. Atualizar CLAUDE.md do projeto (seção "Modelo de negócio" ganha: caixa, metas, inventário, transferências, taxas, validade, extrato, limite, QR pix, comanda em espera — telegráfico). Commit `docs: CLAUDE.md atualizado com o mega pacote`.

---

## Ordem e dependências
Blocos independentes entre si; dentro do bloco, ordem listada. F6 (desconto) antes de re-testar F10 (limite usa total com desconto). F18 depende de coluna telefone antes da UI.
