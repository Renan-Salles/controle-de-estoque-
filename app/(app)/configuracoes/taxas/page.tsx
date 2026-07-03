import { PageHeader } from '@/components/ui-kit/PageHeader'
import { listarTaxas } from '@/lib/actions/taxas'
import { TaxasEntrega } from '@/components/configuracoes/TaxasEntrega'

export default async function TaxasPage() {
  const taxas = await listarTaxas()

  return (
    <div className="mx-auto max-w-2xl px-6 py-5">
      <PageHeader
        back="/configuracoes"
        titulo="Taxas de entrega"
        subtitulo="Frete padrão por bairro. Na venda, o frete vem preenchido pelo bairro do cliente (dá pra ajustar na hora)."
      />
      <TaxasEntrega iniciais={taxas} />
    </div>
  )
}
