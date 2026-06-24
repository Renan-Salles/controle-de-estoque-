import { NextRequest, NextResponse } from 'next/server'
import { gerarAlertas } from '@/lib/actions/alertas'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const resultado = await gerarAlertas()
  return NextResponse.json(resultado)
}
