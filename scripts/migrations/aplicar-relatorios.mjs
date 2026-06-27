// Aplica supabase/migrations/2026-06-26-relatorios.sql no banco do R$ DEPÓSITO.
// Conexão direta (mesmo padrão dos seeds). Uso: node scripts/migrations/aplicar-relatorios.mjs
import pg from 'pg'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sqlPath = join(__dirname, '..', '..', 'supabase', 'migrations', '2026-06-26-relatorios.sql')
const sql = readFileSync(sqlPath, 'utf8')

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const LOCAL_DEPOSITO = 'af1b8927-7235-4e25-9473-9691005388b6'

async function main() {
  await client.connect()
  console.log('Conectado. Aplicando migration...')
  await client.query(sql)
  console.log('Migration aplicada (índices + funções).')

  // Verificação: roda as duas funções num período largo e mostra as 5 primeiras linhas.
  const prod = await client.query(
    'select * from vendas_por_produto($1, $2, $3) limit 5',
    [LOCAL_DEPOSITO, '2026-01-01', '2026-12-31'],
  )
  console.log(`\nvendas_por_produto: ${prod.rowCount} linhas (top 5):`)
  console.table(prod.rows)

  const cli = await client.query(
    'select * from vendas_por_cliente($1, $2, $3) limit 5',
    [LOCAL_DEPOSITO, '2026-01-01', '2026-12-31'],
  )
  console.log(`\nvendas_por_cliente: ${cli.rowCount} linhas (top 5):`)
  console.table(cli.rows)

  await client.end()
  console.log('\nOK.')
}

main().catch((e) => {
  console.error('ERRO:', e.message)
  process.exit(1)
})
