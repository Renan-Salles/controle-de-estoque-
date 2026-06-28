'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { btnClass } from '@/components/ui-kit/Button'
import { FormSection, Campo } from '@/components/ui-kit/FormKit'
import { salvarConfDeposito, type ConfDeposito } from '@/lib/actions/configuracoes'

export function DepositoForm({ inicial }: { inicial: ConfDeposito }) {
  const [form, setForm] = useState(inicial)
  const [salvando, setSalvando] = useState(false)

  const set = (k: keyof ConfDeposito, v: string) =>
    setForm((p) => ({ ...p, [k]: v }))

  async function salvar() {
    setSalvando(true)
    const res = await salvarConfDeposito(form as Record<string, unknown>)
    setSalvando(false)
    if (res.error) { toast.error(res.error); return }
    toast.success('Configurações salvas')
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-lg border border-border bg-surface px-6 py-6 sm:px-8">
        <FormSection
          titulo="Identificação"
          descricao="Nome e CNPJ que aparecem no cabeçalho do cupom fiscal."
        >
          <Campo label="Nome do estabelecimento" obrigatorio full>
            <Input
              value={form.nome}
              onChange={(e) => set('nome', e.target.value)}
              placeholder="Depósito Renan"
            />
          </Campo>
          <Campo label="CNPJ">
            <Input
              value={form.cnpj ?? ''}
              onChange={(e) => set('cnpj', e.target.value)}
              placeholder="00.000.000/0001-00"
            />
          </Campo>
          <Campo label="Telefone / WhatsApp">
            <Input
              value={form.telefone ?? ''}
              onChange={(e) => set('telefone', e.target.value)}
              placeholder="(71) 99999-9999"
            />
          </Campo>
        </FormSection>

        <FormSection
          titulo="Endereço"
          descricao="Exibido no cupom abaixo do nome."
        >
          <Campo label="Rua" full>
            <Input
              value={form.endereco_rua ?? ''}
              onChange={(e) => set('endereco_rua', e.target.value)}
              placeholder="Rua das Flores"
            />
          </Campo>
          <Campo label="Número">
            <Input
              value={form.endereco_numero ?? ''}
              onChange={(e) => set('endereco_numero', e.target.value)}
              placeholder="123"
            />
          </Campo>
          <Campo label="Bairro">
            <Input
              value={form.endereco_bairro ?? ''}
              onChange={(e) => set('endereco_bairro', e.target.value)}
              placeholder="Centro"
            />
          </Campo>
          <Campo label="Cidade">
            <Input
              value={form.endereco_cidade ?? ''}
              onChange={(e) => set('endereco_cidade', e.target.value)}
              placeholder="Salvador"
            />
          </Campo>
        </FormSection>

        <div className="mt-7 flex justify-end border-t border-border pt-6">
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className={btnClass('primary')}
          >
            {salvando ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </div>
      </div>
    </div>
  )
}
