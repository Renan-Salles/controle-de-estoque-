import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Expõe o pathname para o layout (que faz a trava de rota por cargo). Layouts
  // não recebem o pathname; o header é a ponte.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  const isAuth = !!user
  const isAuthPage = request.nextUrl.pathname.startsWith('/login')

  if (!isAuth && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (isAuth && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  return supabaseResponse
}

export const config = {
  // Exclui assets públicos do gate de auth: estáticos do Next, favicon, o
  // manifest do PWA e arquivos de imagem (ícones do app). Rotas com dados
  // sensíveis (ex.: /relatorios/.../pdf) NÃO casam com extensão de imagem e
  // seguem protegidas.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|api/alertas|.*\\.(?:png|svg|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
