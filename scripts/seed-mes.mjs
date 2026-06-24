// Seed de 1 mês de operação do R$ DEPÓSITO.
// Popula produtos, clientes, fornecedores e simula cronologicamente entradas
// (compras) e saídas (pedidos), replicando a lógica do sistema:
//  - estoque: saldo + custo médio ponderado
//  - movimentacoes_estoque: kardex (entrada_compra / saida_venda) com saldo_apos
//  - contas_receber: gerada para vendas a prazo (fiado), com pagas/abertas/vencidas
//  - contas_pagar: despesas do mês
// Uso: node scripts/seed-mes.mjs
import pg from 'pg'

const ATENDENTE = '04029c48-99f4-454b-8776-4ba0c11b2f4c' // usuário renan (auth.users)
const HOJE = new Date('2026-06-24T00:00:00')
const DIAS = 30

const client = new pg.Client({
  connectionString:
    'postgresql://postgres:Renansistemas1234@db.jqdezlvqumzdkvvcbjtl.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false },
})

// ----------------------------- catálogo -----------------------------
const PRODUTOS = [
  // Cerveja
  ['Brahma Duplo Malte 350ml', 'Brahma', 'Cerveja', 'fardo', 350, 4.5, 2.8, 48],
  ['Skol Pilsen 350ml', 'Skol', 'Cerveja', 'fardo', 350, 3.9, 2.5, 48],
  ['Heineken Long Neck 330ml', 'Heineken', 'Cerveja', 'caixa', 330, 6.9, 4.2, 24],
  ['Antarctica Original 600ml', 'Antarctica', 'Cerveja', 'caixa', 600, 8.5, 5.5, 24],
  ['Itaipava Pilsen 350ml', 'Itaipava', 'Cerveja', 'fardo', 350, 3.2, 1.9, 48],
  ['Budweiser 343ml', 'Budweiser', 'Cerveja', 'fardo', 343, 5.2, 3.1, 36],
  ['Stella Artois 275ml', 'Stella Artois', 'Cerveja', 'caixa', 275, 6.5, 3.8, 24],
  ['Amstel Lager 350ml', 'Amstel', 'Cerveja', 'fardo', 350, 4.2, 2.6, 48],
  ['Eisenbahn Pilsen 355ml', 'Eisenbahn', 'Cerveja', 'caixa', 355, 5.8, 3.4, 24],
  ['Corona Extra 330ml', 'Corona', 'Cerveja', 'caixa', 330, 7.9, 4.8, 24],
  // Refrigerante
  ['Coca-Cola 2L', 'Coca-Cola', 'Refrigerante', 'unidade', 2000, 8.9, 5.2, 24],
  ['Coca-Cola Lata 350ml', 'Coca-Cola', 'Refrigerante', 'fardo', 350, 3.5, 2.1, 48],
  ['Coca-Cola 600ml', 'Coca-Cola', 'Refrigerante', 'caixa', 600, 5.5, 3.1, 24],
  ['Guarana Antarctica 2L', 'Antarctica', 'Refrigerante', 'unidade', 2000, 7.5, 4.4, 24],
  ['Guarana Antarctica Lata 350ml', 'Antarctica', 'Refrigerante', 'fardo', 350, 3.2, 1.9, 48],
  ['Fanta Laranja 2L', 'Fanta', 'Refrigerante', 'unidade', 2000, 7.2, 4.2, 18],
  ['Sprite 2L', 'Sprite', 'Refrigerante', 'unidade', 2000, 7.2, 4.2, 18],
  // Agua
  ['Agua Mineral Indaia 500ml', 'Indaia', 'Agua', 'fardo', 500, 2.0, 0.8, 60],
  ['Agua com Gas 500ml', 'Indaia', 'Agua', 'fardo', 500, 2.5, 1.0, 36],
  ['Agua Indaia 1,5L', 'Indaia', 'Agua', 'fardo', 1500, 3.5, 1.5, 24],
  // Energetico (categoria Outros se nao houver)
  ['Red Bull Energy 250ml', 'Red Bull', 'Outros', 'caixa', 250, 9.9, 5.5, 24],
  ['Monster Energy 473ml', 'Monster', 'Outros', 'caixa', 473, 11.5, 6.2, 18],
  ['TNT Energy 269ml', 'TNT', 'Outros', 'caixa', 269, 6.5, 3.2, 24],
  // Destilado
  ['Cachaca 51 965ml', '51', 'Destilado', 'unidade', 965, 13.9, 7.5, 12],
  ['Vodka Smirnoff 998ml', 'Smirnoff', 'Destilado', 'unidade', 998, 35.9, 22.0, 12],
  ['Whisky Red Label 1L', 'Johnnie Walker', 'Destilado', 'unidade', 1000, 99.9, 65.0, 6],
  ['Catuaba Selvagem 1L', 'Selvagem', 'Destilado', 'unidade', 1000, 12.5, 6.5, 12],
  // Outros
  ['Gelo de Coco 5kg', 'Polar', 'Outros', 'unidade', 5000, 8.0, 4.0, 30],
  ['Carvao Vegetal 3kg', 'Bruxa', 'Outros', 'unidade', 3000, 16.0, 9.0, 12],
]

const CLIENTES = [
  ['Bar do Tiao', 'bar', '(71) 98821-4455', 'fiado', 7],
  ['Mercadinho Santa Rita', 'comercio', '(71) 99634-2018', 'pix', 0],
  ["Distribuidora Olho d'Agua", 'revendedor', '(75) 99812-4087', 'fiado', 15],
  ['Boteco da Esquina', 'bar', '(71) 98155-7723', 'fiado', 7],
  ['Adega Central', 'comercio', '(71) 99201-6644', 'dinheiro', 0],
  ['Bar e Petiscaria do Nego', 'bar', '(71) 98477-1290', 'fiado', 7],
  ['Lanchonete Sabor e Cia', 'comercio', '(71) 99388-5512', 'pix', 0],
  ['Conveniencia 24h Parada', 'comercio', '(71) 98712-9931', 'dinheiro', 0],
  ['Espetinho do Carlao', 'bar', '(71) 99055-3377', 'fiado', 7],
  ['Mercearia Dona Lucia', 'comercio', '(71) 98260-4419', 'pix', 0],
  ['Bar do Portugues', 'bar', '(71) 99744-8800', 'fiado', 15],
  ['Festas e Eventos Premium', 'revendedor', '(71) 98933-1267', 'fiado', 30],
]

const FORNECEDORES = [
  ['Ambev Distribuidora BA', 'Companhia de Bebidas das Americas', '02.808.708/0001-07', 'Cervejas e guarana', 'Marcos Vinicius'],
  ['Coca-Cola FEMSA Bahia', 'Spal Industria Brasileira de Bebidas', '61.186.888/0001-30', 'Refrigerantes', 'Patricia Lemos'],
  ['Aguas Indaia Nordeste', 'Indaia Brasil Aguas Minerais', '08.911.232/0001-44', 'Agua mineral', 'Joao Andrade'],
  ['Distribuidora Sertaneja', 'Sertaneja Comercio de Bebidas Ltda', '12.345.678/0001-90', 'Destilados e diversos', 'Cleonice Souza'],
  ['Red Bull do Brasil', 'Red Bull Brasil Ltda', '03.951.467/0001-09', 'Energeticos', 'Rafael Tavares'],
]

// ----------------------------- utilidades -----------------------------
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function pick(arr) { return arr[rnd(0, arr.length - 1)] }
function chance(p) { return Math.random() < p }
function diaISO(offsetDias, hora) {
  const d = new Date(HOJE)
  d.setDate(d.getDate() - offsetDias)
  d.setHours(hora ?? rnd(8, 21), rnd(0, 59), rnd(0, 59), 0)
  return d
}
function dataYMD(d) { return d.toISOString().split('T')[0] }

// quantidade típica de venda por embalagem
function qtdVenda(embalagem) {
  switch (embalagem) {
    case 'fardo': return pick([12, 12, 24, 24, 48])
    case 'caixa': return pick([6, 12, 12, 24])
    case 'unidade': return pick([1, 2, 3, 6, 6, 12])
    default: return pick([6, 12, 24])
  }
}

async function main() {
  await client.connect()
  console.log('Conectado. Limpando dados transacionais...')

  await client.query(`
    truncate table movimentacoes_estoque, pedido_itens, pedidos,
      contas_receber, contas_pagar, alertas, estoque restart identity cascade;
  `)
  await client.query('delete from produtos')
  await client.query('delete from clientes')
  await client.query('delete from fornecedores')

  // categorias (já existem via migration 002)
  const cats = (await client.query('select id, nome from categorias')).rows
  const catId = (nome) => cats.find((c) => c.nome === nome)?.id

  // ----- produtos (o trigger cria estoque saldo 0) -----
  console.log('Inserindo produtos...')
  const prod = [] // { id, preco, custo, minimo, embalagem }
  for (const [nome, marca, cat, emb, vol, preco, custo, minimo] of PRODUTOS) {
    const r = await client.query(
      `insert into produtos (nome, marca, categoria_id, embalagem, volume_ml,
        preco_venda_padrao, custo_atual, estoque_minimo, ativo)
       values ($1,$2,$3,$4,$5,$6,$7,$8,true) returning id`,
      [nome, marca, catId(cat) ?? catId('Outros'), emb, vol, preco, custo, minimo],
    )
    prod.push({ id: r.rows[0].id, nome, preco, custo, minimo, embalagem: emb,
      saldo: 0, custoMedio: 0 })
  }

  // ----- clientes -----
  console.log('Inserindo clientes...')
  const cli = []
  for (const [nome, tipo, tel, forma, prazo] of CLIENTES) {
    const r = await client.query(
      `insert into clientes (nome, tipo, telefone, whatsapp, forma_pagamento_padrao,
        prazo_pagamento_dias, status, endereco)
       values ($1,$2,$3,$3,$4,$5,'ativo','{}') returning id`,
      [nome, tipo, tel, forma, prazo],
    )
    cli.push({ id: r.rows[0].id, nome, forma, prazo })
  }

  // ----- fornecedores -----
  console.log('Inserindo fornecedores...')
  for (const [nome, razao, cnpj, fornece, contato] of FORNECEDORES) {
    await client.query(
      `insert into fornecedores (nome, razao_social, cnpj, produtos_fornecidos,
        contato_nome, status, endereco) values ($1,$2,$3,$4,$5,'ativo','{}')`,
      [nome, razao, cnpj, fornece, contato],
    )
  }

  // helpers de movimentação que mantêm saldo + custo médio
  async function entrada(p, qtd, custoUnit, data) {
    const novoSaldo = p.saldo + qtd
    p.custoMedio = p.saldo > 0
      ? (p.saldo * p.custoMedio + qtd * custoUnit) / novoSaldo
      : custoUnit
    p.saldo = novoSaldo
    await client.query(
      `insert into movimentacoes_estoque (produto_id, tipo, quantidade, custo_unitario,
        saldo_apos, usuario_id, observacao, created_at)
       values ($1,'entrada_compra',$2,$3,$4,$5,'Compra de mercadoria',$6)`,
      [p.id, qtd, custoUnit, p.saldo, ATENDENTE, data.toISOString()],
    )
  }

  // ----- estoque inicial (compra grande no começo do período) -----
  console.log('Compra inicial de estoque...')
  const d0 = diaISO(DIAS, 8)
  for (const p of prod) {
    await entrada(p, p.minimo * rnd(4, 6), p.custo, d0)
  }

  // ----- simulação cronológica do mês -----
  console.log('Simulando vendas e reposições do mês...')
  let totalPedidos = 0, totalItens = 0, totalReceber = 0, totalEntradas = prod.length

  for (let off = DIAS - 1; off >= 0; off--) {
    const base = diaISO(off, 0)
    const dow = base.getDay() // 0=dom ... 6=sab

    // reposições do dia (produtos abaixo de 1.5x mínimo, exceto alguns que deixaremos furar)
    for (const p of prod) {
      if (p.saldo < p.minimo * 1.5 && chance(0.6)) {
        const custoVar = +(p.custo * (0.97 + Math.random() * 0.08)).toFixed(2)
        await entrada(p, p.minimo * rnd(3, 5), custoVar, diaISO(off, 9))
        totalEntradas++
      }
    }

    // nº de pedidos: mais no fim de semana (qui-sab)
    const nPedidos = dow >= 4 || dow === 0 ? rnd(8, 14) : rnd(4, 9)
    for (let i = 0; i < nPedidos; i++) {
      const c = pick(cli)
      const dataPed = diaISO(off)
      // monta itens
      const nItens = rnd(2, 5)
      const escolhidos = new Set()
      const itens = []
      let subtotal = 0
      for (let k = 0; k < nItens; k++) {
        const p = pick(prod)
        if (escolhidos.has(p.id)) continue
        let q = qtdVenda(p.embalagem)
        if (p.saldo <= 0) continue
        if (q > p.saldo) q = p.saldo
        if (q <= 0) continue
        escolhidos.add(p.id)
        const totalItem = +(q * p.preco).toFixed(2)
        itens.push({ p, q, preco: p.preco, totalItem })
        subtotal += totalItem
      }
      if (!itens.length) continue

      // forma de pagamento (com leve variação sobre o padrão do cliente)
      let forma = c.forma
      if (forma === 'fiado' && chance(0.25)) forma = pick(['dinheiro', 'pix'])
      if (forma !== 'fiado' && chance(0.1)) forma = 'fiado'
      const prazo = forma === 'fiado' ? (c.prazo || 7) : 0
      const venc = new Date(dataPed); venc.setDate(venc.getDate() + prazo)

      // status: recentes podem estar em andamento; resto entregue
      let status = 'entregue'
      if (off <= 1) status = pick(['confirmado', 'em_separacao', 'saiu_entrega', 'entregue'])
      const total = +subtotal.toFixed(2)

      const ped = await client.query(
        `insert into pedidos (cliente_id, atendente_id, status, data_pedido,
          forma_pagamento, prazo_pagamento_dias, data_vencimento, subtotal, total,
          canal, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$4) returning id, numero_pedido`,
        [c.id, ATENDENTE, status, dataPed.toISOString(), forma, prazo,
          dataYMD(venc), total, pick(['telefone', 'whatsapp', 'balcao'])],
      )
      const pedidoId = ped.rows[0].id
      totalPedidos++

      for (const it of itens) {
        await client.query(
          `insert into pedido_itens (pedido_id, produto_id, quantidade_pedida,
            preco_unitario, total) values ($1,$2,$3,$4,$5)`,
          [pedidoId, it.p.id, it.q, it.preco, it.totalItem],
        )
        it.p.saldo -= it.q
        await client.query(
          `insert into movimentacoes_estoque (produto_id, tipo, quantidade,
            custo_unitario, saldo_apos, referencia_tipo, referencia_id, usuario_id, created_at)
           values ($1,'saida_venda',$2,$3,$4,'pedido',$5,$6,$7)`,
          [it.p.id, -it.q, +it.p.custoMedio.toFixed(2), it.p.saldo, pedidoId,
            ATENDENTE, dataPed.toISOString()],
        )
        totalItens++
      }

      // conta a receber para vendas a prazo
      if (forma === 'fiado') {
        const vencido = venc < HOJE
        let valorPago = 0, st = 'aberto', dataPag = null
        if (vencido) {
          // metade dos vencidos foram pagos; outros viram inadimplência
          if (chance(0.55)) { valorPago = total; st = 'pago'; dataPag = dataYMD(venc) }
          else st = 'vencido'
        } else if (chance(0.2)) {
          // alguns a vencer já pagaram parcial
          valorPago = +(total * 0.5).toFixed(2); st = 'parcial'
        }
        await client.query(
          `insert into contas_receber (pedido_id, cliente_id, descricao, valor,
            valor_pago, status, data_emissao, data_vencimento, data_pagamento, forma_pagamento)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [pedidoId, c.id, `Pedido #${ped.rows[0].numero_pedido}`, total, valorPago,
            st, dataYMD(dataPed), dataYMD(venc), dataPag, st === 'pago' ? 'pix' : null],
        )
        totalReceber++
      }
    }
  }

  // ----- contas a pagar do mês -----
  console.log('Inserindo contas a pagar...')
  const pagar = [
    ['aluguel', 'Aluguel do galpao', 2800, dataYMD(diaISO(14)), 'pago'],
    ['salario', 'Salario - ajudante de deposito', 1800, dataYMD(diaISO(19)), 'pago'],
    ['servicos', 'Energia eletrica', 740.55, dataYMD(diaISO(9)), 'pago'],
    ['servicos', 'Agua e esgoto', 218.3, dataYMD(diaISO(9)), 'pago'],
    ['combustivel', 'Combustivel - entregas', 612.0, dataYMD(diaISO(6)), 'pago'],
    ['mercadoria', 'Ambev - reposicao cervejas', 4380.0, dataYMD(diaISO(-3)), 'aberto'],
    ['mercadoria', 'Coca-Cola FEMSA - refrigerantes', 1920.5, dataYMD(diaISO(-6)), 'aberto'],
    ['impostos', 'Simples Nacional', 1340.0, dataYMD(diaISO(-9)), 'aberto'],
    ['manutencao', 'Conserto da camara fria', 480.0, dataYMD(diaISO(2)), 'pago'],
  ]
  for (const [categoria, descricao, valor, venc, st] of pagar) {
    await client.query(
      `insert into contas_pagar (categoria, descricao, valor, valor_pago, status,
        data_emissao, data_vencimento, data_pagamento)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [categoria, descricao, valor, st === 'pago' ? valor : 0, st,
        venc, venc, st === 'pago' ? venc : null],
    )
  }

  // ----- grava saldo/custo final no estoque -----
  console.log('Atualizando posicao de estoque...')
  for (const p of prod) {
    await client.query(
      `update estoque set saldo_atual=$2, custo_medio=$3, updated_at=now() where produto_id=$1`,
      [p.id, p.saldo, +p.custoMedio.toFixed(4)],
    )
  }

  // resumo
  const criticos = prod.filter((p) => p.saldo <= p.minimo).length
  const rupturas = prod.filter((p) => p.saldo <= 0).length
  console.log('\n===== SEED CONCLUIDO =====')
  console.log(`Produtos:        ${prod.length}`)
  console.log(`Clientes:        ${cli.length}`)
  console.log(`Fornecedores:    ${FORNECEDORES.length}`)
  console.log(`Entradas:        ${totalEntradas}`)
  console.log(`Pedidos:         ${totalPedidos}`)
  console.log(`Itens vendidos:  ${totalItens}`)
  console.log(`Contas a receber:${totalReceber}`)
  console.log(`Contas a pagar:  ${pagar.length}`)
  console.log(`Estoque critico: ${criticos} | ruptura: ${rupturas}`)

  await client.end()
}

main().catch(async (e) => {
  console.error('ERRO:', e.message)
  try { await client.end() } catch {}
  process.exitCode = 1
})
