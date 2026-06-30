'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/ui-kit/PageHeader'
import { btnClass } from '@/components/ui-kit/Button'
import { FormSection, Campo } from '@/components/ui-kit/FormKit'
import { criarCliente } from '@/lib/actions/clientes'

const TIPOS = [
  { v: 'bar', l: 'Bar' },
  { v: 'comercio', l: 'Comércio' },
  { v: 'consumidor_final', l: 'Consumidor final' },
  { v: 'revendedor', l: 'Revendedor' },
]

const PAGAMENTOS = [
  { v: 'dinheiro', l: 'Dinheiro' },
  { v: 'pix', l: 'Pix' },
  { v: 'cartao_debito', l: 'Cartão débito' },
  { v: 'cartao_credito', l: 'Cartão crédito' },
  { v: 'fiado', l: 'Fiado' },
]

export default function NovoClientePage() {
  const router = useRouter()
  const [salvando, setSalvando] = useState(false)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    nome: '',
    tipo: 'bar',
    cpf_cnpj: '',
    telefone: '',
    whatsapp: '',
    endereco_rua: '',
    endereco_numero: '',
    endereco_bairro: '',
    endereco_cidade: '',
    forma_pagamento_padrao: 'dinheiro',
    prazo_pagamento_dias: '0',
    limite_credito: '0',
    observacoes: '',
  })

  const set = (k: string, v: string | null) => {
    setForm((p) => ({ ...p, [k]: v ?? '' }))
    if (erros[k]) setErros((e) => ({ ...e, [k]: '' }))
  }

  async function salvar() {
    if (form.nome.trim().length < 2) {
      setErros({ nome: 'Informe o nome do cliente' })
      return
    }
    setSalvando(true)
    const resultado = await criarCliente({
      ...form,
      prazo_pagamento_dias: Number(form.prazo_pagamento_dias || 0),
      limite_credito: Number(form.limite_credito || 0),
    })
    setSalvando(false)
    if (resultado.error) {
      toast.error(resultado.error)
      return
    }
    toast.success('Cliente cadastrado')
    router.push('/clientes')
  }

  return (
    <div className="px-6 py-5">
      <PageHeader
        titulo="Novo cliente"
        subtitulo="Cadastre um bar, comércio ou revendedor."
      />
      <div className="mx-auto max-w-3xl">
        <div className="rounded-lg border border-border bg-surface px-6 py-6 sm:px-8">
          <FormSection
            titulo="Dados"
            descricao="Identificação do cliente no sistema."
          >
            <Campo label="Nome" obrigatorio erro={erros.nome} full>
              <Input
                value={form.nome}
                onChange={(e) => set('nome', e.target.value)}
                placeholder="Bar do Tião"
                aria-invalid={!!erros.nome}
              />
            </Campo>
            <Campo label="Tipo">
              <Select value={form.tipo} onValueChange={(v) => set('tipo', v)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(v: string) => TIPOS.find((t) => t.v === v)?.l ?? v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.v} value={t.v}>
                      {t.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo label="CPF / CNPJ">
              <Input
                value={form.cpf_cnpj}
                onChange={(e) => set('cpf_cnpj', e.target.value)}
                placeholder="000.000.000-00"
              />
            </Campo>
          </FormSection>

          <FormSection
            titulo="Contato"
            descricao="Telefone e WhatsApp para falar com o cliente."
          >
            <Campo label="Telefone">
              <Input
                value={form.telefone}
                onChange={(e) => set('telefone', e.target.value)}
                placeholder="(71) 99847-1928"
              />
            </Campo>
            <Campo label="WhatsApp">
              <Input
                value={form.whatsapp}
                onChange={(e) => set('whatsapp', e.target.value)}
                placeholder="(71) 99847-1928"
              />
            </Campo>
          </FormSection>

          <FormSection
            titulo="Endereço"
            descricao="Usado na entrega e no romaneio."
          >
            <Campo label="Rua" full>
              <Input
                value={form.endereco_rua}
                onChange={(e) => set('endereco_rua', e.target.value)}
                placeholder="Rua das Flores"
              />
            </Campo>
            <Campo label="Número">
              <Input
                value={form.endereco_numero}
                onChange={(e) => set('endereco_numero', e.target.value)}
                placeholder="142"
              />
            </Campo>
            <Campo label="Bairro">
              <Input
                value={form.endereco_bairro}
                onChange={(e) => set('endereco_bairro', e.target.value)}
                placeholder="Santa Rita"
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
            titulo="Pagamento"
            descricao="Forma de pagamento que o cliente costuma usar."
          >
            <Campo label="Forma de pagamento padrão">
              <Select
                value={form.forma_pagamento_padrao}
                onValueChange={(v) => {
                  set('forma_pagamento_padrao', v)
                  if (v === 'fiado' && form.prazo_pagamento_dias === '0') {
                    set('prazo_pagamento_dias', '7')
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{(v: string) => PAGAMENTOS.find((p) => p.v === v)?.l ?? v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PAGAMENTOS.map((p) => (
                    <SelectItem key={p.v} value={p.v}>
                      {p.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            {form.forma_pagamento_padrao === 'fiado' && (
              <Campo
                label="Prazo de pagamento (dias)"
                ajuda="Tempo limite padrão para esse cliente pagar. Pode ser ajustado em cada venda."
              >
                <Input
                  type="number"
                  min="1"
                  value={form.prazo_pagamento_dias}
                  onChange={(e) => set('prazo_pagamento_dias', e.target.value)}
                  placeholder="7"
                />
              </Campo>
            )}
            <Campo label="Observações" full>
              <Textarea
                value={form.observacoes}
                onChange={(e) => set('observacoes', e.target.value)}
                rows={2}
                placeholder="Entrega só de manhã, paga toda sexta."
              />
            </Campo>
          </FormSection>

          <div className="mt-7 flex items-center justify-end gap-2 border-t border-border pt-6">
            <Link href="/clientes" className={btnClass('outline')}>
              Cancelar
            </Link>
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className={btnClass('primary')}
            >
              {salvando ? 'Salvando...' : 'Salvar cliente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
