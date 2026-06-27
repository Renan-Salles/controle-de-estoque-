'use client'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Users } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/ui-kit/PageHeader'
import {
  Tabela,
  TabelaHead,
  TabelaHeadCell,
  TabelaBody,
  TabelaRow,
  TabelaCell,
} from '@/components/ui-kit/tabela'
import { EstadoVazio } from '@/components/ui-kit/EstadoVazio'
import type { Cargo } from '@/lib/nav-catalogo'
import {
  listarUsuariosComCargo,
  listarCargos,
  atualizarUsuario,
  type UsuarioComCargo,
} from '@/lib/actions/cargos'

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioComCargo[]>([])
  const [cargos, setCargos] = useState<Cargo[]>([])
  const [loading, setLoading] = useState(true)

  async function carregar() {
    setLoading(true)
    try {
      const [u, c] = await Promise.all([listarUsuariosComCargo(), listarCargos()])
      setUsuarios(u)
      setCargos(c)
    } catch {
      toast.error('Erro ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar()
  }, [])

  async function mudarCargo(id: string, cargo_id: string) {
    setUsuarios((us) => us.map((u) => (u.id === id ? { ...u, cargo_id } : u)))
    const r = await atualizarUsuario(id, { cargo_id })
    if (r.error) {
      toast.error(r.error)
      carregar()
    } else {
      toast.success('Cargo atualizado')
    }
  }

  async function mudarStatus(id: string, status: string) {
    setUsuarios((us) => us.map((u) => (u.id === id ? { ...u, status } : u)))
    const r = await atualizarUsuario(id, { status })
    if (r.error) {
      toast.error(r.error)
      carregar()
    } else {
      toast.success(status === 'ativo' ? 'Usuário ativado' : 'Usuário desativado')
    }
  }

  function SelectCargo({ u }: { u: UsuarioComCargo }) {
    return (
      <Select value={u.cargo_id ?? ''} onValueChange={(v) => v && mudarCargo(u.id, v)}>
        <SelectTrigger className="h-8 w-44">
          <SelectValue placeholder="Sem cargo" />
        </SelectTrigger>
        <SelectContent>
          {cargos.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  function SelectStatus({ u }: { u: UsuarioComCargo }) {
    return (
      <Select value={u.status ?? 'ativo'} onValueChange={(v) => v && mudarStatus(u.id, v)}>
        <SelectTrigger className="h-8 w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ativo">Ativo</SelectItem>
          <SelectItem value="inativo">Inativo</SelectItem>
        </SelectContent>
      </Select>
    )
  }

  return (
    <div className="px-6 py-5">
      <PageHeader titulo="Usuários" subtitulo="Defina o cargo e o acesso de cada pessoa." />

      {loading ? null : usuarios.length === 0 ? (
        <EstadoVazio icone={Users} titulo="Nenhum usuário" descricao="Ninguém cadastrado ainda." />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden lg:block">
            <Tabela>
              <TabelaHead>
                <tr>
                  <TabelaHeadCell>Nome</TabelaHeadCell>
                  <TabelaHeadCell>Email</TabelaHeadCell>
                  <TabelaHeadCell>Cargo</TabelaHeadCell>
                  <TabelaHeadCell>Status</TabelaHeadCell>
                </tr>
              </TabelaHead>
              <TabelaBody>
                {usuarios.map((u) => (
                  <TabelaRow key={u.id}>
                    <TabelaCell className="font-medium">{u.nome ?? '-'}</TabelaCell>
                    <TabelaCell className="text-text-muted">{u.email ?? '-'}</TabelaCell>
                    <TabelaCell>
                      <SelectCargo u={u} />
                    </TabelaCell>
                    <TabelaCell>
                      <SelectStatus u={u} />
                    </TabelaCell>
                  </TabelaRow>
                ))}
              </TabelaBody>
            </Tabela>
          </div>

          {/* Mobile */}
          <div className="space-y-2 lg:hidden">
            {usuarios.map((u) => (
              <div key={u.id} className="rounded-lg border border-border bg-surface p-3">
                <p className="font-medium text-text">{u.nome ?? '-'}</p>
                <p className="text-[13px] text-text-muted">{u.email ?? '-'}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <SelectCargo u={u} />
                  <SelectStatus u={u} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
