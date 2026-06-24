'use client'
import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BuscaProduto } from '@/components/pedido/BuscaProduto'
import { BuscaCliente } from '@/components/pedido/BuscaCliente'
import { ListaItensPedido } from '@/components/pedido/ListaItensPedido'
import { confirmarPedido } from '@/lib/actions/pedidos'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { ItemPedido } from '@/types'

export default function NovoPedidoPage() {
  const router = useRouter()
  const [clienteId, setClienteId] = useState<string>('')
  const [itens, setItens] = useState<ItemPedido[]>([])
  const [formaPagamento, setFormaPagamento] = useState('dinheiro')
  const [prazoDias, setPrazoDias] = useState('0')
  const [observacoes, setObservacoes] = useState('')
  const [confirmando, setConfirmando] = useState(false)

  const confirmar = useCallback(async () => {
    if (!clienteId) { toast.error('Selecione um cliente'); return }
    if (!itens.length) { toast.error('Adicione pelo menos 1 produto'); return }
    setConfirmando(true)
    const resultado = await confirmarPedido({
      cliente_id: clienteId,
      forma_pagamento: formaPagamento,
      prazo_pagamento_dias: Number(prazoDias),
      observacoes,
      canal: 'telefone',
      itens: itens.map(i => ({ produto_id: i.produto_id, quantidade: i.quantidade, preco_unitario: i.preco_unitario, total: i.total })),
    })
    setConfirmando(false)
    if (resultado.error) { toast.error(resultado.error); return }
    toast.success(`Pedido #${resultado.numeroPedido} confirmado`)
    router.push(`/pedidos/${resultado.pedidoId}/romaneio`)
  }, [clienteId, itens, formaPagamento, prazoDias, observacoes, router])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'Enter') confirmar()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmar])

  const adicionarItem = useCallback((produto: Omit<ItemPedido, 'quantidade' | 'total'>) => {
    setItens(prev => {
      const existe = prev.find(i => i.produto_id === produto.produto_id)
      if (existe) {
        return prev.map(i => i.produto_id === produto.produto_id
          ? { ...i, quantidade: i.quantidade + 1, total: (i.quantidade + 1) * i.preco_unitario }
          : i)
      }
      return [...prev, { ...produto, quantidade: 1, total: produto.preco_unitario }]
    })
  }, [])

  const alterarQtde = useCallback((produtoId: string, qtde: number) => {
    setItens(prev => prev.map(i => i.produto_id === produtoId
      ? { ...i, quantidade: qtde, total: qtde * i.preco_unitario }
      : i))
  }, [])

  const remover = useCallback((produtoId: string) => {
    setItens(prev => prev.filter(i => i.produto_id !== produtoId))
  }, [])

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex-1 p-6 overflow-y-auto space-y-4 border-r border-border">
        <h1 className="text-xl font-bold">Novo Pedido</h1>
        <BuscaCliente onSelecionar={setClienteId} />
        <BuscaProduto onAdicionar={adicionarItem} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Forma de pagamento</label>
            <Select value={formaPagamento} onValueChange={(v) => v && setFormaPagamento(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="fiado">Fiado</SelectItem>
                <SelectItem value="cartao_debito">Cartao Debito</SelectItem>
                <SelectItem value="cartao_credito">Cartao Credito</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Prazo (dias)</label>
            <Select value={prazoDias} onValueChange={(v) => v && setPrazoDias(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">A vista</SelectItem>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="15">15 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Textarea placeholder="Observacoes..." value={observacoes}
          onChange={e => setObservacoes(e.target.value)} rows={2} />
      </div>
      <div className="w-96 p-6 flex flex-col gap-4">
        <h2 className="font-semibold">Resumo do Pedido</h2>
        <div className="flex-1 overflow-y-auto">
          <ListaItensPedido itens={itens} onAlterarQtde={alterarQtde} onRemover={remover} />
        </div>
        <Button
          className="w-full bg-[#2B7A78] hover:bg-[#1e5654] h-12 text-base font-semibold"
          onClick={confirmar}
          disabled={confirmando || !itens.length || !clienteId}>
          {confirmando ? 'Confirmando...' : 'Confirmar e Imprimir (Ctrl+Enter)'}
        </Button>
      </div>
    </div>
  )
}
