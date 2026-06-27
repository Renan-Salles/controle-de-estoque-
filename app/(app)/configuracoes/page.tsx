import Link from 'next/link'
import { Users, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/components/ui-kit/PageHeader'

const CARDS = [
  {
    href: '/configuracoes/usuarios',
    icone: Users,
    titulo: 'Usuários',
    descricao: 'Quem tem acesso, o cargo de cada um e ativar/desativar.',
  },
  {
    href: '/configuracoes/cargos',
    icone: ShieldCheck,
    titulo: 'Cargos e permissões',
    descricao: 'Crie cargos e escolha quais botões cada um enxerga na sidebar.',
  },
]

export default function ConfiguracoesPage() {
  return (
    <div className="px-6 py-5">
      <PageHeader
        titulo="Configurações"
        subtitulo="Administração de acesso ao sistema."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {CARDS.map((c) => {
          const Icone = c.icone
          return (
            <Link
              key={c.href}
              href={c.href}
              className="u-motion u-press group rounded-xl border border-border bg-surface p-5 hover:border-brand/50"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <Icone className="size-5" strokeWidth={1.5} />
                </span>
                <h2 className="text-sm font-semibold text-text group-hover:text-brand">
                  {c.titulo}
                </h2>
              </div>
              <p className="mt-3 text-[13px] text-text-muted">{c.descricao}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
