'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ClipboardCheck, Search } from 'lucide-react'
import { buscarPosicaoProdutos } from '@/lib/actions/produtos'
import { concluirInventario } from '@/lib/actions/inventario'
import { SkeletonLinhas } from '@/components/ui-kit/SkeletonLinhas'
import {
  Tabela,
  TabelaHead,
  TabelaHeadCell,
  TabelaBody,
  TabelaRow,
  TabelaCell,
} from '@/components/ui-kit/tabela'
import { formatarNumero } from '@/lib/formatos'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database.types'

type Produto = Database['public']['Views']['v_posicao_estoque']['Row']

// Contagem fisica: input por produto (vazio = nao conferido). Mostra o
// esperado -- foco em agilidade, quem conta e gente de confianca do balcao.
export function ContagemClient() {
  const router = useRouter()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [contagem, setContagem] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    let ativo = true
    buscarPosicaoProdutos()
      .then((d) => ativo && setProdutos(d as Produto[]))
      .finally(() => ativo && setLoading(false))
    return () => {
      ativo = false
    }
  }, [])

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase()
    if (!t) return produtos
    return produtos.filter(
      (p) =>
        p.nome.toLowerCase().includes(t) ||
        (p.codigo_barras ?? '').toLowerCase().includes(t),
    )
  }, [produtos, busca])

  const conferidos = Object.entries(contagem).filter(([, v]) => v !== '')
  const divergentes = conferidos.filter(([id, v]) => {
    const p = produtos.find((x) => x.id === id)
    return p && Number(v) !== Number(p.saldo_atual)
  })

  async function concluir() {
    if (conferidos.length === 0) {
      toast.error('Digite a contagem de pelo menos um produto')
      return
    }
    const confirma = window.confirm(
      `Concluir contagem?\n\n${conferidos.length} produtos conferidos, ${divergentes.length} com diferença.\nAs diferenças ajustam o estoque na hora.`,
    )
    if (!confirma) return
    setSalvando(true)
    const r = await concluirInventario(
      conferidos.map(([produto_id, v]) => ({ produto_id, contado: Number(v) })),
    )
    setSalvando(false)
    if ('error' in r && r.error) {
      toast.error(r.error)
      return
    }
    toast.success(
      `Contagem concluída: ${r.conferidos} conferidos, ${r.divergentes} ajustados.`,
    )
    setContagem({})
    const atualizados = await buscarPosicaoProdutos()
    setProdutos(atualizados as Produto[])
    router.refresh()
  }

  if (loading) return <SkeletonLinhas colunas={4} linhas={8} />

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
            strokeWidth={1.5}
          />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Filtrar produto..."
            className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-text outline-none placeholder:text-text-muted focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/30"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs tabular-nums text-text-muted">
            {conferidos.length} conferidos
            {divergentes.length > 0 && (
              <span className="ml-1 font-semibold text-warn">
                · {divergentes.length} divergentes
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={concluir}
            disabled={salvando || conferidos.length === 0}
            className="u-motion inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-primary-foreground hover:bg-brand-strong disabled:opacity-50"
          >
            <ClipboardCheck className="size-4" strokeWidth={1.75} />
            {salvando ? 'Ajustando...' : 'Concluir contagem'}
          </button>
        </div>
      </div>

      <Tabela minWidth={560}>
        <TabelaHead>
          <tr>
            <TabelaHeadCell>Produto</TabelaHeadCell>
            <TabelaHeadCell alinhar="direita">No sistema</TabelaHeadCell>
            <TabelaHeadCell alinhar="direita">Contado</TabelaHeadCell>
            <TabelaHeadCell alinhar="direita">Diferença</TabelaHeadCell>
          </tr>
        </TabelaHead>
        <TabelaBody>
          {filtrados.map((p) => {
            const v = contagem[p.id] ?? ''
            const dif = v === '' ? null : Number(v) - Number(p.saldo_atual)
            return (
              <TabelaRow key={p.id}>
                <TabelaCell>
                  <p className="font-medium text-text">{p.nome}</p>
                  {p.marca && <p className="text-xs text-text-muted">{p.marca}</p>}
                </TabelaCell>
                <TabelaCell alinhar="direita" className="text-text-muted">
                  {formatarNumero(p.saldo_atual)}
                </TabelaCell>
                <TabelaCell alinhar="direita">
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={v}
                    onChange={(e) =>
                      setContagem((c) => ({ ...c, [p.id]: e.target.value }))
                    }
                    placeholder="—"
                    className="h-8 w-20 rounded-md border border-border bg-bg text-center font-mono text-sm tabular-nums text-text outline-none focus-visible:border-brand [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    aria-label={`Contagem de ${p.nome}`}
                  />
                </TabelaCell>
                <TabelaCell alinhar="direita">
                  {dif == null ? (
                    <span className="text-text-muted">—</span>
                  ) : (
                    <span
                      className={cn(
                        'font-mono text-sm font-semibold tabular-nums',
                        dif === 0 ? 'text-ok' : 'text-warn',
                      )}
                    >
                      {dif > 0 ? '+' : ''}
                      {formatarNumero(dif)}
                    </span>
                  )}
                </TabelaCell>
              </TabelaRow>
            )
          })}
        </TabelaBody>
      </Tabela>
    </div>
  )
}
