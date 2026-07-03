import { PageHeader } from '@/components/ui-kit/PageHeader'
import { listarMetas } from '@/lib/actions/metas'
import { mesAtualBrasil } from '@/lib/formatos'
import { FormMeta } from '@/components/configuracoes/FormMeta'

export default async function MetasPage() {
  const metas = await listarMetas(12)
  const mesAtual = mesAtualBrasil()
  const metaAtual = metas.find((m) => m.mes === mesAtual)?.valor ?? null

  return (
    <div className="mx-auto max-w-2xl px-6 py-5">
      <PageHeader
        back="/configuracoes"
        titulo="Meta de vendas"
        subtitulo="Faturamento que você quer bater no mês. Aparece como barra de progresso no dashboard."
      />
      <FormMeta mesAtual={mesAtual} metaAtual={metaAtual} historico={metas} />
    </div>
  )
}
