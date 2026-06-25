'use client'

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
  type TableHTMLAttributes,
  type HTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from 'react'
import { cn } from '@/lib/utils'

// Primitivas de tabela do sistema. Wrappers finos de <table> com o padrão do
// DESIGN_SPEC: header sticky uppercase muted, divide-y, hover surface-2, h-12,
// números à direita em mono. Use `alinhar="direita"` nas células de valor.
//
// Mobile: o container rola na horizontal com uma largura mínima legível. Quando
// a tabela transborda, surge um indicador sutil "deslize para ver mais" na borda
// direita (some ao chegar no fim). A 1ª coluna pode ser fixada com `fixa` em
// TabelaHeadCell/TabelaCell para não perder a referência ao rolar.

export function Tabela({
  className,
  children,
  minWidth = 640,
  ...props
}: TableHTMLAttributes<HTMLTableElement> & {
  // Largura mínima da tabela (px) para manter as colunas legíveis no celular.
  // Abaixo disso, o container rola horizontalmente.
  minWidth?: number
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // Mostra o gradiente/dica de scroll só quando há conteúdo escondido à direita.
  const [transbordaDireita, setTransbordaDireita] = useState(false)

  const recalcular = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    // 1px de folga para evitar flicker por arredondamento.
    const temMais = el.scrollWidth - el.clientWidth - el.scrollLeft > 1
    setTransbordaDireita(temMais)
  }, [])

  useEffect(() => {
    recalcular()
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(recalcular)
    ro.observe(el)
    window.addEventListener('resize', recalcular)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', recalcular)
    }
  }, [recalcular])

  return (
    <div className="u-stagger relative overflow-clip rounded-lg border border-border bg-surface">
      <div
        ref={scrollRef}
        onScroll={recalcular}
        className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]"
      >
        <table
          style={{ minWidth }}
          className={cn('w-full border-collapse text-sm', className)}
          {...props}
        >
          {children}
        </table>
      </div>

      {/* Indicador "deslize para ver mais": gradiente na borda direita.
          pointer-events-none para não atrapalhar o toque/scroll. */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-surface to-transparent u-motion lg:hidden',
          transbordaDireita ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  )
}

export function TabelaHead({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        'sticky top-0 z-20 bg-surface shadow-[0_1px_0_var(--border)]',
        className,
      )}
      {...props}
    >
      {children}
    </thead>
  )
}

export function TabelaHeadCell({
  className,
  alinhar = 'esquerda',
  fixa = false,
  children,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & {
  alinhar?: 'esquerda' | 'direita' | 'centro'
  // Fixa a coluna (1ª, normalmente produto/descrição) ao rolar na horizontal.
  fixa?: boolean
}) {
  return (
    <th
      className={cn(
        'h-10 px-4 text-[11px] font-semibold uppercase tracking-wider text-text-muted',
        alinhar === 'direita' && 'text-right',
        alinhar === 'centro' && 'text-center',
        alinhar === 'esquerda' && 'text-left',
        // z-30 para ficar acima do thead sticky (z-20) e das células fixas (z-10).
        fixa &&
          'sticky left-0 z-30 bg-surface after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border/60',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  )
}

export function TabelaBody({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn('divide-y divide-border/60', className)}
      {...props}
    >
      {children}
    </tbody>
  )
}

export function TabelaRow({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        // `group` permite que a célula fixa herde o hover da linha inteira.
        'group/row u-motion hover:bg-surface-2',
        props.onClick && 'cursor-pointer',
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  )
}

export function TabelaCell({
  className,
  alinhar = 'esquerda',
  mono = false,
  fixa = false,
  children,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & {
  alinhar?: 'esquerda' | 'direita' | 'centro'
  mono?: boolean
  // Fixa a coluna ao rolar na horizontal. Use na 1ª célula (produto/descrição).
  fixa?: boolean
}) {
  return (
    <td
      className={cn(
        'h-12 px-4 align-middle text-text',
        alinhar === 'direita' && 'text-right',
        alinhar === 'centro' && 'text-center',
        (mono || alinhar === 'direita') && 'font-mono tabular-nums',
        // Coluna fixa: fundo opaco (senão o conteúdo rolado aparece por baixo) e
        // borda divisória à direita. Acompanha o hover da linha via group/row.
        fixa &&
          'sticky left-0 z-10 bg-surface group-hover/row:bg-surface-2 after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border/60',
        className,
      )}
      {...props}
    >
      {children}
    </td>
  )
}

export type { ReactNode }
