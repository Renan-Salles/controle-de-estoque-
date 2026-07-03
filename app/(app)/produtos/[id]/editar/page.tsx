import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui-kit/PageHeader'
import {
  buscarProdutoPorId,
  listarCategorias,
  listarEmbalagens,
} from '@/lib/actions/produtos'
import { ProdutoForm } from '../../ProdutoForm'

export default async function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [produto, categorias, embalagens] = await Promise.all([
    buscarProdutoPorId(id),
    listarCategorias(),
    listarEmbalagens(id),
  ])
  if (!produto) notFound()

  // A "Unidade" e fixa no form (preco = preco_venda_padrao); so as formas
  // extras (fardo/caixa) entram na lista editavel.
  const extras = embalagens
    .filter((e) => e.unidades > 1)
    .map((e) => ({
      nome: e.nome,
      unidades: String(e.unidades),
      preco: String(e.preco),
    }))

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
          volume_ml: produto.volume_ml != null ? String(produto.volume_ml) : '',
          preco_venda_padrao: String(produto.preco_venda_padrao),
          custo_atual: String(produto.custo_atual),
          margem_alvo_pct: produto.margem_alvo_pct != null ? String(produto.margem_alvo_pct) : '',
          estoque_minimo: String(produto.estoque_minimo),
          embalagens: extras,
        }}
      />
    </div>
  )
}
