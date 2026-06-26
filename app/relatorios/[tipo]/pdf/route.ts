import { createElement } from 'react'
import { NextRequest } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { RelatorioDocumento, type ColunaPdf } from '@/components/relatorios/RelatorioDocumento'
import {
  relatorioVendasPeriodo,
  relatorioVendasProduto,
  relatorioVendasCliente,
} from '@/lib/actions/relatorios'
import { getLocalAtivo } from '@/lib/local'
import { formatarReal } from '@/lib/formatos'

export const runtime = 'nodejs'

// Converte 'YYYY-MM-DD' em 'DD/MM/YYYY' para exibição.
function br(data: string) {
  const [a, m, d] = data.split('-')
  return `${d}/${m}/${a}`
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ tipo: string }> },
) {
  const { tipo } = await ctx.params
  const sp = req.nextUrl.searchParams
  const ini = sp.get('ini') ?? ''
  const fim = sp.get('fim') ?? ''
  if (!ini || !fim) return new Response('Período obrigatório', { status: 400 })

  const local = await getLocalAtivo()
  const subtitulo = `Período: ${br(ini)} a ${br(fim)}`
  const rodape = `Emitido em ${new Date().toLocaleDateString('pt-BR')}`

  let titulo = ''
  let colunas: ColunaPdf[] = []
  let linhas: Array<Record<string, string>> = []

  if (tipo === 'periodo') {
    const r = await relatorioVendasPeriodo({ ini, fim })
    titulo = 'Vendas por período'
    colunas = [
      { titulo: 'Data', chave: 'data' },
      { titulo: 'Pedidos', chave: 'pedidos', alinhar: 'direita' },
      { titulo: 'Receita', chave: 'receita', alinhar: 'direita' },
    ]
    linhas = r.dias.map((d) => ({
      data: br(d.data),
      pedidos: String(d.pedidos),
      receita: formatarReal(d.receita),
    }))
    linhas.push({
      data: 'TOTAL',
      pedidos: String(r.totalPedidos),
      receita: formatarReal(r.totalReceita),
    })
  } else if (tipo === 'produto') {
    const r = await relatorioVendasProduto({ ini, fim })
    titulo = 'Vendas por produto'
    colunas = [
      { titulo: 'Produto', chave: 'nome' },
      { titulo: 'Unidades', chave: 'unidades', alinhar: 'direita' },
      { titulo: 'Faturamento', chave: 'faturamento', alinhar: 'direita' },
    ]
    linhas = r.map((p) => ({
      nome: p.nome,
      unidades: String(p.unidades),
      faturamento: formatarReal(p.faturamento),
    }))
  } else if (tipo === 'cliente') {
    const r = await relatorioVendasCliente({ ini, fim })
    titulo = 'Vendas por cliente'
    colunas = [
      { titulo: 'Cliente', chave: 'nome' },
      { titulo: 'Pedidos', chave: 'pedidos', alinhar: 'direita' },
      { titulo: 'Total', chave: 'total', alinhar: 'direita' },
    ]
    linhas = r.map((c) => ({
      nome: c.nome,
      pedidos: String(c.pedidos),
      total: formatarReal(c.total),
    }))
  } else {
    return new Response('Relatório inválido', { status: 404 })
  }

  // @react-pdf tipa renderToBuffer como ReactElement<DocumentProps>; nosso
  // componente envolve <Document>, então o cast para o parâmetro esperado.
  const elemento = createElement(RelatorioDocumento, {
    titulo,
    subtitulo,
    local: local.nome,
    colunas,
    linhas,
    rodape,
  }) as Parameters<typeof renderToBuffer>[0]

  const buffer = await renderToBuffer(elemento)

  return new Response(buffer as BufferSource, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="relatorio-${tipo}-${ini}-a-${fim}.pdf"`,
    },
  })
}
