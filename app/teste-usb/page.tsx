'use client'
import { useState, useCallback } from 'react'

// Pagina de teste isolada (spike): confirma se da pra mandar bytes ESC/POS
// pra uma impressora USB (VT-8360) direto do Chrome/Android via cabo
// USB-OTG, antes de construir a funcionalidade completa. Sem dependencia
// de Supabase/autenticacao -- e so um teste tecnico, nao uma tela do
// produto. Ver docs/superpowers/specs/2026-07-18-teste-impressao-usb-otg-design.md.

// lib.dom.d.ts nao inclui a WebUSB API (ainda experimental) -- declaracao
// minima so com o que essa pagina usa.
interface USBEndpoint {
  endpointNumber: number
  direction: 'in' | 'out'
}
interface USBAlternateInterface {
  endpoints: USBEndpoint[]
}
interface USBInterface {
  interfaceNumber: number
  alternates: USBAlternateInterface[]
}
interface USBConfiguration {
  interfaces: USBInterface[]
}
interface USBOutTransferResult {
  status: string
  bytesWritten: number
}
interface USBDevice {
  productName?: string
  vendorId: number
  productId: number
  configuration: USBConfiguration | null
  open(): Promise<void>
  selectConfiguration(configurationValue: number): Promise<void>
  claimInterface(interfaceNumber: number): Promise<void>
  transferOut(endpointNumber: number, data: Uint8Array): Promise<USBOutTransferResult>
}
interface USB {
  requestDevice(options: { filters: unknown[] }): Promise<USBDevice>
}
declare global {
  interface Navigator {
    usb: USB
  }
}

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
