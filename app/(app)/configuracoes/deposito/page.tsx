import { PageHeader } from '@/components/ui-kit/PageHeader'
import { getConfDeposito } from '@/lib/actions/configuracoes'
import { DepositoForm } from './DepositoForm'

export default async function DepositoConfigPage() {
  const conf = await getConfDeposito()
  const inicial = {
    nome: conf?.nome ?? '',
    cnpj: conf?.cnpj ?? '',
    telefone: conf?.telefone ?? '',
    endereco_rua: conf?.endereco_rua ?? '',
    endereco_numero: conf?.endereco_numero ?? '',
    endereco_bairro: conf?.endereco_bairro ?? '',
    endereco_cidade: conf?.endereco_cidade ?? '',
    chave_pix: conf?.chave_pix ?? '',
  }

  return (
    <div className="px-0 py-0">
      <PageHeader
        titulo="Dados do Depósito"
        subtitulo="Nome, CNPJ e endereço que aparecem no cupom fiscal."
        back="/configuracoes"
      />
      <DepositoForm inicial={inicial} />
    </div>
  )
}
