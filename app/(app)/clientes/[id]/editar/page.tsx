import { notFound } from 'next/navigation'
import { buscarClientePorId } from '@/lib/actions/clientes'
import { ClienteForm } from '../../ClienteForm'

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cliente = await buscarClientePorId(id)
  if (!cliente) notFound()

  return (
    <ClienteForm
      modo="editar"
      clienteId={cliente.id}
      inicial={{
        nome: cliente.nome,
        tipo: cliente.tipo,
        cpf_cnpj: cliente.cpf_cnpj ?? '',
        telefone: cliente.telefone ?? '',
        whatsapp: cliente.whatsapp ?? '',
        endereco_rua: cliente.endereco?.rua ?? '',
        endereco_numero: cliente.endereco?.numero ?? '',
        endereco_bairro: cliente.endereco?.bairro ?? '',
        endereco_cidade: cliente.endereco?.cidade ?? '',
        forma_pagamento_padrao: cliente.forma_pagamento_padrao,
        prazo_pagamento_dias: String(cliente.prazo_pagamento_dias ?? 0),
        limite_credito: String(cliente.limite_credito ?? 0),
        observacoes: cliente.observacoes ?? '',
      }}
    />
  )
}
