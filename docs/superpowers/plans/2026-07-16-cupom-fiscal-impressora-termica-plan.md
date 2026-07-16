# Cupom fiscal unificado (impressora térmica 80mm) — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer todo pedido (venda + reimpressão pelo botão "Romaneio") imprimir como um único cupom fiscal térmico 80mm, sem documento A4 separado, pronto pra sair perfeito na impressora USB VT-8360 do cliente.

**Architecture:** `CupomFiscal.tsx` vira o template único de impressão de pedido. `RomaneioView.tsx` (documento A4) é apagado. A rota `/pedidos/[id]/romaneio` passa a renderizar `CupomFiscal` em vez de `RomaneioView`. O CSS de impressão (esconder tudo exceto `.cupom-print-area`, `@page 80mm`) sai de dentro de `FormSaida.tsx` (onde estava duplicado) e vira uma regra única em `app/globals.css`, substituindo o bloco A4 antigo.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Supabase.

## Global Constraints

- Português correto, com acentos — nunca simplificar pra ASCII (regra do `CLAUDE.md`).
- Sem travessão (—) em copy voltado pro usuário (labels, toasts, texto de tela).
- Sem suite de testes automatizada neste projeto — verificação é sempre `npx tsc --noEmit`, `npx eslint . --quiet`, `npx next build` + teste manual no browser.
- Commits pequenos, um por unidade de trabalho, sempre com `git push` no final (regra do `CLAUDE.md`).
- Não mexer em nada do fluxo de impressão da venda além do que este plano descreve (o botão/UX de `FormSaida.tsx` já funciona e não deve mudar de comportamento pro usuário).

---

### Task 1: `CupomData`/`CupomFiscal` ganham tipo de entrega e largura real de 72mm

**Files:**
- Modify: `components/romaneio/CupomFiscal.tsx`

**Interfaces:**
- Produces: `CupomData` (interface) com dois campos novos opcionais:
  `tipo_fulfillment?: string | null` e `entregador?: { nome: string } | null`.
  `CupomFiscal({ data }: { data: CupomData })` continua com a mesma
  assinatura, só passa a renderizar esses campos quando presentes. A
  largura do cupom (tela e impressão) passa a ser `72mm` fixo em vez de
  `maxWidth: '320px'`.

- [ ] **Step 1: Importar `rotuloFulfillment` e estender `CupomData`**

Em `components/romaneio/CupomFiscal.tsx`, troque a linha 2 e o final da
interface `CupomData` (linhas 26-30, bloco `clientes`):

```tsx
import { formatarReal, formatarData } from '@/lib/formatos'
import { rotuloPagamento, rotuloFulfillment } from '@/lib/pedido-labels'
```

E logo depois do bloco `clientes` dentro de `CupomData` (antes de
`pedido_itens`), adicione:

```tsx
  clientes: {
    nome: string
    telefone: string | null
    endereco: Record<string, string> | null
  } | null
  tipo_fulfillment?: string | null
  entregador?: { nome: string } | null
  pedido_itens: Array<{
```

- [ ] **Step 2: Renderizar tipo de entrega/entregador após o bloco do cliente**

No corpo de `CupomFiscal`, logo depois do `<Divisor />` que fecha o bloco
"Cliente" (o que vem logo antes do comentário `{/* Cabeçalho dos itens */}`),
insira um novo bloco condicional:

```tsx
      <Divisor />

      {/* Cliente */}
      {data.clientes ? (
        <div style={{ fontSize: '10px' }}>
          <div style={{ fontWeight: 700, marginBottom: '2px' }}>CLIENTE</div>
          <div>{data.clientes.nome}</div>
          {data.clientes.telefone && (
            <div>Tel: {data.clientes.telefone}</div>
          )}
          {rua && <div>End: {rua}</div>}
          {complemento && (
            <div style={{ paddingLeft: '29px' }}>{complemento}</div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: '10px', fontStyle: 'italic' }}>
          Consumidor não identificado
        </div>
      )}

      {data.tipo_fulfillment && (
        <div style={{ fontSize: '10px', marginTop: '4px' }}>
          <span>Tipo: {rotuloFulfillment(data.tipo_fulfillment)}</span>
          {data.entregador?.nome && (
            <div>Entregador: {data.entregador.nome}</div>
          )}
        </div>
      )}

      <Divisor />

      {/* Cabeçalho dos itens */}
```

(Ou seja: só o novo bloco `{data.tipo_fulfillment && (...)}` é inserido
entre o `if/else` do cliente e o `<Divisor />` que já existia antes do
cabeçalho dos itens — o resto do arquivo não muda.)

- [ ] **Step 3: Trocar a largura do cupom de px pra mm reais**

No `style` do `<div className="cupom-fiscal" ...>` (início do componente),
troque:

```tsx
        width: '100%',
        maxWidth: '320px',
        margin: '0 auto',
```

por:

```tsx
        width: '72mm',
        margin: '0 auto',
```

- [ ] **Step 4: Verificar tipos**

Run: `cd ~/Projects/Depsys && npx tsc --noEmit`
Expected: sem novos erros relacionados a `CupomFiscal.tsx` ou `CupomData`
(o projeto já tem `ignoreBuildErrors` no build por outros motivos
documentados no `CLAUDE.md`, mas `tsc --noEmit` deve rodar limpo pra esse
arquivo).

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/Depsys
git add components/romaneio/CupomFiscal.tsx
git commit -m "feat: cupom fiscal mostra tipo de entrega e usa largura real de 72mm"
```

---

### Task 2: CSS de impressão do cupom vira regra global única (substitui o bloco A4)

**Files:**
- Modify: `app/globals.css:375-395`

**Interfaces:**
- Produces: classe global `.cupom-print-area` + `@page { size: 80mm auto; margin: 0 !important; }` ativos em qualquer página que tenha um elemento com essa classe. Task 3 e Task 4 dependem dessa classe existir globalmente.

- [ ] **Step 1: Substituir o bloco de impressão A4 pelo bloco de impressão térmica 80mm**

Em `app/globals.css`, troque o bloco (linhas 375-395):

```css
/* ------------------------------------------------------------------ *
 * Impressão A4 - romaneio (NAO alterar)
 * ------------------------------------------------------------------ */
@media print {
  .no-print {
    display: none !important;
  }
  body {
    background: white !important;
    color: black !important;
    font-family: Arial, sans-serif !important;
  }
  .romaneio {
    margin: 0;
    padding: 8mm;
  }
  @page {
    size: A4;
    margin: 10mm;
  }
}
```

por:

```css
/* ------------------------------------------------------------------ *
 * Impressão do cupom fiscal - térmica 80mm (venda e romaneio)
 * ------------------------------------------------------------------ */
@media print {
  .no-print {
    display: none !important;
  }
  body * {
    visibility: hidden !important;
  }
  .cupom-print-area,
  .cupom-print-area * {
    visibility: visible !important;
  }
  .cupom-print-area {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 80mm !important;
    background: white !important;
  }
}
@page {
  size: 80mm auto;
  margin: 0 !important;
}
```

- [ ] **Step 2: Verificar que não sobrou referência a `.romaneio` em CSS**

Run: `cd ~/Projects/Depsys && grep -n "\.romaneio\|size: A4" app/globals.css`
Expected: nenhum resultado (o seletor `.romaneio` não existe mais no
CSS global — ele só volta a existir se algum componente ainda usar essa
classe, o que será removido na Task 4).

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/Depsys
git add app/globals.css
git commit -m "feat: unifica CSS de impressao em cupom termico 80mm, remove regra A4"
```

---

### Task 3: `FormSaida.tsx` para de duplicar o CSS de impressão

**Files:**
- Modify: `components/movimentacao/FormSaida.tsx:545-566`

**Interfaces:**
- Consumes: classe global `.cupom-print-area` e `@page 80mm` produzidos na Task 2 (já aplicados automaticamente a qualquer elemento com `className="cupom-print-area"`, que este arquivo já usa na div do cupom em `FormSaida.tsx:604`).

- [ ] **Step 1: Remover o `<style>` inline duplicado**

Em `components/movimentacao/FormSaida.tsx`, troque:

```tsx
  if (vendaRegistrada) {
    return (
      <>
        {/* CSS injetado apenas quando o cupom existe */}
        {mostrarCupom && (
          <style>{`
            @page { size: 80mm auto; margin: 0 !important; }
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
          `}</style>
        )}

        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 py-8">
```

por:

```tsx
  if (vendaRegistrada) {
    return (
      <>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 py-8">
```

- [ ] **Step 2: Verificar tipos e lint**

Run: `cd ~/Projects/Depsys && npx tsc --noEmit && npx eslint components/movimentacao/FormSaida.tsx --quiet`
Expected: sem erros novos (a variável `mostrarCupom` continua usada em
outros pontos do arquivo, então não vira import/estado morto).

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/Depsys
git add components/movimentacao/FormSaida.tsx
git commit -m "refactor: remove CSS de impressao duplicado de FormSaida (agora e global)"
```

---

### Task 4: Rota `/pedidos/[id]/romaneio` renderiza `CupomFiscal`; `RomaneioView` é apagado

**Files:**
- Modify: `app/(print)/pedidos/[id]/romaneio/page.tsx`
- Delete: `components/romaneio/RomaneioView.tsx`

**Interfaces:**
- Consumes: `CupomFiscal({ data }: { data: CupomData })` e a interface
  `CupomData` produzidos na Task 1 (incluindo os campos novos
  `tipo_fulfillment` e `entregador`); classe `.cupom-print-area`
  produzida na Task 2; `PrintActions({ numeroPedido })` (já existente,
  sem mudança).

- [ ] **Step 1: Reescrever a página do romaneio**

Substitua todo o conteúdo de
`app/(print)/pedidos/[id]/romaneio/page.tsx` por:

```tsx
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { CupomFiscal } from '@/components/romaneio/CupomFiscal'
import { PrintActions } from '@/components/romaneio/PrintActions'

export default async function RomaneioPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: pedido } = await supabase
    .from('pedidos')
    .select(
      `*, locais(nome, cnpj, telefone, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade), clientes(nome, telefone, endereco), pedido_itens(quantidade_pedida, preco_unitario, total, embalagem_nome, embalagem_unidades, produtos(nome, embalagem)), entregador:profiles!pedidos_entregador_id_fkey(nome)`,
    )
    .eq('id', id)
    .single()

  if (!pedido) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = pedido as any

  return (
    <>
      <div className="cupom-print-area mx-auto max-w-xs py-6">
        <CupomFiscal data={p} />
      </div>
      <PrintActions numeroPedido={p.numero_pedido} />
    </>
  )
}
```

Note a diferença da query original: `pedido_itens` agora também busca
`embalagem_nome, embalagem_unidades` (mesmos campos que o cupom da venda
usa pra mostrar "1 Fardo 12 (12 un)") — sem isso o cupom reimpresso
mostraria só a unidade base, divergindo do cupom impresso na hora da
venda.

- [ ] **Step 2: Apagar o componente A4 antigo**

```bash
cd ~/Projects/Depsys
rm components/romaneio/RomaneioView.tsx
```

- [ ] **Step 3: Confirmar que não sobrou nenhum import de `RomaneioView`**

Run: `cd ~/Projects/Depsys && grep -rn "RomaneioView" app components lib`
Expected: nenhum resultado.

- [ ] **Step 4: Verificar tipos e lint**

Run: `cd ~/Projects/Depsys && npx tsc --noEmit && npx eslint . --quiet`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/Depsys
git add -A
git commit -m "feat: romaneio agora imprime o mesmo cupom termico 80mm da venda"
```

---

### Task 5: Build final, teste manual no browser e push

**Files:** nenhum arquivo novo — só verificação.

- [ ] **Step 1: Build de produção**

Run: `cd ~/Projects/Depsys && npx next build`
Expected: build conclui (avisos de tipo `never` do Supabase são
esperados e documentados no `CLAUDE.md`, não são bug real).

- [ ] **Step 2: Teste manual do fluxo de venda**

```bash
cd ~/Projects/Depsys && npm run dev
```

No browser: logar com `sallesjoaquim111009@gmail.com` / `Deposito2026!`,
ir em Nova Movimentação > Saída, registrar uma venda de teste, clicar em
"Ver cupom" e depois "Imprimir". Usar o preview de impressão do Chrome
(Ctrl/Cmd+P) e confirmar: papel mostrado como ~80mm de largura, conteúdo
do cupom ocupando a largura toda sem cortar texto, sem sobrar o resto da
tela (sidebar/topbar/botões) na prévia de impressão.

- [ ] **Step 3: Teste manual do romaneio (reimpressão)**

Abrir um pedido existente em `/pedidos/[id]`, clicar em "Romaneio",
confirmar que abre o mesmo layout de cupom térmico (não mais o
documento A4), com tipo de entrega/entregador aparecendo quando o
pedido for de entrega. Repetir o Ctrl/Cmd+P e conferir o preview de
impressão do mesmo jeito do Step 2.

- [ ] **Step 4: Push**

```bash
cd ~/Projects/Depsys
git push
```

- [ ] **Step 5: Anotar pendência de validação física**

Sem passo de código aqui — só um lembrete pro teste de amanhã no
cliente: se o cupom sair cortado ou em tamanho errado na VT-8360 mesmo
com esse CSS correto, o problema está no tamanho de papel configurado
no driver/fila de impressão do Windows, não no código do app (ver seção
"Fora do controle deste código" na spec
`docs/superpowers/specs/2026-07-16-cupom-fiscal-impressora-termica-design.md`).
