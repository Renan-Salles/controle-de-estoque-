import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database.types'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Plus } from 'lucide-react'

type ClienteRow = Pick<
  Database['public']['Tables']['clientes']['Row'],
  'id' | 'nome' | 'telefone' | 'tipo' | 'status' | 'forma_pagamento_padrao' | 'prazo_pagamento_dias'
>

export default async function ClientesPage() {
  const supabase = await createClient()
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nome, telefone, tipo, status, forma_pagamento_padrao, prazo_pagamento_dias')
    .order('nome') as { data: ClienteRow[] | null }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <Link href="/clientes/novo"
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium bg-[#2B7A78] text-white hover:bg-[#1e5654] transition-colors">
          <Plus size={16} />Novo Cliente
        </Link>
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-card border-b border-border">
            <tr>
              <th className="text-left p-3 font-medium">Nome</th>
              <th className="text-left p-3 font-medium">Tipo</th>
              <th className="text-left p-3 font-medium">Telefone</th>
              <th className="text-left p-3 font-medium">Pagamento</th>
              <th className="text-center p-3 font-medium">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {(clientes ?? []).map((c) => (
              <tr key={c.id} className="border-b border-border hover:bg-card transition-colors">
                <td className="p-3 font-medium">{c.nome}</td>
                <td className="p-3 text-muted-foreground capitalize">{c.tipo}</td>
                <td className="p-3 text-muted-foreground">{c.telefone ?? '-'}</td>
                <td className="p-3 text-muted-foreground">
                  {c.forma_pagamento_padrao}
                  {c.prazo_pagamento_dias > 0 && ` (${c.prazo_pagamento_dias}d)`}
                </td>
                <td className="p-3 text-center">
                  <Badge variant={c.status === 'ativo' ? 'default' : 'secondary'}>{c.status}</Badge>
                </td>
                <td className="p-3">
                  <Link href={`/clientes/${c.id}`} className="text-xs text-[#2B7A78] hover:underline">Ver</Link>
                </td>
              </tr>
            ))}
            {!clientes?.length && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum cliente cadastrado</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
