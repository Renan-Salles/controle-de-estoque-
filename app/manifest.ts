import type { MetadataRoute } from 'next'

// Manifest do PWA: torna o sistema instalável na tela inicial (abre em tela
// cheia, sem barra do navegador). Next serve em /manifest.webmanifest e injeta
// o <link> automaticamente.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DepSys',
    short_name: 'DepSys',
    description: 'Gestão de estoque e financeiro do depósito de bebidas',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0e9aa7',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
