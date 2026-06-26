// Gera os PNGs do PWA a partir de public/icon.svg.
// Uso: node scripts/gerar-icones.mjs
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const raiz = join(__dirname, '..')
const svg = readFileSync(join(raiz, 'public', 'icon.svg'))

const saidas = [
  { arquivo: join(raiz, 'public', 'icon-192.png'), size: 192 },
  { arquivo: join(raiz, 'public', 'icon-512.png'), size: 512 },
  { arquivo: join(raiz, 'app', 'apple-icon.png'), size: 180 },
  { arquivo: join(raiz, 'app', 'icon.png'), size: 192 },
]

async function main() {
  for (const s of saidas) {
    await sharp(svg, { density: 384 })
      .resize(s.size, s.size)
      .png()
      .toFile(s.arquivo)
    console.log('gerado:', s.arquivo)
  }
  console.log('OK.')
}

main().catch((e) => {
  console.error('ERRO:', e.message)
  process.exit(1)
})
