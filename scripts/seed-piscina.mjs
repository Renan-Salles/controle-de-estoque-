// Popula o local "Império Salles" (bar da piscina) com catálogo, clientes e
// vendas PRÓPRIOS (preços de bar de clube, mais caros que o depósito).
// NÃO toca nos dados do Depósito. Uso: node scripts/seed-piscina.mjs
import pg from 'pg'

const ATENDENTE = '04029c48-99f4-454b-8776-4ba0c11b2f4c'
const HOJE = new Date('2026-07-01T00:00:00')
const DIAS = 30

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// Catálogo do bar da piscina: gelado, pronto pra consumo, preço de clube.
const PRODUTOS = [
  ['Heineken Lata 350ml', 'Heineken', 'Cerveja', 'unidade', 350, 9.0, 3.2, 48],
  ['Brahma Lata 350ml', 'Brahma', 'Cerveja', 'unidade', 350, 7.0, 2.8, 48],
  ['Antarctica Original 600ml', 'Antarctica', 'Cerveja', 'unidade', 600, 14.0, 5.5, 24],
  ['Coca-Cola Lata 350ml', 'Coca-Cola', 'Refrigerante', 'unidade', 350, 6.0, 2.1, 48],
  ['Guaraná Lata 350ml', 'Antarctica', 'Refrigerante', 'unidade', 350, 6.0, 1.9, 48],
  ['Água Mineral 500ml', 'Indaiá', 'Água', 'unidade', 500, 4.0, 0.8, 60],
  ['Água de Coco 500ml', 'Kero Coco', 'Outros', 'unidade', 500, 8.0, 3.5, 36],
  ['Suco Natural Laranja 300ml', 'Natural', 'Outros', 'unidade', 300, 9.0, 3.0, 24],
  ['Red Bull 250ml', 'Red Bull', 'Outros', 'unidade', 250, 15.0, 5.5, 24],
  ['Caipirinha', 'Casa', 'Destilado', 'unidade', 300, 18.0, 5.0, 10],
  ['Picolé Gelado', 'Kibon', 'Outros', 'unidade', 0, 5.0, 1.8, 40],
  ['Salgadinho', 'Elma Chips', 'Outros', 'unidade', 0, 7.0, 2.5, 30],
  ['Espetinho na Brasa', 'Casa', 'Outros', 'unidade', 0, 12.0, 4.0, 20],
  ['Porção de Batata', 'Casa', 'Outros', 'unidade', 0, 22.0, 7.0, 15],
]

const CLIENTES = [
  ['Sócio Mesa 12', 'consumidor_final', '(71) 99100-2233', 'dinheiro'],
  ['Família Andrade', 'consumidor_final', '(71) 98233-4410', 'pix'],
  ['Quiosque do Tio Beto', 'comercio', '(71) 99877-1200', 'pix'],
  ['Turma do Vôlei', 'consumidor_final', '(71) 98455-9087', 'cartao_debito'],
  ['Aniversário Salão Azul', 'consumidor_final', '(71) 99320-7766', 'cartao_credito'],
  ['Sócio Carteira 084', 'consumidor_final', '(71) 98701-3322', 'pix'],
]

const FORMAS = [
  'pix', 'pix', 'pix', 'pix', 'pix',
  'dinheiro', 'dinheiro', 'dinheiro',
  'cartao_debito', 'cartao_debito',
  'cartao_credito',
]

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function pick(arr) { return arr[rnd(0, arr.length - 1)] }
function chance(p) { return Math.random() < p }
function diaISO(off, hora) {
  const d = new Date(HOJE)
  d.setDate(d.getDate() - off)
  d.setHours(hora ?? rnd(10, 22), rnd(0, 59), rnd(0, 59), 0)
  return d
}
function dataYMD(d) { return d.toISOString().split('T')[0] }

async function main() {
  await client.connect()
  const local = (await client.query("select id from locais where slug='piscina'")).rows[0].id
  console.log('Local Império Salles:', local)

  // limpa só o que for da piscina (idempotente em re-runs)
  await client.query(`delete from movimentacoes_estoque where produto_id in (select id from produtos where local_id=$1)`, [local])
  await client.query(`delete from pedido_itens where pedido_id in (select id from pedidos where local_id=$1)`, [local])
  await client.query(`delete from contas_receber where pedido_id in (select id from pedidos where local_id=$1)`, [local])
  await client.query(`delete from pedidos where local_id=$1`, [local])
  await client.query(`delete from contas_pagar where local_id=$1`, [local])
  await client.query(`delete from estoque where produto_id in (select id from produtos where local_id=$1)`, [local])
  await client.query(`delete from clientes where local_id=$1`, [local])
  await client.query(`delete from produtos where local_id=$1`, [local])

  const cats = (await client.query('select id, nome from categorias')).rows
  const catId = (n) => cats.find((c) => c.nome === n)?.id ?? cats.find((c) => c.nome === 'Outros')?.id

  console.log('Produtos da piscina...')
  const prod = []
  for (const [nome, marca, cat, emb, vol, preco, custo, minimo] of PRODUTOS) {
    const r = await client.query(
      `insert into produtos (nome, marca, categoria_id, embalagem, volume_ml,
        preco_venda_padrao, custo_atual, estoque_minimo, ativo, local_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,true,$9) returning id`,
      [nome, marca, catId(cat), emb, vol, preco, custo, minimo, local],
    )
    prod.push({ id: r.rows[0].id, preco, custo, minimo, saldo: 0, custoMedio: 0 })
  }

  console.log('Clientes da piscina...')
  const cli = []
  for (const [nome, tipo, tel, forma] of CLIENTES) {
    const r = await client.query(
      `insert into clientes (nome, tipo, telefone, whatsapp, forma_pagamento_padrao,
        prazo_pagamento_dias, status, endereco, local_id)
       values ($1,$2,$3,$3,$4,0,'ativo','{}',$5) returning id`,
      [nome, tipo, tel, forma, local],
    )
    cli.push({ id: r.rows[0].id, forma })
  }

  async function entrada(p, qtd, custoUnit, data) {
    const novo = p.saldo + qtd
    p.custoMedio = p.saldo > 0 ? (p.saldo * p.custoMedio + qtd * custoUnit) / novo : custoUnit
    p.saldo = novo
    await client.query(
      `insert into movimentacoes_estoque (produto_id, tipo, quantidade, custo_unitario,
        saldo_apos, usuario_id, observacao, created_at)
       values ($1,'entrada_compra',$2,$3,$4,$5,'Compra de mercadoria',$6)`,
      [p.id, qtd, custoUnit, p.saldo, ATENDENTE, data.toISOString()],
    )
  }

  console.log('Estoque inicial...')
  for (const p of prod) await entrada(p, p.minimo > 0 ? p.minimo * rnd(4, 6) : rnd(40, 80), p.custo, diaISO(DIAS, 9))

  console.log('Vendas da piscina...')
  let vendas = 0, itens = 0, entradas = prod.length
  for (let off = DIAS - 1; off >= 0; off--) {
    const dow = new Date(diaISO(off, 0)).getDay()
    for (const p of prod) {
      if (p.saldo < p.minimo * 1.5 && chance(0.5)) {
        await entrada(p, (p.minimo || 40) * rnd(2, 4), +(p.custo * (0.97 + Math.random() * 0.08)).toFixed(2), diaISO(off, 9))
        entradas++
      }
    }
    // bar de clube: bem mais movimentado no fim de semana
    const n = dow === 0 || dow === 6 ? rnd(10, 18) : dow === 5 ? rnd(6, 12) : rnd(2, 6)
    for (let i = 0; i < n; i++) {
      const c = chance(0.45) ? null : pick(cli) // muita venda avulsa de balcão
      const data = diaISO(off)
      const nItens = rnd(1, 4)
      const usados = new Set()
      const lista = []
      let subtotal = 0
      for (let k = 0; k < nItens; k++) {
        const p = pick(prod)
        if (usados.has(p.id) || p.saldo <= 0) continue
        let q = pick([1, 1, 1, 2, 2, 3, 4, 6])
        if (q > p.saldo) q = p.saldo
        if (q <= 0) continue
        usados.add(p.id)
        const tot = +(q * p.preco).toFixed(2)
        lista.push({ p, q, tot })
        subtotal += tot
      }
      if (!lista.length) continue
      let forma = pick(FORMAS)
      if (c && chance(0.4)) forma = c.forma
      const total = +subtotal.toFixed(2)
      const ped = await client.query(
        `insert into pedidos (cliente_id, atendente_id, status, data_pedido, forma_pagamento,
          prazo_pagamento_dias, data_vencimento, subtotal, total, canal, created_at, local_id)
         values ($1,$2,'concluida',$3,$4,0,$5,$6,$6,'balcao',$3,$7) returning id`,
        [c?.id ?? null, ATENDENTE, data.toISOString(), forma, dataYMD(data), total, local],
      )
      const pid = ped.rows[0].id
      vendas++
      for (const it of lista) {
        await client.query(
          `insert into pedido_itens (pedido_id, produto_id, quantidade_pedida, preco_unitario, total)
           values ($1,$2,$3,$4,$5)`,
          [pid, it.p.id, it.q, it.p.preco, it.tot],
        )
        it.p.saldo -= it.q
        await client.query(
          `insert into movimentacoes_estoque (produto_id, tipo, quantidade, custo_unitario,
            saldo_apos, referencia_tipo, referencia_id, usuario_id, created_at)
           values ($1,'saida_venda',$2,$3,$4,'pedido',$5,$6,$7)`,
          [it.p.id, -it.q, +it.p.custoMedio.toFixed(2), it.p.saldo, pid, ATENDENTE, data.toISOString()],
        )
        itens++
      }
    }
  }

  console.log('Contas a pagar da piscina...')
  const pagar = [
    ['salario', 'Garçom do bar', 1600, dataYMD(diaISO(18)), 'pago', local],
    ['mercadoria', 'Reposição de bebidas geladas', 1850, dataYMD(diaISO(-4)), 'aberto', local],
    ['servicos', 'Gás de cozinha (espetinho)', 320, dataYMD(diaISO(7)), 'pago', local],
    ['manutencao', 'Conserto do freezer', 410, dataYMD(diaISO(3)), 'pago', local],
  ]
  for (const [cat, desc, val, venc, st, loc] of pagar) {
    await client.query(
      `insert into contas_pagar (categoria, descricao, valor, valor_pago, status,
        data_emissao, data_vencimento, data_pagamento, local_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cat, desc, val, st === 'pago' ? val : 0, st, venc, venc, st === 'pago' ? venc : null, loc],
    )
  }

  for (const p of prod) {
    await client.query(`update estoque set saldo_atual=$2, custo_medio=$3, updated_at=now() where produto_id=$1`,
      [p.id, p.saldo, +p.custoMedio.toFixed(4)])
  }

  console.log('\n===== PISCINA (Império Salles) =====')
  console.log(`Produtos: ${prod.length} | Clientes: ${cli.length} | Entradas: ${entradas}`)
  console.log(`Vendas: ${vendas} | Itens: ${itens} | Contas a pagar: ${pagar.length}`)
  await client.end()
}

main().catch(async (e) => { console.error('ERRO:', e.message); try { await client.end() } catch {}; process.exitCode = 1 })
