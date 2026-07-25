# Restrição de dados financeiros por cargo — Design

**Data:** 2026-07-25
**Contexto:** Cliente quer que lucro, faturamento e qualquer valor R$ de
desempenho do negócio (lucro, vendas do dia, DRE, caixa, contas a
pagar/receber) apareçam **só pra Administrador**. Funcionário e Entregador
continuam fazendo pedido/venda, cadastro e movimentação de estoque
normalmente — só não veem esses números agregados.

## Achado que muda o escopo original

Antes de desenhar a solução, explorei RLS/RPCs e achei que **hoje não há
nenhuma checagem de cargo** nas tabelas financeiras nem nas RPCs
`calcular_dre`/`calcular_dre_serie` — só "autenticado + local certo". Ou
seja, um funcionário logado já consegue chamar `calcular_dre` direto (fora
da tela) e pegar o lucro, mesmo sem eu mexer em nada. Só esconder componente
no dashboard não fecha isso.

Ao ler o código de perto pra desenhar o fechamento, achei uma correção
**do que eu falei antes** de aprovado: não dá pra travar `contas_receber`
por `is_admin()` na RLS, porque `registrarVenda` (a venda fiado do próprio
funcionário) grava ali usando o client autenticado normal — travar quebraria
venda fiado pro funcionário. Só `contas_pagar` (que o funcionário nunca
grava nem lê — não está nos `itens_visiveis` do cargo Funcionario) pode ser
travada de verdade na RLS.

## Decisões

- **Granularidade real de enforcement**: nem toda tabela financeira aceita
  o mesmo tipo de proteção, porque algumas (`pedidos`, `contas_receber`,
  `caixa_fechamentos`) precisam continuar graváveis/legíveis pelo
  funcionário pra ele fazer o trabalho dele (vender, dar baixa em fiado,
  fechar caixa). A defesa por tabela:
  - `contas_pagar` → **RLS real** (`is_admin()`), porque funcionário nunca
    interage com ela.
  - `calcular_dre` / `calcular_dre_serie` (RPC) → **checagem de cargo dentro
    da função**, porque ninguém sem ser admin tem motivo pra chamar.
  - `pedidos`, `contas_receber`, `caixa_fechamentos` → **ficam com a RLS de
    hoje** (autenticado + local); o corte acontece nas server actions que
    formatam a resposta (não devolvem os campos agregados/de reconciliação
    pra quem não é admin) e nas telas (não renderizam pra quem não é admin).
- **Limite honesto dessa abordagem**: como `pedidos.total` continua
  legível linha a linha pelo funcionário (ele precisa pra cobrar o
  cliente), ele tecnicamente poderia somar os pedidos do dia manualmente
  fora do app e chegar num número parecido com "vendas hoje". Isso não dá
  pra fechar sem tirar o acesso a pedidos que ele precisa pra vender — é uma
  limitação física do requisito, não uma falha do design. O que dá (e vou)
  pra fechar de verdade é o **cálculo pronto** (lucro líquido, margem, CMV,
  DRE, diferença de caixa) — isso some completamente pra quem não é admin.
- **Custo de produto** (`movimentacoes_estoque.custo_unitario`) fica **fora
  de escopo** — funcionário precisa ler essa tabela pra registrar
  entrada/saída de estoque, e RLS não esconde coluna, só linha. Hoje não
  aparece em nenhuma tela de funcionário. Fechar isso de verdade pediria
  view + roles por cargo no Postgres, escopo bem maior que o pedido.
- **Caixa (`/caixa`)**: funcionário continua lançando o fechamento do dia
  (dinheiro contado). Deixa de ver, tanto na tela de resultado imediato
  quanto no histórico: esperado por forma e diferença — porque
  `diferença = contado - esperado` deixa reconstruir o faturamento do dia
  em dinheiro só de cabeça. Continua vendo: o que ele mesmo contou,
  quantidade de vendas pagas do dia, quem fechou, a data.
- **Entregador**: já está OK hoje — `TelaEntregador` mostra só o valor do
  pedido que ele está entregando (precisa pra cobrar/dar troco) e nenhum
  agregado. `rotaPermitida` já bloqueia ele de tudo fora `/dashboard`
  (`itens_visiveis` vazio). Nenhuma mudança necessária aqui, só confirmar
  com teste manual.
- **Dashboard**: os blocos que somem pra quem não é admin (Funcionario e
  qualquer cargo futuro não-admin — mantendo o mesmo fail-open que
  `rotaPermitida` já usa: `cargo === null || cargo.admin` sempre vê tudo):
  Vendas hoje (R$), Receita do mês, Ticket médio do dia, Lucro do mês,
  Cliente destaque (mostra ticket médio), gráfico de vendas, banner de
  fiado vencido/vencendo, barra de meta do mês, atalho "Formas de
  pagamento" (rota que ele não acessa mesmo). Continuam: alerta de estoque
  crítico, banner de pedidos em andamento, lista de pedidos recentes (com
  o valor de cada pedido — precisa pra atender/entregar).

## 1. RLS — `contas_pagar`

Bug preexistente: duas policies permissivas que se anulam (Postgres faz OR
entre policies `for all`/`select` permissivas do mesmo tipo). A policy
"gerente ve contas pagar" (`2026-07-01-rls-escopo-por-local.sql:70-74`,
só checa local, não cargo) anula a "admin ve contas pagar"
(`009_fix_rls_recursion.sql:36-38`, usa `is_admin()`).

```sql
-- supabase/migrations/2026-07-25-financeiro-so-admin.sql
drop policy if exists "gerente ve contas pagar" on public.contas_pagar;
-- "admin ve contas pagar" (is_admin()) já existe e passa a valer sozinha.
```

Sem mudança de código — `buscarContasPagar`/`criarContaPagar`
(`lib/actions/financeiro.ts`) e a rota `/financeiro/a-pagar` já não são
alcançáveis por Funcionario/Entregador (não estão em `itens_visiveis`).

## 2. RPC `calcular_dre` / `calcular_dre_serie` — checagem de cargo

Ambas passam de `language sql` pra `language plpgsql`, com um early return
antes do corpo atual: sem ser admin, `calcular_dre` retorna `null` e
`calcular_dre_serie` retorna vazia (0 linhas), em vez de calcular.

```sql
create or replace function public.calcular_dre(p_local_id uuid, p_mes date)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not public.is_admin() then
    return null;
  end if;
  return (
    with periodo as ( ... ) -- corpo atual, sem mudança
    select json_build_object( ... )
  );
end;
$function$;

create or replace function public.calcular_dre_serie(p_local_id uuid, p_meses int default 6)
returns table (mes text, receita numeric, cmv numeric, perdas numeric)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not public.is_admin() then
    return;
  end if;
  return query
    with meses as ( ... ) -- corpo atual, sem mudança
    select ...;
end;
$function$;
```

`getDre()`/`getDreSerie()` (`lib/actions/dre.ts`) só são chamadas pelo
dashboard/financeiro quando o cargo é admin (ver seção 4) — a checagem na
RPC é cinto de segurança pra chamada direta, não o caminho normal.

## 3. Caixa — `lib/actions/caixa.ts`

`listarFechamentos()` e o retorno de `fecharCaixa()` passam a receber o
cargo (`getCargoUsuario()`) e, quando não-admin, **não incluem** os campos
`esperado_dinheiro`, `esperado_pix`, `esperado_debito`, `esperado_credito`,
`diferenca` no objeto retornado (em vez de mandar `0`/`null`, que um
funcionário curioso poderia confundir com "bateu certinho" — os campos
simplesmente não vêm).

```ts
export type Fechamento = {
  id: string
  data: string
  dinheiro_contado: number
  esperado_dinheiro?: number
  esperado_pix?: number
  esperado_debito?: number
  esperado_credito?: number
  diferenca?: number
  observacoes: string | null
  created_at: string
  fechado_por_nome: string | null
}

export async function listarFechamentos(limite = 30): Promise<Fechamento[]> {
  const cargo = await getCargoUsuario()
  const podeVerEsperado = !cargo || cargo.admin
  // ...query igual a hoje...
  return dados.map((f) => {
    const base = { ...f, fechado_por_nome: ... }
    if (podeVerEsperado) return base
    const { esperado_dinheiro, esperado_pix, esperado_debito, esperado_credito, diferenca, ...resto } = base
    return resto
  })
}
```

`fecharCaixa()` ganha a mesma checagem antes de montar `comparativo`
no retorno — quando não-admin, devolve só `{ dinheiro_contado, totalVendas
}` (sem `dinheiro`/`pix`/`debito`/`credito`/`diferenca`).

**`components/caixa/FormFechamento.tsx`**: o tipo `Comparativo` e a tela de
resultado pós-confirmação passam a tratar os campos opcionais — quando
ausentes, mostra só "Fechamento registrado. Contado: R$X, Y vendas pagas
hoje", sem a seção "esperado/diferença".

**`app/(app)/caixa/page.tsx`**: colunas Esperado/Diferença da tabela de
histórico somem quando `f.esperado_dinheiro === undefined` (ou passa
`cargo`/`isAdmin` explícito pra tabela decidir quais colunas montar).

## 4. Dashboard — `app/(app)/dashboard/page.tsx`

Busca `cargo = await getCargoUsuario()` logo no topo (substitui a chamada
solta a `ehEntregador()`, que passa a ser `cargo?.nome === 'Entregador'`).
Define `podeVerFinanceiro = !cargo || cargo.admin` — mesma regra de
fail-open que `rotaPermitida` já usa.

`getDre()` e `buscarResumoFiado()` só entram no `Promise.all` quando
`podeVerFinanceiro` (senão a RPC de `calcular_dre` devolveria `null` e o
código teria que tratar de qualquer forma — mais simples nem chamar).
`getMeta()` idem (a barra de meta é só R$).

Montagem do array `kpis`: os itens Vendas hoje, Receita do mês, Ticket
médio do dia, Lucro do mês e Cliente destaque só entram quando
`podeVerFinanceiro`. Sobra só Estoque crítico pra quem não é admin — não
vou adicionar KPI novo no lugar (fora do pedido original).

Banner de fiado vencido, barra de meta, bloco do gráfico ("Vendas") e o
atalho "Formas de pagamento" só renderizam quando `podeVerFinanceiro`.
Alerta de estoque crítico, banner de pedidos em andamento e
`PedidosRecentes` continuam pra todo mundo.

## 5. Fora de escopo (documentado, não decisão silenciosa)

- Coluna `custo_unitario` em `movimentacoes_estoque` continua legível pelo
  funcionário via API direta (não pela UI) — ver "Decisões" acima.
- `/financeiro/*` e `/relatorios/*` (exceto os pontos já cobertos) não
  precisam de mudança de rota — já bloqueados hoje por `rotaPermitida` +
  `itens_visiveis` do cargo Funcionario/Entregador (confirmado consultando
  o banco: nenhum desses hrefs está na lista).

## 6. Testes manuais (antes de dar por concluído)

Preciso de uma conta de teste com cargo Funcionario (vou criar via convite,
usando o login admin de dev do `CLAUDE.md`, se não houver uma já). Roteiro:

1. Logado como Funcionario: `/dashboard` não mostra nenhum R$ agregado
   (só estoque crítico, pedidos em andamento, pedidos recentes com valor
   individual). `/financeiro/*`, `/relatorios/*` continuam 404/redirect.
2. `/caixa`: consegue lançar o fechamento do dia; a tela de confirmação e a
   tabela de histórico não mostram Esperado/Diferença, só Contado.
3. Fazer uma venda (à vista e fiado) como Funcionario — confirmar que
   continua funcionando (não quebrou `registrarVenda`/`contas_receber`).
4. Tentar chamar `calcular_dre` via `supabase.rpc(...)` direto no console
   do browser logado como Funcionario — confirmar que não retorna dado.
5. Logado como Administrador: tudo continua igual a antes (dashboard
   completo, `/caixa` com Esperado/Diferença, `/financeiro/a-pagar`
   acessível).
6. Logado como Entregador: confirmar que `TelaEntregador` não mudou
   (continua vendo só o valor do pedido que está entregando).
7. `npx tsc --noEmit`, `npx eslint . --quiet`, `npx next build`.
8. Como dev e produção são o mesmo banco (`jqdezlvqumzdkvvcbjtl`), aplicar
   a migration de RLS/RPC já é mudança ao vivo — dar `git push` do código
   correspondente logo depois de validar essa parte, antes de seguir pro
   resto (mesma regra do incidente de 2026-07-18 com rename de coluna:
   aqui não é rename, mas a checagem de `is_admin()` na RPC já vale pra
   produção assim que aplicada, então o código que gate as chamadas no
   dashboard precisa ir junto/logo depois, senão o dashboard de produção
   quebra pra todo mundo até o deploy).
