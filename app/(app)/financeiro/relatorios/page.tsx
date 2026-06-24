import { createClient } from '@/lib/supabase/server'

export default async function RelatoriosPage() {
  const supabase = await createClient()
  const { data: faturamento } = await supabase
    .from('v_faturamento_mensal')
    .select('*')
    .limit(12)

  const { data: curvaABC } = await supabase
    .from('v_curva_abc')
    .select('*')
    .limit(30)

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Relatorios</h1>

      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="font-semibold mb-4">Faturamento Mensal</h2>
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr>
              <th className="text-left py-2 font-medium">Mes</th>
              <th className="text-right py-2 font-medium">Pedidos</th>
              <th className="text-right py-2 font-medium">Receita Bruta</th>
              <th className="text-right py-2 font-medium">Ticket Medio</th>
            </tr>
          </thead>
          <tbody>
            {(faturamento ?? []).map((f, i) => (
              <tr key={i} className="border-b border-border">
                <td className="py-2">{new Date(f.mes).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</td>
                <td className="py-2 text-right">{f.total_pedidos}</td>
                <td className="py-2 text-right font-medium text-[#D4A520]">R$ {(f.receita_bruta ?? 0).toFixed(2)}</td>
                <td className="py-2 text-right">R$ {(f.ticket_medio ?? 0).toFixed(2)}</td>
              </tr>
            ))}
            {!faturamento?.length && <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">Sem dados ainda</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="font-semibold mb-4">Curva ABC (ultimos 90 dias)</h2>
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr>
              <th className="text-left py-2 font-medium">Produto</th>
              <th className="text-right py-2 font-medium">Unidades</th>
              <th className="text-right py-2 font-medium">Faturamento</th>
              <th className="text-right py-2 font-medium">% Acumulado</th>
              <th className="text-center py-2 font-medium">Classe</th>
            </tr>
          </thead>
          <tbody>
            {(curvaABC ?? []).map((p, i) => (
              <tr key={i} className="border-b border-border">
                <td className="py-2">{p.nome}</td>
                <td className="py-2 text-right">{p.total_unidades}</td>
                <td className="py-2 text-right">R$ {(p.total_faturamento ?? 0).toFixed(2)}</td>
                <td className="py-2 text-right">{p.pct_acumulado}%</td>
                <td className="py-2 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    p.classe_abc === 'A' ? 'bg-green-500/20 text-green-400' :
                    p.classe_abc === 'B' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-muted text-muted-foreground'
                  }`}>{p.classe_abc}</span>
                </td>
              </tr>
            ))}
            {!curvaABC?.length && <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">Sem dados ainda</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
