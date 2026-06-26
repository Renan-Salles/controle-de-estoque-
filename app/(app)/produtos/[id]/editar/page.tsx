import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui-kit/PageHeader'
import { buscarProdutoPorId, listarCategorias } from '@/lib/actions/produtos'
import { ProdutoForm } from '../../ProdutoForm'

export default async function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [produto, categorias] = await Promise.all([
    buscarProdutoPorId(id),
    listarCategorias(),
  ])
  if (!produto) notFound()

  return (
    <div className="px-6 py-5">
      <PageHeader
        titulo="Editar produto"
        subtitulo={produto.nome}
      />
      <ProdutoForm
        modo="editar"
        produtoId={produto.id}
        categoriasIniciais={categorias as { id: string; nome: string }[]}
        inicial={{
          nome: produto.nome,
          marca: produto.marca ?? '',
          codigo_barras: produto.codigo_barras ?? '',
          categoria_id: produto.categoria_id,
          embalagem: produto.embalagem,
          volume_ml: produto.volume_ml != null ? String(produto.volume_ml) : '',
          preco_venda_padrao: String(produto.preco_venda_padrao),
          custo_atual: String(produto.custo_atual),
          estoque_minimo: String(produto.estoque_minimo),
        }}
      />
    </div>
  )
}
