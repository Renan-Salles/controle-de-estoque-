import { redirect } from 'next/navigation'

// O modelo mudou: toda venda é à vista, não há mais contas a receber.
// A antiga tela de "A receber" agora aponta para Formas de pagamento.
export default function ContasReceberPage() {
  redirect('/financeiro/formas-pagamento')
}
