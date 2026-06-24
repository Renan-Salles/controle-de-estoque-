import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Peças de formulário premium do sistema (label acima, gap-2, erro inline).
// Estética do DESIGN_SPEC: seções com título, campos respiráveis, sem cards
// soltos demais. Usado nos cadastros (Produtos, Clientes, Fornecedores).

// Seção do formulário: título uppercase muted + descrição opcional + grid de
// campos. Separação por linha (divide), não por caixas empilhadas.
export function FormSection({
  titulo,
  descricao,
  children,
  className,
}: {
  titulo: string
  descricao?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className="grid gap-5 border-t border-border py-7 first:border-t-0 first:pt-0 md:grid-cols-[200px_1fr] md:gap-8">
      <div className="md:pt-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          {titulo}
        </h2>
        {descricao && (
          <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted/80">
            {descricao}
          </p>
        )}
      </div>
      <div className={cn('grid gap-4 sm:grid-cols-2', className)}>{children}</div>
    </section>
  )
}

// Bloco de campo: label acima, controle, helper opcional e erro inline.
export function Campo({
  label,
  obrigatorio,
  erro,
  ajuda,
  full,
  children,
}: {
  label: string
  obrigatorio?: boolean
  erro?: string
  ajuda?: string
  full?: boolean
  children: ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-2', full && 'sm:col-span-2')}>
      <label className="text-[13px] font-medium text-text">
        {label}
        {obrigatorio && <span className="ml-0.5 text-err">*</span>}
      </label>
      {children}
      {erro ? (
        <p className="text-xs text-err">{erro}</p>
      ) : ajuda ? (
        <p className="text-xs text-text-muted/80">{ajuda}</p>
      ) : null}
    </div>
  )
}
