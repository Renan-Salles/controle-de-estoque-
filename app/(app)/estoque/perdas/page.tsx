import { PageHeader } from '@/components/ui-kit/PageHeader'
import { buscarPosicaoEstoque, buscarDescartes } from '@/lib/actions/estoque'
import { PerdasClient } from './PerdasClient'

export default async function PerdasPage() {
  const [posicao, historico] = await Promise.all([
    buscarPosicaoEstoque(),
    buscarDescartes(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = posicao as any[]
  const produtos = rows
    .filter((p) => (p.saldo_atual ?? 0) > 0)
    .map((p: { produto_id: string; nome: string; saldo_atual: number | null }) => ({
      produto_id: p.produto_id,
      nome: p.nome,
      saldo_atual: p.saldo_atual,
    }))

  return (
    <div className="px-6 py-5">
      <PageHeader
        titulo="Perdas e Quebras"
        back="/estoque"
        subtitulo="Registre descartes de estoque por dano, vencimento ou perda."
      />
      <PerdasClient produtos={produtos} historico={historico} />
    </div>
  )
}
