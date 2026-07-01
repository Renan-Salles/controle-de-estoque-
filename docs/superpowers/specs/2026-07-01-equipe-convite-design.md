# Convite de equipe + escopo por local

## Contexto

Sub-projeto 3 dos 4 levantados na sessão de reorganização de navegação
(01/07/2026): Equipe + login por convite com permissões. É pré-requisito do
sub-projeto 4 (entrega/retirada), que depende de saber quem é entregador.

Hoje, criar uma conta no sistema é 100% auto-serviço e aberto: a aba
"Criar conta" em `/login` deixa qualquer pessoa com um email se cadastrar
sozinha (via `supabase.auth.signUp()`), ganhar um perfil padrão
(`profiles.perfil = 'gerente'`, coluna legada) e entrar direto — a
confirmação de email está desativada no projeto, então nem isso trava.
Cabe ao admin, depois, abrir `/configuracoes/usuarios` e escolher manualmente
o cargo da pessoa. Não existe hoje nenhum mecanismo de convite, código,
token, nem envio de email/SMS (nenhum provedor configurado).

O seletor de local no topo ("Depósito" / "Império Salles") também não tem
nenhuma restrição por usuário — qualquer conta ativa troca livremente entre
os dois locais (`lib/actions/local.ts` só grava um cookie, sem checar quem é
o usuário).

## Modelo de dados

**Tabela nova `convites`:**
- `id` (uuid, PK)
- `token` (text, único, aleatório, vai na URL `/convite/[token]`)
- `cargo_id` (uuid, FK `cargos`) — cargo já escolhido no momento do convite
- `local_id` (uuid, FK `locais`) — local já escolhido no momento do convite
- `criado_por` (uuid, FK `profiles`) — quem gerou o convite
- `expira_em` (timestamptz) — `created_at` + 7 dias
- `usado_em` (timestamptz, nullable) — preenchido no resgate
- `usado_por` (uuid, FK `profiles`, nullable) — preenchido no resgate
- `created_at` (timestamptz, default now())

Um convite é válido se `usado_em is null` e `expira_em > now()`.

**Coluna nova em `profiles`: `local_id`** (uuid, FK `locais`, nullable).
Null = sem restrição de local (contas antigas e admins), no mesmo espírito
"fail-open" que `cargo_id` nulo já usa hoje (`rotaPermitida`/`itemVisivel`
tratam cargo nulo como acesso total). Preenchido automaticamente quando a
pessoa entra via convite.

## Fluxo do admin: tela "Equipe"

`/configuracoes/usuarios` vira `/equipe`, e entra no grupo **Cadastros** da
sidebar (4º item, depois de Produtos) — mas continua restrita a admin:
`rotaPermitida` trata `/equipe` do mesmo jeito que trata `/configuracoes`
hoje (não-admin que tentar acessar a URL direto é redirecionado pro
dashboard). No `NAV_CATALOGO`, `/equipe` entra com `grupo: 'Cadastros'` só
para fins de exibição do checkbox em Cargos — a checagem de acesso real
continua sendo "é admin", não um item de `itens_visiveis`.

A tela (renomeada de "Usuários" pra "Equipe") ganha 3 blocos:

1. **Pessoas ativas** — tabela que já existe hoje (nome, email, cargo,
   status editáveis), sem mudança de lógica.
2. **Convidar alguém** — botão que abre um formulário: `Select` de Cargo
   (reaproveita `listarCargos()` que já existe) + `Select` de Local
   (reaproveita `listarLocais()` que já existe). Ao confirmar, cria a linha
   em `convites` com token aleatório e mostra o link pronto
   (`{origem}/convite/{token}`) com botão "Copiar link" — o admin copia e
   manda manualmente (WhatsApp etc.), sem nenhuma integração de email/SMS.
3. **Convites pendentes** — lista os convites com `usado_em is null`,
   mostrando cargo, local e validade ("expira em N dias"), com botão
   "Revogar" que apaga a linha (ou marca cancelado — decisão de
   implementação, não muda a arquitetura). Convites expirados somem da
   lista de pendentes (filtro por `expira_em > now()` na query).

## Fluxo do convidado: resgate do link

Nova rota pública `/convite/[token]/page.tsx`, fora do layout autenticado
(mesmo grupo de rotas que `/login`, sem sidebar):

1. Server component busca o convite pelo token. Se não existe, já foi
   usado, ou expirou, mostra uma mensagem de erro clara ("Este convite não
   é mais válido, peça um novo convite") — sem vazar detalhes do sistema
   (não diz *qual* das três condições falhou).
2. Se válido, mostra pra quem foi o convite (nome do local + nome do cargo,
   ex.: "Convite para Império Salles — Vendedor") e um formulário: Nome,
   Email, Senha (mesmas regras de mínimo 6 caracteres já usadas em
   `/login`).
3. Ao confirmar: chama `supabase.auth.signUp()` (mesmo mecanismo de hoje,
   client-side) para criar o usuário e obter sessão imediata (confirmação
   de email já é desativada no projeto). Em seguida, uma server action
   (usando a sessão recém-criada) grava `nome`, `cargo_id` e `local_id` no
   `profile` recém-criado pelo trigger `handle_new_user()`, e marca o
   convite (`usado_em = now()`, `usado_por = <id do novo usuário>`). Se
   qualquer uma dessas duas escritas falhar depois do `signUp()` ter
   sucesso, a conta já existe mas fica sem cargo/local — mostra erro e
   orienta a pessoa a contatar o admin (fallback aceitável: é o mesmo
   estado em que contas antigas já vivem hoje, com cargo nulo).
4. Sucesso: entra direto no dashboard, já no local certo, com as
   permissões do cargo escolhido.

## Fechar o cadastro aberto

Em `app/(auth)/login/page.tsx`, remove a aba "Criar conta" e todo o modo
`cadastro` (função `cadastrar()`, toggle de abas) — sobra só "Entrar". A
única forma de criar conta no sistema passa a ser via `/convite/[token]`.

## Escopo por local

- `app/(app)/layout.tsx`: busca também o `local_id` do profile (nova função
  em `lib/permissoes.ts`, mesmo padrão de `getCargoUsuario()` usando
  `createServiceClient()`). Se o profile tem `local_id` preenchido e não é
  admin, filtra a lista de `locais` passada pro `Topbar`/`SeletorLocal` pra
  conter só aquele local (o seletor deixa de mostrar opção de trocar,
  já que só sobra 1 item — decisão de UI na implementação: pode virar só
  texto sem dropdown quando há 1 local só).
- `lib/actions/local.ts` (`trocarLocal`): antes de gravar o cookie, busca o
  cargo+local_id do usuário logado; se `local_id` está preenchido e o
  `slug` pedido não bate com o local permitido, rejeita (retorna erro) —
  reforço server-side pra não dar pra trocar chamando a action direto,
  mesmo que a UI já esconda a opção.

## Fora de escopo

- Sub-projeto 4 (entrega/retirada) não é construído aqui — só fica
  desbloqueado, porque agora dá pra saber quem é "entregador" via cargo.
- Não há envio automático de email/SMS/WhatsApp do convite — é sempre o
  admin que copia e manda manualmente.
- Não há edição de convite já criado (só revogar e criar outro).
- Coluna legada `profiles.perfil` não é tocada nem removida.

## Testes

- Admin gera convite pra um cargo X + local Y, copia o link.
- Abrir o link (sessão anônima/aba anônima): formulário mostra cargo/local
  certos, cria a conta, entra direto com o cargo/local corretos.
- Convite usado uma segunda vez: mostra erro de convite inválido.
- Convite expirado (ajustar `expira_em` manualmente pra testar): mostra
  erro de convite inválido.
- Revogar um convite pendente: link revogado passa a mostrar erro.
- Login de uma conta convidada pro Império Salles: seletor de local não
  mostra opção de trocar pra Depósito; chamar `trocarLocal('deposito')`
  direto (via devtools) retorna erro.
- Login de admin: continua vendo e trocando entre os dois locais
  normalmente.
- `/login` não mostra mais aba de cadastro; `/equipe` só abre pra admin
  (não-admin é redirecionado pro dashboard, igual `/configuracoes` hoje).
