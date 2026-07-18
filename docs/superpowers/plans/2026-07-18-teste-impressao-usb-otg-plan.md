# Teste de impressão via USB-OTG (spike) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir uma página mínima e isolada que testa, via WebUSB, se o
Chrome/Android consegue mandar bytes ESC/POS pra VT-8360 por cabo USB-OTG.

**Architecture:** Uma única rota Next.js fora do grupo `(app)` (sem
sidebar/autenticação), 100% client-side, sem chamadas a Supabase. Dois
botões (Conectar/Imprimir teste) + log em tela.

**Tech Stack:** WebUSB API nativa do navegador (`navigator.usb`), React 19,
TypeScript. Nenhuma lib nova.

## Global Constraints

- Português correto, com acentos.
- Essa página é temporária — vai ser apagada depois do teste físico,
  independente do resultado (Task 2 deste plano cobre isso, mas só deve
  ser executada depois que o usuário confirmar o resultado do teste).
- `npx tsc --noEmit`, `npx eslint <arquivo> --quiet`, `npx next build`
  antes de cada commit.

---

### Task 1: Página de teste `/teste-usb`

**Files:**
- Create: `app/teste-usb/page.tsx`

**Interfaces:**
- Produces: rota `/teste-usb`, sem dependências de outras partes do app.

- [ ] **Step 1: Criar a página**

```tsx
'use client'
import { useState, useCallback } from 'react'

// Pagina de teste isolada (spike): confirma se da pra mandar bytes ESC/POS
// pra uma impressora USB (VT-8360) direto do Chrome/Android via cabo
// USB-OTG, antes de construir a funcionalidade completa. Sem dependencia
// de Supabase/autenticacao -- e so um teste tecnico, nao uma tela do
// produto. Ver docs/superpowers/specs/2026-07-18-teste-impressao-usb-otg-design.md.

const ESC = 0x1b

function montarComandoTeste(): Uint8Array {
  const init = [ESC, 0x40] // ESC @ -- inicializa a impressora
  const texto = Array.from(new TextEncoder().encode('Teste DepSys - USB-OTG\n\n\n'))
  return new Uint8Array([...init, ...texto])
}

export default function TesteUsbPage() {
  const [log, setLog] = useState<string[]>([])
  const [device, setDevice] = useState<USBDevice | null>(null)
  const [endpointOut, setEndpointOut] = useState<number | null>(null)

  const logar = useCallback((msg: string) => {
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString('pt-BR')} — ${msg}`])
  }, [])

  async function conectar() {
    if (!('usb' in navigator)) {
      logar('ERRO: navigator.usb não existe (navegador não suporta WebUSB).')
      return
    }
    try {
      logar('Pedindo dispositivo USB...')
      const dev = await navigator.usb.requestDevice({ filters: [] })
      logar(`Dispositivo escolhido: ${dev.productName ?? '(sem nome)'} — vendorId=${dev.vendorId} productId=${dev.productId}`)

      await dev.open()
      logar('device.open() OK')

      if (dev.configuration === null) {
        await dev.selectConfiguration(1)
        logar('selectConfiguration(1) OK')
      }

      const iface = dev.configuration?.interfaces[0]
      if (!iface) {
        logar('ERRO: nenhuma interface USB encontrada.')
        return
      }
      await dev.claimInterface(iface.interfaceNumber)
      logar(`claimInterface(${iface.interfaceNumber}) OK`)

      const alternate = iface.alternates[0]
      const outEndpoint = alternate.endpoints.find((e) => e.direction === 'out')
      if (!outEndpoint) {
        logar('ERRO: nenhum endpoint de saída (bulk OUT) encontrado.')
        return
      }

      setDevice(dev)
      setEndpointOut(outEndpoint.endpointNumber)
      logar(`Endpoint de saída encontrado: ${outEndpoint.endpointNumber}. Pronto pra imprimir.`)
    } catch (e) {
      logar(`ERRO ao conectar: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function imprimirTeste() {
    if (!device || endpointOut === null) {
      logar('ERRO: conecte primeiro.')
      return
    }
    try {
      const comando = montarComandoTeste()
      const resultado = await device.transferOut(endpointOut, comando)
      logar(`transferOut OK — status=${resultado.status}, bytesWritten=${resultado.bytesWritten}`)
    } catch (e) {
      logar(`ERRO ao imprimir: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'monospace', maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ fontSize: 18, fontWeight: 700 }}>Teste USB-OTG</h1>
      <p style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
        Spike de validação — não é uma tela do produto.
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button
          onClick={conectar}
          style={{ padding: '10px 16px', background: '#0f766e', color: '#fff', borderRadius: 8, border: 'none' }}
        >
          Conectar
        </button>
        <button
          onClick={imprimirTeste}
          disabled={!device}
          style={{ padding: '10px 16px', background: device ? '#0f766e' : '#ccc', color: '#fff', borderRadius: 8, border: 'none' }}
        >
          Imprimir teste
        </button>
      </div>
      <pre
        style={{
          marginTop: 16,
          background: '#111',
          color: '#0f0',
          padding: 12,
          borderRadius: 8,
          fontSize: 12,
          minHeight: 200,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {log.length === 0 ? 'Nenhum log ainda. Clique em Conectar.' : log.join('\n')}
      </pre>
    </div>
  )
}
```

Nota de tipos: `USBDevice`/`navigator.usb` fazem parte dos tipos DOM do
TypeScript a partir do `lib.dom.d.ts` moderno (Next 16 já inclui). Se o
`tsc` reclamar de `navigator.usb` não existir no tipo `Navigator`, adicionar
localmente no topo do arquivo:

```ts
declare global {
  interface Navigator {
    usb: USB
  }
}
```

(só adicionar esse bloco se o Step 2 abaixo mostrar esse erro especificamente).

- [ ] **Step 2: Verificar**

```bash
npx tsc --noEmit
npx eslint app/teste-usb/page.tsx --quiet
npx next build
```

Expected: sem erros. (Não dá pra testar a funcionalidade em si por aqui —
WebUSB precisa de hardware real, ver Task 2.)

- [ ] **Step 3: Commit e push**

```bash
git add app/teste-usb/page.tsx
git commit -m "test: pagina de spike pra validar impressao USB-OTG (WebUSB) na VT-8360"
git push
```

Precisa estar em produção (Vercel) pra ser acessível via HTTPS no celular.

---

### Task 2: Teste físico e decisão (feita pelo usuário, não por mim)

- [ ] **Step 1: Testar no celular**

Abrir `https://<domínio-do-vercel>/teste-usb` no Chrome do celular Android,
com a VT-8360 ligada na tomada e conectada ao celular por cabo USB-OTG.
Clicar "Conectar", depois "Imprimir teste". Copiar o texto que aparece no
log e trazer de volta pra essa conversa (funcionou e saiu papel, ou deu
erro — qual erro).

- [ ] **Step 2: Apagar a página de teste**

Independente do resultado, depois de reportado:

```bash
git rm app/teste-usb/page.tsx
git commit -m "chore: remove pagina de teste de impressao USB-OTG (spike concluido)"
git push
```

- [ ] **Step 3: Próximo passo conforme o resultado**

- Se funcionou: nova spec/plano pra a funcionalidade completa (cupom
  formatado em ESC/POS, botão "Imprimir" na tela da venda, lembrar
  dispositivo pareado).
- Se não funcionou: conversar sobre comprar uma impressora térmica com
  Bluetooth de verdade, e refazer o desenho em cima dela.
