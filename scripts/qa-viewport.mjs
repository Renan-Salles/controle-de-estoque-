// Recaptura viewport-only (legível) das telas que como fullPage ficam enormes.
import { chromium } from 'playwright'
const BASE = 'http://127.0.0.1:3000'
const OUT = 'C:/Users/media/AppData/Local/Temp/claude/C--Users-media/7cf7fb52-3cbd-4ed0-9b02-95c343fde343/scratchpad/qa'

async function logar(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#email', { state: 'visible' })
  await page.waitForTimeout(800)
  await page.fill('#email', 'qa.bot@deposito.local')
  await page.fill('#senha', 'QaBot#2026!')
  await page.getByRole('button', { name: 'Entrar', exact: true }).last().click()
  await page.waitForFunction(() => !location.pathname.includes('/login'), { timeout: 30000 })
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(1200)
}

const ALVOS = [
  ['/relatorios', 'vp-relatorios-periodo'],
  ['/relatorios/produto', 'vp-relatorios-produto'],
  ['/movimentacoes', 'vp-movimentacoes'],
  ['/produtos', 'vp-produtos'],
  ['/clientes', 'vp-clientes'],
  ['/configuracoes', 'vp-configuracoes'],
]

const browser = await chromium.launch()
// Desktop viewport-only
const d = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const pd = await d.newPage()
await logar(pd)
for (const [rota, nome] of ALVOS) {
  await pd.goto(`${BASE}${rota}`, { waitUntil: 'networkidle', timeout: 40000 })
  await pd.waitForTimeout(1000)
  await pd.screenshot({ path: `${OUT}/${nome}.png` }) // fullPage:false (viewport)
  console.log('ok', rota)
}
await d.close()

// Mobile viewport-only para os cards (topo)
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const pm = await m.newPage()
await logar(pm)
for (const [rota, nome] of [['/movimentacoes', 'vp-mob-movimentacoes'], ['/produtos', 'vp-mob-produtos']]) {
  await pm.goto(`${BASE}${rota}`, { waitUntil: 'networkidle', timeout: 40000 })
  await pm.waitForTimeout(1000)
  await pm.screenshot({ path: `${OUT}/${nome}.png` })
  console.log('ok mob', rota)
}
await m.close()
await browser.close()
console.log('pronto')
