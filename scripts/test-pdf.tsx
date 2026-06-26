// Verificação do pipeline de PDF: gera um relatório longo (400 linhas) para
// confirmar que o @react-pdf pagina sem cortar linha na quebra de página.
// Uso: npx tsx scripts/test-pdf.tsx
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { writeFileSync } from 'node:fs'
import { RelatorioDocumento } from '../components/relatorios/RelatorioDocumento'

const linhas = Array.from({ length: 400 }, (_, i) => ({
  data: `${(i % 28) + 1}/06/2026`,
  pedidos: String((i % 9) + 1),
  receita: `R$ ${(i * 3.5 + 10).toFixed(2)}`,
}))

const colunas = [
  { titulo: 'Data', chave: 'data' },
  { titulo: 'Pedidos', chave: 'pedidos', alinhar: 'direita' as const },
  { titulo: 'Receita', chave: 'receita', alinhar: 'direita' as const },
]

async function main() {
  const el = createElement(RelatorioDocumento, {
    titulo: 'Vendas por período',
    subtitulo: 'Período: 01/01/2026 a 31/12/2026',
    local: 'R$ DEPÓSITO',
    colunas,
    linhas,
    rodape: 'Emitido em teste',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any

  const buf = await renderToBuffer(el)
  const saida = 'C:/Users/media/Downloads/teste-relatorio.pdf'
  writeFileSync(saida, buf)
  console.log('PDF gerado:', saida)
  console.log('Bytes:', buf.length)
  // Conta ocorrências de "/Type /Page" para estimar nº de páginas.
  const txt = buf.toString('latin1')
  const paginas = (txt.match(/\/Type\s*\/Page[^s]/g) || []).length
  console.log('Páginas (estimado):', paginas)
}

main().catch((e) => {
  console.error('ERRO:', e)
  process.exit(1)
})
