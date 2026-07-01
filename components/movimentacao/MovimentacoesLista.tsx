'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Printer, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import {
  Tabela,
  TabelaHead,
  TabelaHeadCell,
  TabelaBody,
  TabelaRow,
  TabelaCell,
} from '@/components/ui-kit/tabela'
import { StatusPill } from '@/components/ui-kit/StatusPill'
import { CardLinha } from '@/components/ui-kit/CardLinha'
import { Money } from '@/components/ui-kit/Money'
import { cn } from '@/lib/utils'
import { badgeFulfillment } from '@/lib/pedido-labels'

export type LinhaMov = {
  chave: string
  tipo: 'saida' | 'entrada'
  data: string
  descricao: string
  numero: string | null
  detalhe: string
  valor: number
  href: string | null
  romaneioHref: string | null
  statusVenda?: string
  tipoFulfillment?: string
  concluidoEm?: string | null
}

const FMT_DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function dataHora(d: string): string {
  const data = new Date(d)
  if (Number.isNaN(data.getTime())) return ''
  return FMT_DATA_HORA.format(data)
}

const PASSO = 40

// Lista de movimentações com paginação incremental ("Ver mais"). Renderiza só
// `mostrar` linhas por vez para não pesar o DOM (eram até 300 de uma vez).
export function MovimentacoesLista({ linhas }: { linhas: LinhaMov[] }) {
  const [mostrar, setMostrar] = useState(PASSO)
  const visiveis = linhas.slice(0, mostrar)
  const restantes = linhas.length - visiveis.length

  return (
    <>
      {/* Desktop: tabela */}
      <div className="hidden lg:block">
        <Tabela>
          <TabelaHead>
            <tr>
              <TabelaHeadCell>Tipo</TabelaHeadCell>
              <TabelaHeadCell>Data/hora</TabelaHeadCell>
              <TabelaHeadCell>Descrição</TabelaHeadCell>
              <TabelaHeadCell>Detalhe</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita">Valor</TabelaHeadCell>
              <TabelaHeadCell alinhar="direita"> </TabelaHeadCell>
            </tr>
          </TabelaHead>
          <TabelaBody>
            {visiveis.map((l) => {
              const saida = l.tipo === 'saida'
              const Icone = saida ? ArrowUpRight : ArrowDownLeft
              const badge = l.tipoFulfillment
                ? badgeFulfillment(l.tipoFulfillment, l.concluidoEm ?? null)
                : null
              const conteudo = (
                <span className="flex items-center gap-2">
                  <span className="font-medium text-text">{l.descricao}</span>
                  {l.numero && (
                    <span className="font-mono text-xs tabular-nums text-text-muted">
                      {l.numero}
                    </span>
                  )}
                  {badge && <StatusPill status={badge.status} label={badge.label} />}
                </span>
              )
              return (
                <TabelaRow key={l.chave} className="group">
                  <TabelaCell>
                    <StatusPill
                      status={saida ? 'critico' : 'ok'}
                      label={saida ? 'Saída' : 'Entrada'}
                    />
                  </TabelaCell>
                  <TabelaCell className="text-text-muted" mono>
                    {l.href ? (
                      <Link href={l.href} className="block">
                        {dataHora(l.data)}
                      </Link>
                    ) : (
                      dataHora(l.data)
                    )}
                  </TabelaCell>
                  <TabelaCell>
                    {l.href ? (
                      <Link href={l.href} className="block hover:text-brand">
                        <span className="flex items-center gap-2">
                          <Icone
                            className={cn('size-3.5 shrink-0', saida ? 'text-err' : 'text-ok')}
                            strokeWidth={2}
                          />
                          {conteudo}
                        </span>
                      </Link>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Icone className="size-3.5 shrink-0 text-ok" strokeWidth={2} />
                        {conteudo}
                      </span>
                    )}
                  </TabelaCell>
                  <TabelaCell className="text-text-muted">{l.detalhe}</TabelaCell>
                  <TabelaCell alinhar="direita">
                    <Money valor={l.valor} destaque={saida} />
                  </TabelaCell>
                  <TabelaCell alinhar="direita">
                    {l.romaneioHref && (
                      <Link
                        href={l.romaneioHref}
                        className="u-motion inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-text-muted opacity-70 hover:bg-surface-2 hover:text-text group-hover:opacity-100"
                      >
                        <Printer className="size-3.5" strokeWidth={1.5} />
                        Romaneio
                      </Link>
                    )}
                  </TabelaCell>
                </TabelaRow>
              )
            })}
          </TabelaBody>
        </Tabela>
      </div>

      {/* Mobile: cards */}
      <div className="space-y-2 lg:hidden">
        {visiveis.map((l) => {
          const saida = l.tipo === 'saida'
          const badge = l.tipoFulfillment
            ? badgeFulfillment(l.tipoFulfillment, l.concluidoEm ?? null)
            : null
          return (
            <CardLinha
              key={l.chave}
              href={l.href ?? undefined}
              titulo={
                <span className="flex items-center gap-2">
                  {l.descricao}
                  {l.numero && (
                    <span className="font-mono text-xs font-normal text-text-muted">
                      {l.numero}
                    </span>
                  )}
                </span>
              }
              destaque={<Money valor={l.valor} destaque={saida} />}
              campos={[
                {
                  label: 'Tipo',
                  valor: (
                    <StatusPill
                      status={saida ? 'critico' : 'ok'}
                      label={saida ? 'Saída' : 'Entrada'}
                    />
                  ),
                },
                { label: 'Data/hora', valor: dataHora(l.data) },
                { label: 'Detalhe', valor: l.detalhe },
                ...(badge
                  ? [{ label: 'Status', valor: <StatusPill status={badge.status} label={badge.label} /> }]
                  : []),
              ]}
            />
          )
        })}
      </div>

      {restantes > 0 && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setMostrar((m) => m + PASSO)}
            className="u-motion u-press inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-5 text-sm font-medium text-text hover:border-brand/50 hover:text-brand"
          >
            Ver mais
            <span className="font-mono text-xs tabular-nums text-text-muted">
              ({restantes})
            </span>
          </button>
        </div>
      )}
    </>
  )
}
