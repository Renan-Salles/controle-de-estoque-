// Cria (ou remove) um usuário de teste para QA via Playwright.
// Uso: node scripts/qa-user.mjs create | delete
import { createClient } from '@supabase/supabase-js'

const URL = 'https://jqdezlvqumzdkvvcbjtl.supabase.co'
const SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxZGV6bHZxdW16ZGt2dmNianRsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjIzNDczNywiZXhwIjoyMDk3ODEwNzM3fQ.7S543f8GRiwephNfSbqOKcgS0iy8IIGKT4DRfYwYbCQ'
const EMAIL = 'qa.bot@deposito.local'
const SENHA = 'QaBot#2026!'

const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

async function findUser() {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  return data.users.find((u) => u.email === EMAIL) ?? null
}

const acao = process.argv[2]
if (acao === 'create') {
  const existente = await findUser()
  if (existente) {
    console.log('já existe:', existente.id)
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: SENHA,
      email_confirm: true,
    })
    if (error) {
      console.error('ERRO:', error.message)
      process.exit(1)
    }
    console.log('criado:', data.user.id)
  }
  console.log('EMAIL=' + EMAIL)
  console.log('SENHA=' + SENHA)
} else if (acao === 'delete') {
  const u = await findUser()
  if (u) {
    await admin.auth.admin.deleteUser(u.id)
    console.log('removido:', u.id)
  } else {
    console.log('não encontrado, nada a remover')
  }
} else {
  console.log('uso: node scripts/qa-user.mjs create | delete')
}
