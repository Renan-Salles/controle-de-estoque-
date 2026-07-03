# DepSys — contexto do projeto

Sistema de gestão (estoque + vendas + financeiro) para o cliente **Renan**,
dono de dois pontos de venda de bebidas: **R$ Depósito** (slug `deposito`,
local padrão) e **Império Salles** (slug `piscina`). Uso diário no balcão
e por telefone — prioridade é velocidade e clareza, não é landing page.

Login de teste (admin, acesso aos dois locais): `renan@deposito.com` / `Deposito2026!`

## Stack

- Next.js 16 App Router, React 19, TypeScript, Tailwind 4
- `@base-ui/react` (Select/Tabs/Dialog/Sheet/Command) — **não é shadcn radix**,
  `Trigger`/`Button` não suportam `asChild`. `Select.Value` (`SelectValue`)
  NÃO resolve o label sozinho: se não passar `children` como render-prop
  (`<SelectValue>{(v) => label}</SelectValue>`), mostra o valor cru (ex.: um
  UUID). Já aconteceu esse bug real em produção — sempre conferir.
- Supabase Postgres (projeto `jqdezlvqumzdkvvcbjtl`), `recharts`, `sonner`,
  fonte Geist (`geist/font/sans` e `geist/font/mono`)
- Deploy: Vercel. `next.config.ts` tem `ignoreBuildErrors: true` por causa de
  erros sistêmicos de inferência `never` do client do Supabase (runtime
  funciona certo mesmo assim — não é bug real, é limitação de tipos gerados)
- Sem suite de testes automatizada. Verificação sempre por:
  `npx tsc --noEmit`, `npx eslint . --quiet`, `npx next build`, e teste
  manual no browser (ou SQL direto via `node -e` com `pg.Pool`)

## Design

- Modo **claro (padrão) + escuro** via `ThemeToggle` (classe `.dark` +
  localStorage `tema`, script anti-flash no `layout.tsx`)
- Inspirado no design system do NTB Estoque (outro projeto, estilo
  Linear/Vercel): marca ciano (`--brand`), dourado (`--accent-gold`) **só**
  no dinheiro (componente `Money`) e no "R$" do logo — nunca em fundo grande
- Tokens semânticos em `app/globals.css` (`--bg`, `--surface`, `--surface-2`,
  `--border`, `--text`, `--text-muted`, `--brand`, `--ok`/`--warn`/`--err`/`--info`)
- Componentes base em `components/ui-kit/`: `Tabela`, `StatusPill`,
  `EstadoVazio`, `SkeletonLinhas`, `Money`, `PageHeader`, `CardLinha`,
  `FormSection`/`Campo`. **Sempre reusar**, não recriar do zero.
- `StatusPill` tem vocabulário fixo (`ok`/`alerta`/`critico`/`ruptura`/
  `aberto`/`pago`/`vencido`/`parcial`/`cancelado`/`ativo`/`inativo`) — ver
  `components/ui-kit/StatusPill.tsx` antes de inventar um status novo
- ⚠️ `DESIGN_SPEC.md` na raiz está **desatualizado** (descreve o tema teal
  escuro antigo, `#07151a` etc.) — não confiar nele, este arquivo é a fonte
  de verdade atual

## Arquitetura multi-local

Tabela `locais` (`id`, `nome`, `slug`, `ativo`). Todo dado operacional
(`produtos`, `clientes`, `fornecedores`, `pedidos`, `contas_pagar`) tem
`local_id`. O local ativo da sessão é um cookie (`local_ativo`), resolvido
por `getLocalAtivo()`/`getLocalAtivoId()` em `lib/local.ts` — **todo** server
action que lê/grava dado operacional passa por essa função, nunca hardcoda
o local. Troca de local: `trocarLocal()` em `lib/actions/local.ts`.

Desde a feature de convite (ver abaixo), contas não-admin podem ter
`local_id` fixo em `profiles` — `getLocalAtivo()` força esse local
ignorando o cookie, e o seletor de local no topo (`SeletorLocal.tsx`)
esconde o dropdown quando só há 1 local permitido.

## Modelo de negócio (o que já existe)

- **Ato central = MOVIMENTAÇÃO**: ENTRADA (compra, aumenta estoque) ou
  SAÍDA (venda, baixa estoque), registradas em `/movimentacoes/nova`
  (`components/movimentacao/FormSaida.tsx` e `FormEntrada.tsx`). Histórico
  unificado em `/movimentacoes` (`lib/actions/movimentacoes.ts`).
- **Venda** (`registrarVenda` em `lib/actions/pedidos.ts`): baixa estoque
  atômica, cliente **opcional** (venda de balcão), forma de pagamento
  dinheiro/pix/cartão débito/cartão crédito/fiado. Fiado gera linha em
  `contas_receber` com vencimento = hoje + prazo. Preço de venda **nunca**
  é forçado pelo sistema — `margem_alvo_pct` só sugere quando o preço
  ainda está zerado, nunca sobrescreve um preço já definido.
- **Formas de venda (multi-embalagem, 03/07/2026)**: tabela
  `produto_embalagens` (nome, unidades, preço, padrão) — um produto vende
  em Unidade + Fardo 12 + Caixa 24 etc., cada uma com preço próprio,
  escolhidas por mini-cards na comanda (+ opção "Outra" pra pacote
  montado na hora). Estoque continua 100% em unidade base;
  `pedido_itens.embalagem_nome/embalagem_unidades` guardam a forma
  vendida (cupom mostra "1 Fardo 12 (12 un)"). Os campos legados
  `embalagem`/`fator_conversao` em `produtos` só espelham a maior forma
  (compat) — a fonte da verdade é `produto_embalagens`.
- **Código interno de produto**: coluna `codigo_barras` foi reaproveitada
  como código interno auto-gerado por categoria (ex. `CER-0001`), **não é**
  um código de barras real de fábrica.
- **Custo médio ponderado** em `estoque.custo_medio`, recalculado a cada
  entrada.
- **Entrega/Retirada** (01/07/2026, ampliado 02-03/07): venda ganha
  `tipo_fulfillment` (`balcao`/`entrega`/`retirada`). Pra `entrega`:
  entregador (qualquer pessoa ativa da Equipe) + frete (preenchido pela
  **taxa do bairro** do cliente se cadastrada em Configurações > Taxas).
  `pago`, `saiu_entrega_em` e `concluido_em` independentes
  (`FulfillmentAcoes.tsx`, com modo `empilhado` pra tela do entregador).
  Tela `/pedidos` (Em andamento/Concluídos) mostra tempo de entrega.
  **Cargo Entregador** tem tela própria: `/dashboard` roteia por cargo
  (`TelaEntregador.tsx`, sem sidebar) com as entregas designadas a ele,
  botões Ligar/WhatsApp e o próximo passo em destaque. Relatório de
  entregadores em `/relatorios/entregadores`. Botão "Avisar no WhatsApp"
  no detalhe do pedido usa `profiles.telefone` (editável na Equipe).
- **Mega pacote 03/07/2026** (spec/plan em docs/superpowers/*mega-*):
  `/caixa` fechamento diário às cegas (`caixa_fechamentos`); metas
  mensais (`metas_venda`, barra no dashboard); DRE 6 meses
  (`calcular_dre_serie`); comparativo entre locais (admin,
  `comparativo_locais`); cobrança de fiado via wa.me em A receber;
  `limite_credito` trava fiado em `registrarVenda`; extrato do cliente
  imprimível (Sidebar/Topbar têm `print:hidden`); troco
  (`pedidos.valor_recebido`) e desconto (`desconto_total`) na venda;
  comanda em espera (localStorage); QR Pix estático (`lib/pix.ts`
  payload EMV + CRC16 validado, chave em `locais.chave_pix`, dep
  `qrcode`); inventário com ajuste em massa (`/estoque/contagem`,
  `inventarios`); reposição por giro real (28d); validade nas entradas
  (`movimentacoes_estoque.validade`, alerta 30 dias); transferência
  entre locais (`transferencias`, clona produto+embalagens no destino).
- **Equipe + convite** (implementado 01/07/2026): cadastro público em
  `/login` foi **fechado**. Única forma de criar conta é via link de
  convite (`/convite/[token]`, uso único, expira em 7 dias, gerado em
  `/equipe` — só admin). O convite já define cargo + local da pessoa; ao
  resgatar, ela já entra com as permissões certas. Toda escrita sensível
  (criar/revogar/resgatar convite) roda em **funções Postgres
  `security definer`** (`criar_convite`, `revogar_convite`,
  `consultar_convite`, `resgatar_convite`) — não em `createServiceClient()`
  direto. Ver "Gotcha grave" abaixo pra entender por quê.
- **Cargos/permissões**: tabela `cargos` (`admin` boolean + `itens_visiveis`
  array de hrefs). `lib/nav-catalogo.ts` tem `rotaPermitida()` (trava real
  de rota, roda no layout) e `itemVisivel()` (só esconde botão). Cargo nulo
  ou `admin=true` = acesso total (fail-open intencional).

## O que NÃO existe (não inventar que já foi feito)

- Sem integração de email/SMS (tudo que é "avisar/cobrar no WhatsApp" é
  link wa.me manual, não envio automático)
- Sem geolocalização (frete vem da taxa por bairro ou é digitado)
- Sem NFC-e/nota fiscal, sem PSP/confirmação automática de Pix (o QR é
  estático; conferência de recebimento é no app do banco)
- Sem lote/FIFO de validade (só data por entrada + alerta) e sem
  sangria/reforço no fechamento de caixa
- Cargos ativos: Administrador, Funcionario, Entregador (Gerente/Caixa
  foram consolidados em Funcionario em 03/07/2026)
- Confirmar entrega/retirada não é restrito ao designado — admin e
  funcionário podem destravar qualquer uma

## Navegação (reorganizada em 01/07/2026)

```
Dashboard
+ Nova Movimentação        (botão destacado)
Movimentações              (item direto)
Cadastros                  (grupo)
  ├─ Clientes
  ├─ Fornecedores
  ├─ Produtos
  └─ Equipe                (só aparece pra admin)
Estoque                    (item direto — mescla Posição + Reposição via EstoqueTabs)
Financeiro                 (item direto, 5 abas internas)
Relatórios                 (grupo, 4 abas — inclui "Faturamento & ABC")
Configurações              (rodapé, só admin — Dados do Depósito + Cargos)
```

`components/shell/nav-items.tsx` = agrupamento **visual** da sidebar.
`lib/nav-catalogo.ts` = catálogo **de permissões** (checkboxes da tela de
Cargos) — são dois agrupamentos separados, não precisam bater 1:1.
Produtos fica em **Cadastros**, não em Estoque — decisão explícita do
cliente ("estoque é só pra editar estoque, preço/cadastro do produto é
outra coisa").

Produtos, Clientes e Fornecedores têm filtros de segmented-control
(categoria/status, tipo/status) client-side sobre a lista já carregada,
inspirados no sistema NTB Estoque.

## Gotcha grave: `createServiceClient()` não bypassa RLS com sessão ativa

`lib/supabase/server.ts` tem `createClient()` (anon key) e
`createServiceClient()` (service role key), mas os dois usam
`createServerClient()` do `@supabase/ssr`, que **sempre prioriza o cookie
de sessão** sobre a key passada no construtor. Ou seja: se o usuário já
está logado, `createServiceClient()` roda **como aquele usuário**, sujeito
à RLS dele — só bypassa de verdade quando não há sessão nenhuma (ex.
visitante anônimo abrindo `/convite/[token]` antes de se cadastrar).

Isso já causou um bug real (fiado quebrado por falta de policy). Pra
qualquer escrita privilegiada que precise rodar independente de quem
chama (ex. convite, cargo), o padrão correto é uma **função Postgres
`security definer`** (ver `criar_convite`/`resgatar_convite` na migration
`2026-07-01-convites-equipe.sql`), não confiar em `createServiceClient()`.

## Outro gotcha: `RETURN QUERY` do Postgres exige tipo exato

Se uma função `plpgsql` declara `returns table (x text)` mas a query
retorna uma coluna `varchar(120)` (ex. `locais.nome`), dá erro em runtime
("structure of query does not match function result type") mesmo a
diferença sendo "só" varchar vs text. Sempre `::text` explícito quando
misturar `text` e `varchar` em `RETURN QUERY`.

## Migrations

`supabase/migrations/YYYY-MM-DD-descricao.sql` (ou `NNN_nome.sql` nas mais
antigas). Aplicar com:

```bash
node -e "require('dotenv').config({path:'.env.local'}); const {Pool}=require('pg'); const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); pool.query(require('fs').readFileSync('./supabase/migrations/ARQUIVO.sql','utf8')).then(()=>{console.log('ok');pool.end()}).catch(e=>{console.error(e.message);pool.end()})"
```

## Onde estão as specs/planos

Todo trabalho maior passou por `superpowers:brainstorming` →
`superpowers:writing-plans` → execução. Specs em
`docs/superpowers/specs/YYYY-MM-DD-<tema>-design.md`, planos em
`docs/superpowers/plans/YYYY-MM-DD-<tema>-plan.md`. Vale ler antes de
mexer numa área grande (ex. convite/local scoping, entrega/retirada) pra
entender o porquê das decisões, não só o quê.

## Convenções de commit/estilo

- Português correto, com acentos — nunca simplificar pra ASCII
- Sem travessão (—) no copy voltado pro usuário (dashboards, labels, toasts)
- Commits pequenos, um por unidade de trabalho, sempre com
  `git push` no final
