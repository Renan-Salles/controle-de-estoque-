import { PageHeader } from '@/components/ui-kit/PageHeader'
import { ProdutoForm } from '../ProdutoForm'

export default function NovoProdutoPage() {
  return (
    <div className="px-6 py-5">
      <PageHeader
        titulo="Novo produto"
        subtitulo="Cadastre uma bebida no catálogo deste local."
      />
      <ProdutoForm modo="novo" />
    </div>
  )
}
