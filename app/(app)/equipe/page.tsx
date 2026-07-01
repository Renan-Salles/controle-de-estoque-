'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Users, Copy, Trash2, UserPlus, Check } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { PageHeader } from '@/components/ui-kit/PageHeader'
import { btnClass } from '@/components/ui-kit/Button'
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
import type { Local } from '@/lib/local'
import {
  listarUsuariosComCargo,
  listarCargos,
  atualizarUsuario,
  type UsuarioComCargo,
} from '@/lib/actions/cargos'
import {
  criarConvite,
  listarConvitesPendentes,
  revogarConvite,
  listarLocaisParaConvite,
  type ConvitePendente,
} from '@/lib/actions/convites'

function formatarValidade(expiraEm: string) {
  const dias = Math.max(0, Math.ceil((new Date(expiraEm).getTime() - Date.now()) / 86400000))
  return dias <= 0 ? 'expira hoje' : `expira em ${dias} ${dias === 1 ? 'dia' : 'dias'}`
}

export default function EquipePage() {
  const [usuarios, setUsuarios] = useState<UsuarioComCargo[]>([])
  const [cargos, setCargos] = useState<Cargo[]>([])
  const [locais, setLocais] = useState<Local[]>([])
  const [convites, setConvites] = useState<ConvitePendente[]>([])
  const [loading, setLoading] = useState(true)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [cargoConvite, setCargoConvite] = useState('')
  const [localConvite, setLocalConvite] = useState('')
  const [gerando, setGerando] = useState(false)
  const [linkGerado, setLinkGerado] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  async function carregar() {
    setLoading(true)
    try {
      const [u, c, l, cv] = await Promise.all([
        listarUsuariosComCargo(),
        listarCargos(),
        listarLocaisParaConvite(),
        listarConvitesPendentes(),
      ])
      setUsuarios(u)
      setCargos(c)
      setLocais(l)
      setConvites(cv)
    } catch {
      toast.error('Erro ao carregar equipe')
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
      toast.success(status === 'ativo' ? 'Pessoa ativada' : 'Pessoa desativada')
    }
  }

  function abrirConvite() {
    setCargoConvite('')
    setLocalConvite('')
    setLinkGerado(null)
    setCopiado(false)
    setSheetOpen(true)
  }

  async function gerarConvite() {
    if (!cargoConvite || !localConvite) {
      toast.error('Escolha o cargo e o local')
      return
    }
    setGerando(true)
    const r = await criarConvite(cargoConvite, localConvite)
    setGerando(false)
    if ('error' in r) {
      toast.error(r.error)
      return
    }
    setLinkGerado(`${window.location.origin}/convite/${r.token}`)
    carregar()
  }

  async function copiarLink() {
    if (!linkGerado) return
    await navigator.clipboard.writeText(linkGerado)
    setCopiado(true)
    toast.success('Link copiado')
  }

  async function revogar(id: string) {
    setConvites((cs) => cs.filter((c) => c.id !== id))
    const r = await revogarConvite(id)
    if (r.error) {
      toast.error(r.error)
      carregar()
    } else {
      toast.success('Convite revogado')
    }
  }

  function SelectCargo({ u }: { u: UsuarioComCargo }) {
    return (
      <Select value={u.cargo_id ?? ''} onValueChange={(v) => v && mudarCargo(u.id, v)}>
        <SelectTrigger className="h-8 w-44">
          <SelectValue placeholder="Sem cargo">
            {(v: string) => cargos.find((c) => c.id === v)?.nome ?? v}
          </SelectValue>
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
          <SelectValue>{(v: string) => (v === 'ativo' ? 'Ativo' : 'Inativo')}</SelectValue>
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
      <PageHeader titulo="Equipe" subtitulo="Pessoas com acesso ao sistema, cargo e convites.">
        <button type="button" onClick={abrirConvite} className={btnClass('primary')}>
          <UserPlus className="size-4" strokeWidth={1.5} />
          Convidar
        </button>
      </PageHeader>

      {loading ? null : usuarios.length === 0 ? (
        <EstadoVazio icone={Users} titulo="Nenhuma pessoa" descricao="Convide a primeira pessoa da equipe." />
      ) : (
        <>
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

      {!loading && convites.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-text">Convites pendentes</h2>
          <div className="space-y-2">
            {convites.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3"
              >
                <div>
                  <p className="text-sm font-medium text-text">
                    {c.cargos?.nome ?? 'Cargo removido'} · {c.locais?.nome ?? 'Local removido'}
                  </p>
                  <p className="text-[13px] text-text-muted">{formatarValidade(c.expira_em)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => revogar(c.id)}
                  className="u-motion u-press inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 text-[13px] font-medium text-text hover:border-err/50 hover:text-err"
                >
                  <Trash2 className="size-3.5" strokeWidth={1.5} />
                  Revogar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader className="border-b border-border">
            <SheetTitle>Convidar pessoa</SheetTitle>
            <p className="text-[13px] text-text-muted">
              Escolha o cargo e o local. Depois é só copiar o link e mandar pra pessoa.
            </p>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
            {!linkGerado ? (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                    Cargo
                  </label>
                  <Select value={cargoConvite} onValueChange={(v) => v && setCargoConvite(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione...">
                        {(v: string) => cargos.find((c) => c.id === v)?.nome ?? v}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {cargos.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                    Local
                  </label>
                  <Select value={localConvite} onValueChange={(v) => v && setLocalConvite(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione...">
                        {(v: string) => locais.find((l) => l.id === v)?.nome ?? v}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {locais.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <button
                  type="button"
                  onClick={gerarConvite}
                  disabled={gerando}
                  className="u-motion u-press mt-1 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-medium text-white hover:bg-brand-strong disabled:pointer-events-none disabled:opacity-50"
                >
                  {gerando ? 'Gerando...' : 'Gerar link de convite'}
                </button>
              </>
            ) : (
              <>
                <div className="rounded-lg border border-brand/30 bg-brand/[0.07] p-3">
                  <p className="text-[13px] text-text-muted">Link do convite</p>
                  <p className="mt-1 break-all font-mono text-sm text-text">{linkGerado}</p>
                </div>
                <button
                  type="button"
                  onClick={copiarLink}
                  className="u-motion u-press inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-medium text-white hover:bg-brand-strong"
                >
                  {copiado ? (
                    <Check className="size-4" strokeWidth={1.5} />
                  ) : (
                    <Copy className="size-4" strokeWidth={1.5} />
                  )}
                  {copiado ? 'Copiado' : 'Copiar link'}
                </button>
                <p className="text-center text-[13px] text-text-muted">
                  Válido por 7 dias, uso único. Mande esse link direto pra pessoa.
                </p>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
