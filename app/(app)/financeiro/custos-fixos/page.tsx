import { PageHeader } from '@/components/ui-kit/PageHeader'
import { listarCustosFixos } from '@/lib/actions/custos-fixos'
import { CustosFixosClient } from './CustosFixosClient'

export default async function CustosFixosPage() {
  const custos = await listarCustosFixos()
  return (
    <div>
      <PageHeader
        titulo="Financeiro"
        subtitulo="Despesas fixas mensais do depósito."
      />
      <div className="mt-6">
        <CustosFixosClient inicial={custos} />
      </div>
    </div>
  )
}
