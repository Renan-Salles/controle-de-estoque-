# Mega pacote de features — Design

**Data:** 2026-07-03
**Contexto:** O Renan aprovou o pacote completo de melhorias proposto após
a varredura do sistema, cortando o que depende de coisa física/externa
(scanner) e as integrações pesadas (NFC-e, bot de WhatsApp). Decisões
tomadas com ele: validade simples (data + alerta, sem lote/FIFO),
fechamento de caixa às cegas, Pix com QR local (chave própria, sem PSP).

16 features em 6 blocos. Cada bloco é executável, testável e deployável
sozinho. Convenções do projeto valem (CLAUDE.md): estoque em unidade
base, timezone Brasília, RLS por local, sem suite de testes (tsc +
eslint + build + Playwright manual).

---

## Bloco 1 — Financeiro

### F1. Fechamento de caixa (às cegas)
Tabela `caixa_fechamentos`: id, local_id, data (date), dinheiro_contado
numeric, esperado_dinheiro/esperado_pix/esperado_debito/esperado_credito
numeric (snapshot do dia no momento do fechamento), diferenca numeric
(contado − esperado_dinheiro), observacoes text, fechado_por uuid,
created_at. Unique (local_id, data).

Tela nova `/caixa` (grupo Operação na sidebar + nav-catalogo): fluxo às
cegas — digita o dinheiro contado na gaveta SEM ver o esperado; ao
confirmar, o sistema mostra o comparativo (esperado por forma, contado,
diferença em verde/vermelho) e grava. Pix/cartões não têm contagem
física: aparecem só no comparativo final. Esperado = soma das vendas
concluídas do dia (fuso Brasília) por forma de pagamento, apenas as
PAGAS (pago=true). Histórico dos últimos fechamentos na mesma tela.
Refazer o fechamento do dia sobrescreve (upsert) com aviso.

### F2. Metas de venda
Tabela `metas_venda`: local_id, mes (text YYYY-MM), valor numeric,
unique (local_id, mes). Admin define a meta do mês numa seção nova em
`/configuracoes` ("Meta de vendas"). Dashboard ganha card "Meta do mês"
com barra de progresso (receita do mês ÷ meta) — some se não houver
meta cadastrada.

### F3. Comparativo entre locais (admin)
Página `/relatorios/locais` (sidebar Relatórios/VENDAS + catálogo, admin
enxerga): mês corrente lado a lado por local — receita (sem frete),
vendas, ticket médio, lucro bruto (receita − CMV via dados existentes).
Query ignora o local ativo de propósito (admin only; usa service client
server-side com checagem de admin antes).

### F4. DRE mês a mês
Na tela `/financeiro/resultado`, abaixo do DRE do mês: tabela dos
últimos 6 meses (receita, CMV, margem, custos fixos, perdas, lucro) via
action `getDreSerie(6)` — reusa a lógica do getDre por mês em SQL
agregada única, não 6 chamadas.

## Bloco 2 — Clientes / Fiado

### F9. Cobrança de fiado por WhatsApp
Em `/financeiro/a-receber`, cada linha aberta com cliente que tem
telefone ganha botão WhatsApp: abre `wa.me/55{tel}` com mensagem pronta
("Oi {nome}! Passando pra lembrar do fiado de R$ {valor} que vence em
{data}. Qualquer coisa me chama!"). Encoding via URLSearchParams.

### F10. Limite de crédito trava fiado
Em `registrarVenda` com forma fiado: se o cliente tem `limite_credito >
0`, soma os fiados em aberto (contas_receber status=aberto) + a venda
nova; se estourar o limite, recusa com mensagem clara ("Fiado recusado:
{nome} já deve R$ X e o limite é R$ Y"). Server-side (fonte da verdade).

### F11. Extrato do cliente
Na página `/clientes/[id]`: seção "Extrato" com as últimas compras
(data, nº, total, forma, status), fiados em aberto com vencimento, e
totais (comprado no ano, em aberto). Botão "Imprimir extrato" (window
.print + CSS de impressão escondendo o shell). Ver o que
clientes-stats.ts já fornece antes de criar action nova.

## Bloco 3 — PDV

### F5. Troco calculado
Venda em dinheiro: campo "Recebido (R$)" na comanda; mostra o troco na
hora (recebido − total, vermelho se insuficiente — não bloqueia).
Persiste em `pedidos.valor_recebido numeric null` (migration) pro cupom
reimprimível mostrar Recebido/Troco.

### F6. Desconto na venda
Campo "Desconto (R$)" na comanda (entre subtotal e total). total =
subtotal + frete − desconto. Grava em `pedidos.desconto_total` (coluna
já existe, zero hoje). Validação: 0 ≤ desconto ≤ subtotal. Cupom mostra
a linha de desconto.

### F7. Comanda em espera
Botão "Segurar comanda" no PDV: salva a comanda atual (itens, cliente,
tipo, obs) em localStorage e limpa a tela. Botão "Em espera (N)" lista
as comandas seguradas (cliente/hora/total) pra retomar ou descartar.
Por dispositivo, sem banco — v1 YAGNI (balcão tem 1-2 máquinas).

### F8. QR Code Pix
Campo `chave_pix` na configuração do depósito (tabela de config que a
tela Dados do Depósito já usa). Venda em pix: na tela de sucesso, botão
"QR Code Pix" mostra o QR + copia-e-cola do BR Code EMV (payload gerado
por função própria com CRC16 — padrão BACEN pra pix estático com
valor). Dependência nova: pacote `qrcode` (gera o PNG client-side).
Sem chave cadastrada, o botão não aparece.

## Bloco 4 — Estoque

### F12. Inventário / contagem
Aba "Contagem" no EstoqueTabs: lista os produtos com input "contado"
(vazio = não conferido). Ao concluir: para cada divergência,
`ajustar_estoque(p_novo_saldo)` + movimentação tipo 'ajuste_inventario'
+ grava cabeçalho em `inventarios` (local, quem, quando, nº itens
conferidos/divergentes) e linhas em `inventario_itens` (produto,
esperado, contado). Histórico de inventários na mesma aba.

### F15. Sugestão de compra por giro
`buscarReposicao()` passa a calcular giro semanal (vendas dos últimos
28 dias ÷ 4, via pedido_itens). Sugestão = cobrir 2 semanas de giro
menos o saldo (mínimo 0). Sem venda no período, mantém o critério atual
(piso). Coluna nova "Vende/semana" na tela de reposição.

### F14. Validade (simples)
Coluna `validade date null` em movimentacoes_estoque — preenchida
opcionalmente por item na ENTRADA (campo novo no FormEntrada). Seção
"Vencendo" na tela de Estoque: entradas com validade ≤ 30 dias e
produto ainda com saldo, ordenado pelo mais urgente. Contador no
dashboard junto do estoque crítico.

### F13. Transferência entre locais (admin)
Botão "Transferir" na tela de Estoque (admin only): escolhe produto,
quantidade e local destino. Origem: ajustar_estoque(−qtd) + mov
'transferencia_saida'. Destino: procura produto de MESMO NOME no
destino; se não existir, clona o cadastro (com embalagens, código novo
gerado); ajustar_estoque(+qtd com custo médio da origem) + mov
'transferencia_entrada'. Registra em `transferencias` (produtos,
locais, qtd, quem, quando). Tela de histórico simples na mesma seção.

## Bloco 5 — Entregas

### F16. Taxa de entrega por bairro
Tabela `taxas_entrega` (local_id, bairro, valor, unique local+bairro).
CRUD em Configurações ("Taxas de entrega"). Na venda tipo entrega: ao
selecionar cliente cujo endereço.bairro casa (case-insensitive) com uma
taxa, o frete é preenchido automaticamente (continua editável).

### F17. Relatório de entregadores
Página `/relatorios/entregadores` (sidebar Relatórios/VENDAS +
catálogo): por entregador no período escolhido — nº de entregas
concluídas, tempo médio (avg(concluido_em − saiu_entrega_em) das que
têm ambos), frete somado. Reusa FiltroPeriodo.

### F18. Avisar entregador no WhatsApp
Coluna `telefone` em profiles + campo editável na tela Equipe. No
detalhe do pedido tipo entrega (e na tela de sucesso da venda), botão
"Avisar {entregador}" abre wa.me com resumo pronto (nº, cliente,
endereço, total, cobrar ou não). Só aparece se o entregador tem
telefone cadastrado.

## Bloco 6 — PWA + fechamento

### F19. PWA
Manifest já existe. Completar: ícones maskable, theme_color/background
coerentes com o tema, display standalone confirmado, start_url
/dashboard. Sem service worker/offline (fora de escopo). Testar
"Adicionar à tela inicial".

Verificação final: tsc, eslint, build, roteiro manual dos 6 blocos,
push, teste em produção.

## Fora de escopo (confirmado com o Renan)
Scanner/hardware, NFC-e, bot de pedidos WhatsApp, confirmação
automática de Pix (PSP), lote/FIFO de validade, sangria/reforço de
caixa (v2 do fechamento), geolocalização.
