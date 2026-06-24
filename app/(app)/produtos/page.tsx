import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database.types'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Plus } from 'lucide-react'

type PosicaoEstoque = Database['public']['Views']['v_posicao_estoque']['Row']

export default async function ProdutosPage() {
  const supabase = await createClient()
  const { data: produtos } = await supabase
    .from('v_posicao_estoque')
    .select('*')
    .order('categoria')
    .order('nome') as { data: PosicaoEstoque[] | null }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Produtos</h1>
        <Link href="/produtos/novo"
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium bg-[#2B7A78] text-white hover:bg-[#1e5654] transition-colors">
          <Plus size={16} />Novo Produto
        </Link>
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-card border-b border-border">
            <tr>
              <th className="text-left p-3 font-medium">Produto</th>
              <th className="text-left p-3 font-medium">Categoria</th>
              <th className="text-center p-3 font-medium">Embalagem</th>
              <th className="text-right p-3 font-medium">Estoque</th>
              <th className="text-right p-3 font-medium">Preco</th>
              <th className="text-center p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(produtos ?? []).map((p) => (
              <tr key={p.id} className="border-b border-border hover:bg-card transition-colors">
                <td className="p-3">
                  <p className="font-medium">{p.nome}</p>
                  {p.marca && <p className="text-xs text-muted-foreground">{p.marca}</p>}
                </td>
                <td className="p-3 text-muted-foreground">{p.categoria}</td>
                <td className="p-3 text-center text-muted-foreground">{p.embalagem}</td>
                <td className="p-3 text-right font-mono">{p.saldo_atual}</td>
                <td className="p-3 text-right font-mono">R$ {Number(p.preco_venda_padrao).toFixed(2)}</td>
                <td className="p-3 text-center">
                  <Badge variant={
                    p.status_estoque === 'ok' ? 'default' :
                    p.status_estoque === 'alerta' ? 'secondary' : 'destructive'
                  }>
                    {p.status_estoque}
                  </Badge>
                </td>
              </tr>
            ))}
            {!produtos?.length && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum produto cadastrado</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
