// Produtos de teste com embalagens variadas (caixa/fardo/pack/unidade) pro
// usuario testar ao vivo a entrada de estoque com conversao de caixa e o
// cadastro rapido de produto. Estoque comeca em 0 de proposito (pra testar
// a entrada do zero). Uso: node scripts/seed-teste-embalagens.mjs
import pg from 'pg'

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// [nome, marca, categoria, embalagem, fator_conversao, preco_venda, custo, estoque_minimo]
const PRODUTOS = [
  ['Petra Pilsen 350ml', 'Petra', 'Cerveja', 'caixa', 24, 6.0, 3.2, 24],
  ['Skol Beats Senses 269ml', 'Skol', 'Cerveja', 'fardo', 12, 7.0, 3.8, 12],
  ['Heineken 0.0 Lata 350ml', 'Heineken', 'Cerveja', 'caixa', 24, 9.0, 4.5, 24],
  ['Sprite Lata 350ml', 'Sprite', 'Refrigerante', 'pack', 6, 6.0, 2.3, 12],
  ['Schweppes Tônica 350ml', 'Schweppes', 'Refrigerante', 'fardo', 12, 7.0, 3.0, 12],
  ['Smirnoff Ice 275ml', 'Smirnoff', 'Destilado', 'pack', 6, 12.0, 5.5, 6],
  ['Vinho Pergola Tinto 750ml', 'Pergola', 'Vinho', 'caixa', 6, 35.0, 18.0, 6],
  ['Gelo em Cubo 2kg', 'Polar', 'Outros', 'unidade', 1, 10.0, 4.0, 10],
]

function prefixoCategoria(nome) {
  const limpo = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z]/g, '')
  return (limpo.slice(0, 3) || 'PRD').toUpperCase().padEnd(3, 'X')
}

async function main() {
  await client.connect()
  const local = (await client.query("select id from locais where slug='piscina'")).rows[0].id
  console.log('Local Império Salles:', local)

  const cats = (await client.query('select id, nome from categorias')).rows
  const catId = (nome) => cats.find((c) => c.nome === nome)?.id

  let criados = 0
  for (const [nome, marca, catNome, embalagem, fator, preco, custo, minimo] of PRODUTOS) {
    const categoriaId = catId(catNome)
    if (!categoriaId) { console.log('categoria nao encontrada:', catNome); continue }

    const prefixo = prefixoCategoria(catNome)
    const existentes = await client.query(
      `select codigo_barras from produtos where categoria_id=$1 and local_id=$2 and codigo_barras like $3`,
      [categoriaId, local, `${prefixo}-%`],
    )
    let maior = 0
    for (const row of existentes.rows) {
      const m = row.codigo_barras?.match(/-(\d+)$/)
      if (m) maior = Math.max(maior, parseInt(m[1], 10))
    }
    const codigo = `${prefixo}-${String(maior + 1).padStart(4, '0')}`

    await client.query(
      `insert into produtos (nome, marca, categoria_id, embalagem, fator_conversao,
        preco_venda_padrao, custo_atual, estoque_minimo, ativo, local_id, codigo_barras)
       values ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10)`,
      [nome, marca, categoriaId, embalagem, fator, preco, custo, minimo, local, codigo],
    )
    console.log(`+ ${nome} — ${codigo} (${embalagem} de ${fator})`)
    criados++
  }

  console.log(`\n${criados} produtos de teste criados, estoque zerado (pra testar a entrada).`)
  await client.end()
}

main().catch(async (e) => {
  console.error('ERRO:', e.message)
  try { await client.end() } catch {}
  process.exitCode = 1
})
