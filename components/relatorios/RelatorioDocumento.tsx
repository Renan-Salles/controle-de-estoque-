import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer'

export type ColunaPdf = {
  titulo: string
  chave: string
  alinhar?: 'esquerda' | 'direita'
}

const s = StyleSheet.create({
  page: { padding: 32, paddingBottom: 48, fontSize: 9, fontFamily: 'Helvetica', color: '#111' },
  cabecalho: { marginBottom: 16, borderBottom: '1pt solid #111', paddingBottom: 8 },
  local: { fontSize: 14, fontFamily: 'Helvetica-Bold' },
  cnpj: { fontSize: 8, color: '#555', marginTop: 2 },
  titulo: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 8 },
  subtitulo: { fontSize: 9, color: '#555', marginTop: 2 },
  thead: {
    flexDirection: 'row',
    borderBottom: '1pt solid #111',
    paddingBottom: 4,
    marginBottom: 2,
  },
  th: { fontSize: 8, fontFamily: 'Helvetica-Bold' },
  tr: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottom: '0.5pt solid #ddd',
  },
  td: { fontSize: 9 },
  rodape: {
    position: 'absolute',
    bottom: 20,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#777',
    borderTop: '0.5pt solid #ddd',
    paddingTop: 4,
  },
})

// Largura/alinhamento por coluna. A primeira coluna (nome) fica mais larga;
// as demais dividem o restante e alinham à direita quando numéricas.
function estiloCol(indice: number, total: number, alinhar?: 'esquerda' | 'direita') {
  const larguraPrimeira = 48
  const width =
    indice === 0
      ? `${larguraPrimeira}%`
      : `${(100 - larguraPrimeira) / Math.max(1, total - 1)}%`
  return {
    width,
    textAlign: (alinhar === 'direita' ? 'right' : 'left') as 'right' | 'left',
    paddingRight: 4,
  }
}

export function RelatorioDocumento({
  titulo,
  subtitulo,
  local,
  colunas,
  linhas,
  rodape,
}: {
  titulo: string
  subtitulo: string
  local: string
  colunas: ColunaPdf[]
  linhas: Array<Record<string, string>>
  rodape: string
}) {
  const n = colunas.length
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.cabecalho} fixed>
          <Text style={s.local}>{local.toUpperCase()}</Text>
          <Text style={s.cnpj}>CNPJ: 26.139.271/0001-16   DEPÓSITO DE BEBIDAS</Text>
          <Text style={s.titulo}>{titulo}</Text>
          <Text style={s.subtitulo}>{subtitulo}</Text>
        </View>

        <View style={s.thead} fixed>
          {colunas.map((c, i) => (
            <Text key={c.chave} style={[s.th, estiloCol(i, n, c.alinhar)]}>
              {c.titulo}
            </Text>
          ))}
        </View>

        {linhas.map((linha, i) => (
          <View key={i} style={s.tr} wrap={false}>
            {colunas.map((c, j) => (
              <Text key={c.chave} style={[s.td, estiloCol(j, n, c.alinhar)]}>
                {linha[c.chave] ?? ''}
              </Text>
            ))}
          </View>
        ))}

        <View style={s.rodape} fixed>
          <Text>{rodape}</Text>
          <Text
            render={({ pageNumber, totalPages }) => `Pág. ${pageNumber}/${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}
