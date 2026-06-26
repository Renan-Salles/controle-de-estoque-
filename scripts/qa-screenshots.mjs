// QA visual: loga, percorre as telas em desktop e mobile, salva screenshots.
// Uso: node scripts/qa-screenshots.mjs
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = 'http://127.0.0.1:3000'
const EMAIL = 'qa.bot@deposito.local'
const SENHA = 'QaBot#2026!'
const OUT = 'C:/Users/media/AppData/Local/Temp/claude/C--Users-media/7cf7fb52-3cbd-4ed0-9b02-95c343fde343/scratchpad/qa'

mkdirSync(OUT, { recursive: true })

// Telas a capturar (rota + nome do arquivo).
const TELAS = [
  ['/dashboard', 'dashboard'],
  ['/movimentacoes', 'movimentacoes'],
  ['/movimentacoes/nova', 'movimentacao-nova'],
  ['/produtos', 'produtos'],
  ['/clientes', 'clientes'],
  ['/estoque', 'estoque'],
  ['/estoque/reposicao', 'estoque-reposicao'],
  ['/fornecedores', 'fornecedores'],
  ['/relatorios', 'relatorios-periodo'],
  ['/relatorios/produto', 'relatorios-produto'],
  ['/relatorios/cliente', 'relatorios-cliente'],
  ['/financeiro/resultado', 'financeiro-resultado'],
  ['/financeiro/relatorios', 'financeiro-faturamento'],
  ['/configuracoes', 'configuracoes'],
]

async function logar(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#email', { state: 'visible' })
  await page.waitForTimeout(800) // hydration do client component
  await page.fill('#email', EMAIL)
  await page.fill('#senha', SENHA)
  // Há dois botões "Entrar" (aba + submit). O submit é o último.
  await page.getByRole('button', { name: 'Entrar', exact: true }).last().click()
  try {
    // Sai da tela de login (redirect para /dashboard).
    await page.waitForFunction(() => !location.pathname.includes('/login'), {
      timeout: 30000,
    })
  } catch {
    const erro = await page.locator('[role="alert"]').textContent().catch(() => null)
    throw new Error('Login não saiu de /login. Erro na tela: ' + (erro ?? '(nenhum)'))
  }
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(1500)
}

async function capturar(ctx, rotulo, largura) {
  const page = await ctx.newPage()
  await logar(page)
  for (const [rota, nome] of TELAS) {
    try {
      await page.goto(`${BASE}${rota}`, { waitUntil: 'networkidle', timeout: 40000 })
      await page.waitForTimeout(1200)
      await page.screenshot({ path: `${OUT}/${rotulo}-${nome}.png`, fullPage: true })
      console.log(`ok  ${rotulo} ${rota}`)
    } catch (e) {
      console.log(`ERR ${rotulo} ${rota}: ${e.message.split('\n')[0]}`)
    }
  }
  await page.close()
}

async function main() {
  const browser = await chromium.launch()

  // Desktop
  const ctxDesk = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await capturar(ctxDesk, 'desk', 1440)
  await ctxDesk.close()

  // Mobile
  const ctxMob = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  await capturar(ctxMob, 'mob', 390)
  await ctxMob.close()

  await browser.close()
  console.log('\nScreenshots em:', OUT)
}

main().catch((e) => {
  console.error('FALHA:', e)
  process.exit(1)
})
