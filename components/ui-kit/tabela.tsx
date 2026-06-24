import type {
  ReactNode,
  TableHTMLAttributes,
  HTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react'
import { cn } from '@/lib/utils'

// Primitivas de tabela do sistema. Wrappers finos de <table> com o padrão do
// DESIGN_SPEC: header sticky uppercase muted, divide-y, hover surface-2, h-12,
// números à direita em mono. Use `alinhar="direita"` nas células de valor.

export function Tabela({
  className,
  children,
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="u-stagger overflow-clip rounded-lg border border-border bg-surface">
      <div className="overflow-x-auto">
        <table
          className={cn('w-full border-collapse text-sm', className)}
          {...props}
        >
          {children}
        </table>
      </div>
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
        'sticky top-0 z-10 bg-surface shadow-[0_1px_0_var(--border)]',
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
  children,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & {
  alinhar?: 'esquerda' | 'direita' | 'centro'
}) {
  return (
    <th
      className={cn(
        'h-10 px-4 text-[11px] font-semibold uppercase tracking-wider text-text-muted',
        alinhar === 'direita' && 'text-right',
        alinhar === 'centro' && 'text-center',
        alinhar === 'esquerda' && 'text-left',
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
        'u-motion hover:bg-surface-2',
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
  children,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & {
  alinhar?: 'esquerda' | 'direita' | 'centro'
  mono?: boolean
}) {
  return (
    <td
      className={cn(
        'h-12 px-4 align-middle text-text',
        alinhar === 'direita' && 'text-right',
        alinhar === 'centro' && 'text-center',
        (mono || alinhar === 'direita') && 'font-mono tabular-nums',
        className,
      )}
      {...props}
    >
      {children}
    </td>
  )
}
