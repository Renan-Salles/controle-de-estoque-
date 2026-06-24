'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/ui-kit/PageHeader'
import { btnClass } from '@/components/ui-kit/Button'
import { FormSection, Campo } from '@/components/ui-kit/FormKit'
import { criarFornecedor } from '@/lib/actions/fornecedores'

export default function NovoFornecedorPage() {
  const router = useRouter()
  const [salvando, setSalvando] = useState(false)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    nome: '',
    razao_social: '',
    cnpj: '',
    contato_nome: '',
    telefone: '',
    whatsapp: '',
    email: '',
    endereco_rua: '',
    endereco_numero: '',
    endereco_bairro: '',
    endereco_cidade: '',
    produtos_fornecidos: '',
    prazo_entrega_dias: '0',
    observacoes: '',
  })

  const set = (k: string, v: string | null) => {
    setForm((p) => ({ ...p, [k]: v ?? '' }))
    if (erros[k]) setErros((e) => ({ ...e, [k]: '' }))
  }

  async function salvar() {
    if (form.nome.trim().length < 2) {
      setErros({ nome: 'Informe o nome do fornecedor' })
      return
    }
    setSalvando(true)
    const resultado = await criarFornecedor({
      ...form,
      prazo_entrega_dias: Number(form.prazo_entrega_dias || 0),
    })
    setSalvando(false)
    if (resultado.error) {
      toast.error(resultado.error)
      return
    }
    toast.success('Fornecedor cadastrado')
    router.push('/fornecedores')
  }

  return (
    <div className="px-6 py-5">
      <PageHeader
        titulo="Novo fornecedor"
        subtitulo="Cadastre uma distribuidora ou fábrica."
      />
      <div className="mx-auto max-w-3xl">
        <div className="rounded-lg border border-border bg-surface px-6 py-6 sm:px-8">
          <FormSection
            titulo="Identificação"
            descricao="Razão social e documento da empresa."
          >
            <Campo label="Nome" obrigatorio erro={erros.nome} full>
              <Input
                value={form.nome}
                onChange={(e) => set('nome', e.target.value)}
                placeholder="Distribuidora Olho d'Água"
                aria-invalid={!!erros.nome}
              />
            </Campo>
            <Campo label="Razão social">
              <Input
                value={form.razao_social}
                onChange={(e) => set('razao_social', e.target.value)}
                placeholder="Olho d'Água Bebidas Ltda"
              />
            </Campo>
            <Campo label="CNPJ">
              <Input
                value={form.cnpj}
                onChange={(e) => set('cnpj', e.target.value)}
                placeholder="12.345.678/0001-90"
              />
            </Campo>
          </FormSection>

          <FormSection
            titulo="Contato"
            descricao="Quem atende os pedidos de compra."
          >
            <Campo label="Pessoa de contato">
              <Input
                value={form.contato_nome}
                onChange={(e) => set('contato_nome', e.target.value)}
                placeholder="Cleonice Andrade"
              />
            </Campo>
            <Campo label="E-mail">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="vendas@olhodagua.com.br"
              />
            </Campo>
            <Campo label="Telefone">
              <Input
                value={form.telefone}
                onChange={(e) => set('telefone', e.target.value)}
                placeholder="(75) 3221-4087"
              />
            </Campo>
            <Campo label="WhatsApp">
              <Input
                value={form.whatsapp}
                onChange={(e) => set('whatsapp', e.target.value)}
                placeholder="(75) 99812-4087"
              />
            </Campo>
          </FormSection>

          <FormSection
            titulo="Endereço"
            descricao="Local de retirada ou sede da distribuidora."
          >
            <Campo label="Rua" full>
              <Input
                value={form.endereco_rua}
                onChange={(e) => set('endereco_rua', e.target.value)}
                placeholder="Avenida Industrial"
              />
            </Campo>
            <Campo label="Número">
              <Input
                value={form.endereco_numero}
                onChange={(e) => set('endereco_numero', e.target.value)}
                placeholder="3400"
              />
            </Campo>
            <Campo label="Bairro">
              <Input
                value={form.endereco_bairro}
                onChange={(e) => set('endereco_bairro', e.target.value)}
                placeholder="Tomba"
              />
            </Campo>
            <Campo label="Cidade" full>
              <Input
                value={form.endereco_cidade}
                onChange={(e) => set('endereco_cidade', e.target.value)}
                placeholder="Feira de Santana"
              />
            </Campo>
          </FormSection>

          <FormSection
            titulo="Fornecimento"
            descricao="O que essa fonte fornece e em quanto tempo entrega."
          >
            <Campo label="Produtos fornecidos" full>
              <Textarea
                value={form.produtos_fornecidos}
                onChange={(e) => set('produtos_fornecidos', e.target.value)}
                rows={2}
                placeholder="Cervejas, refrigerantes e água mineral."
              />
            </Campo>
            <Campo
              label="Prazo de entrega (dias)"
              ajuda="Tempo médio do pedido até a chegada."
            >
              <Input
                type="number"
                inputMode="numeric"
                value={form.prazo_entrega_dias}
                onChange={(e) => set('prazo_entrega_dias', e.target.value)}
                placeholder="2"
              />
            </Campo>
            <Campo label="Observações" full>
              <Textarea
                value={form.observacoes}
                onChange={(e) => set('observacoes', e.target.value)}
                rows={2}
                placeholder="Pedido mínimo de 50 caixas. Entrega às terças e sextas."
              />
            </Campo>
          </FormSection>

          <div className="mt-7 flex items-center justify-end gap-2 border-t border-border pt-6">
            <Link href="/fornecedores" className={btnClass('outline')}>
              Cancelar
            </Link>
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className={btnClass('primary')}
            >
              {salvando ? 'Salvando...' : 'Salvar fornecedor'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
