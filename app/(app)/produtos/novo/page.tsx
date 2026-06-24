import { PageHeader } from '@/components/ui-kit/PageHeader'
import { ProdutoForm } from '../ProdutoForm'

export default function NovoProdutoPage() {
  return (
    <div className="px-6 py-5">
      <PageHeader
        titulo="Novo produto"
        subtitulo="Cadastre uma bebida no catálogo do depósito."
      />
      <ProdutoForm modo="novo" />
    </div>
  )
}
