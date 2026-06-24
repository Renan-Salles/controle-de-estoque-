# R$ DEPÓSITO — Design Spec (obrigatório para todos os agentes)

Sistema interno de gestão de depósito de bebidas. Operador usa o dia todo, no balcão e no telefone.
Prioridade: velocidade, clareza, densidade de dados. NÃO é landing page, é ferramenta.

## Dials (design-taste-frontend)
- VISUAL_DENSITY: 7 (cockpit-ish, tabelas densas, números em mono)
- MOTION_INTENSITY: 4 (sutil e rápido, sem nada cinematográfico)
- DESIGN_VARIANCE: 4 (funcional, alinhado à esquerda, sem assimetria artsy)

## Marca / Cores (NÃO inventar outras)
- Fundo base: `#07151a` (quase-preto teal). NUNCA `#000000`.
- Superfície (card/painel): `#0e1e24`
- Superfície 2 (hover/elevado): `#132028`
- Borda: `#1e3040`
- Texto primário: `#e8dfc8` (off-white quente)
- Texto secundário (muted): `#8aa0a8`
- Accent ÚNICO: teal `#2B7A78` (botões primários, links ativos, foco)
- Dourado `#D4A520`: SÓ para dinheiro/valores em destaque e badge premium. Nunca em fundo grande.
- Status: ok=`#3fbf8f`, alerta=`#D4A520`, crítico/ruptura=`#e0524d`

## Tipografia
- Fonte UI: **Geist** (via pacote `geist/font/sans`). BANIDO Montserrat e Inter.
- Números/dinheiro/códigos: **Geist Mono** (`geist/font/mono`) com `tabular-nums`.
- Headings de página: `text-xl font-semibold tracking-tight` (não gigante).
- Labels de tabela/section: `text-[11px] uppercase tracking-wider text-muted`.
- Body: `text-sm`.

## Layout
- Shell: sidebar fixa 240px + área principal com topbar fina (título da página + ações + usuário).
- Container de conteúdo: `px-6 py-5`, largura total (é app, não site).
- Densidade: usar `divide-y divide-border` em tabelas em vez de empilhar cards.
- Cards SÓ quando elevação comunica hierarquia (ex: KPI no dashboard). Em listas, usar linhas com borda.

## Tabelas (padrão obrigatório)
- Header sticky, `text-[11px] uppercase tracking-wider text-muted`, `bg-surface`.
- Linhas com `divide-y`, hover `bg-surface-2`, altura confortável (`h-12`).
- Números/valores alinhados à direita, em `font-mono tabular-nums`.
- Status em pill pequena (não badge shadcn genérica): `inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px]` com ponto colorido.

## Formulários
- Label ACIMA do input, `gap-2`.
- Erro inline abaixo do campo em vermelho `text-[#e0524d] text-xs`.
- Botão primário: teal, `active:scale-[0.98] transition`, estado loading com texto.
- Agrupar em seções com título, não um monte de inputs soltos.

## Estados (OBRIGATÓRIO em toda tela com dados)
- **Loading**: skeleton que casa com o layout (linhas de tabela cinza pulsando), NUNCA spinner genérico.
- **Vazio**: estado vazio composto — ícone discreto + frase do que fazer + botão de ação. Ex: "Nenhum produto ainda. Cadastre o primeiro para começar a vender." + botão.
- **Erro**: inline, claro.

## Microinterações
- Botões: `active:scale-[0.98]`, transição 150ms.
- Linhas clicáveis: cursor pointer + hover de fundo.
- Toasts (sonner) para feedback de ação.
- Sem glow neon, sem gradiente roxo, sem emoji. Ícones: `lucide-react` (já instalado), strokeWidth 1.5 consistente.

## Dados de exemplo / placeholders
- Nomes de bar realistas pt-BR: "Bar do Tião", "Mercadinho Santa Rita", "Distribuidora Olho d'Água".
- Produtos: "Brahma Duplo Malte 350ml", "Coca-Cola 2L", "Água Mineral Indaiá 500ml".
- Valores orgânicos: R$ 4,75 / R$ 38,90, não R$ 5,00 redondo.

## Stack (já instalado — verificar package.json antes de importar)
Next 16 App Router, React 19, Tailwind 4, @base-ui/react (Select/Sheet/Dialog passam `string | null` no onValueChange — tratar), lucide-react, sonner, recharts, react-hook-form + zod 4 (usar `.issues` não `.errors`), TanStack Query/Table.
ATENÇÃO: o Button/Trigger deste projeto NÃO suporta `asChild`. Para link estilizado, usar `<Link>` com classes diretas.
