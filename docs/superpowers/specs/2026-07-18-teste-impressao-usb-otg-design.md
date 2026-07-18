# Teste de impressão via USB-OTG (spike de validação) — Design

**Data:** 2026-07-18
**Contexto:** Cliente pediu pra imprimir o cupom da venda direto do celular,
"conectando na maquininha". Depois de esclarecer, ficou definido que:

- "Maquininha" não é a máquina de cartão — é a impressora térmica que o
  Renan já usa (VT-8360, ver `2026-07-16-cupom-fiscal-impressora-termica-design.md`
  e o `project_depsys` da memória).
- A VT-8360 **não tem Bluetooth nem é portátil** (confirmado pela ficha
  técnica do produto: `Com Bluetooth: Não`, `É portátil: Não`) — só tem
  entrada USB. Então "sem fio" está fora de cogitação com esse aparelho.
- A alternativa possível é ligar o celular Android na VT-8360 por cabo
  USB-OTG e mandar a impressão direto do navegador via **WebUSB API**.
  Só funciona em Chrome/Android (WebUSB não existe em iOS/Safari) — decisão
  já tomada: só Android por enquanto, iPhone fica de fora dessa frente.
- Risco real e conhecido: dispositivos USB de classe "impressora" costumam
  ser reconhecidos pelo próprio Android antes que o navegador consiga
  reivindicar a interface pra si. Se isso acontecer, WebUSB não funciona
  nessa impressora e não tem contorno por código — teria que trocar de
  impressora (uma com Bluetooth de verdade).

Por isso, antes de desenhar/construir a funcionalidade completa (renderizar
o cupom em ESC/POS, botão de imprimir na tela da venda, lembrar o
pareamento etc.), este documento cobre **só o spike de validação**: uma
página mínima pra confirmar, na prática, com o celular e o cabo OTG de
verdade, se dá pra mandar bytes pra VT-8360 pelo navegador. Se não der, a
próxima conversa é sobre comprar uma impressora com Bluetooth de verdade,
não acrescentar mais código aqui.

## 1. Onde fica

Uma rota nova e isolada, fora do grupo `(app)` (não passa pelo layout com
sidebar/autenticação — é só um teste técnico, não uma tela do produto):
`app/teste-usb/page.tsx`. Sem chamada a Supabase, sem `getLocalAtivoId()`,
sem nada do domínio do negócio.

Acessível direto pela URL de produção no celular (ex.:
`https://<domínio-do-vercel>/teste-usb`), já que WebUSB exige contexto
seguro (https) e o app já está no ar com HTTPS.

## 2. O que a página faz

Dois botões e uma área de log (texto simples, cresce pra baixo, sem
depender de DevTools pra depurar no celular):

1. **"Conectar"**: chama `navigator.usb.requestDevice({ filters: [] })`
   (sem filtro — deixa o Chrome listar qualquer USB disponível, já que não
   sabemos de antemão o vendorId/productId da VT-8360). Depois de
   escolhido, chama `device.open()`, seleciona a configuração
   (`selectConfiguration(1)`), reivindica a interface
   (`claimInterface(...)`) e localiza o endpoint de saída (bulk OUT,
   `direction === 'out'`). Loga cada etapa e qualquer erro (`NotFoundError`,
   `SecurityError`, `NetworkError` — esse último é o sintoma exato de "o
   Android já pegou o dispositivo pra si").
2. **"Imprimir teste"** (só habilitado depois de conectar): monta um
   buffer ESC/POS mínimo —
   `ESC @` (inicializa) + texto `"Teste DepSys - USB-OTG\n\n\n"` em ASCII —
   e manda via `device.transferOut(endpointNumber, buffer)`. Loga sucesso
   (bytes enviados) ou erro.

```ts
const ESC = 0x1b
function montarComandoTeste(): Uint8Array {
  const init = [ESC, 0x40] // ESC @
  const texto = Array.from(new TextEncoder().encode('Teste DepSys - USB-OTG\n\n\n'))
  return new Uint8Array([...init, ...texto])
}
```

## 3. Critério de sucesso

- **Passou**: a VT-8360 imprime fisicamente o texto de teste depois de
  clicar nos dois botões, sem erro no log.
- **Falhou**: qualquer erro no log (principalmente `NetworkError` ao abrir
  ou reivindicar a interface) ou nada sai no papel. Nesse caso, a conclusão
  é "essa impressora não dá pra usar assim" — não adianta tentar contornar
  por código, o próximo passo é avaliar comprar uma impressora com
  Bluetooth.

## 4. Depois do teste

Independente do resultado, essa página (`app/teste-usb/page.tsx`) é
**apagada** depois de validado — não é a feature final, só o teste. Se
passou, a funcionalidade completa (renderizar o cupom formatado em
ESC/POS, botão "Imprimir" na tela da venda, lembrar o dispositivo pareado)
vira uma spec própria depois.
