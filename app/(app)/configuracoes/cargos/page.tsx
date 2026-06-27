'use client'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, ShieldCheck, Pencil, Trash2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
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
import { CardLinha } from '@/components/ui-kit/CardLinha'
import { NAV_CATALOGO, type Cargo } from '@/lib/nav-catalogo'
import {
  listarCargos,
  criarCargo,
  atualizarCargo,
  excluirCargo,
} from '@/lib/actions/cargos'

// Catálogo agrupado para os checkboxes.
const GRUPOS_CATALOGO = Array.from(
  NAV_CATALOGO.reduce((m, i) => {
    const arr = m.get(i.grupo) ?? []
    arr.push(i)
    m.set(i.grupo, arr)
    return m
  }, new Map<string, typeof NAV_CATALOGO>()),
)

type FormState = {
  nome: string
  admin: boolean
  itens: Set<string>
}

export default function CargosPage() {
  const [cargos, setCargos] = useState<Cargo[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editando, setEditando] = useState<Cargo | null>(null)
  const [form, setForm] = useState<FormState>({ nome: '', admin: false, itens: new Set() })

  async function carregar() {
    setLoading(true)
    try {
      setCargos(await listarCargos())
    } catch {
      toast.error('Erro ao carregar cargos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar()
  }, [])

  function abrirNovo() {
    setEditando(null)
    setForm({ nome: '', admin: false, itens: new Set() })
    setSheetOpen(true)
  }

  function abrirEdicao(c: Cargo) {
    setEditando(c)
    setForm({ nome: c.nome, admin: c.admin, itens: new Set(c.itens_visiveis) })
    setSheetOpen(true)
  }

  function toggleItem(href: string) {
    setForm((f) => {
      const itens = new Set(f.itens)
      if (itens.has(href)) itens.delete(href)
      else itens.add(href)
      return { ...f, itens }
    })
  }

  function toggleGrupo(hrefs: string[], marcar: boolean) {
    setForm((f) => {
      const itens = new Set(f.itens)
      hrefs.forEach((h) => (marcar ? itens.add(h) : itens.delete(h)))
      return { ...f, itens }
    })
  }

  async function salvar() {
    if (!form.nome.trim()) {
      toast.error('Informe o nome do cargo')
      return
    }
    setSalvando(true)
    const payload = {
      nome: form.nome,
      admin: form.admin,
      itens_visiveis: form.admin ? [] : Array.from(form.itens),
    }
    const r = editando
      ? await atualizarCargo(editando.id, payload)
      : await criarCargo(payload)
    setSalvando(false)
    if (r.error) {
      toast.error(r.error)
      return
    }
    toast.success(editando ? 'Cargo atualizado' : 'Cargo criado')
    setSheetOpen(false)
    carregar()
  }

  async function excluir(c: Cargo) {
    if (!confirm(`Excluir o cargo "${c.nome}"?`)) return
    const r = await excluirCargo(c.id)
    if (r.error) {
      toast.error(r.error)
      return
    }
    toast.success('Cargo excluído')
    carregar()
  }

  const totalItens = NAV_CATALOGO.length

  return (
    <div className="px-6 py-5">
      <PageHeader titulo="Cargos e permissões" subtitulo="Defina o que cada cargo enxerga na sidebar.">
        <button
          type="button"
          onClick={abrirNovo}
          className="u-motion u-press inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3.5 text-sm font-medium text-white hover:bg-brand-strong"
        >
          <Plus className="size-4" strokeWidth={1.5} />
          Novo cargo
        </button>
      </PageHeader>

      {loading ? null : cargos.length === 0 ? (
        <EstadoVazio icone={ShieldCheck} titulo="Nenhum cargo" descricao="Crie o primeiro cargo." />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden lg:block">
            <Tabela>
              <TabelaHead>
                <tr>
                  <TabelaHeadCell>Cargo</TabelaHeadCell>
                  <TabelaHeadCell>Acesso</TabelaHeadCell>
                  <TabelaHeadCell alinhar="direita">Botões visíveis</TabelaHeadCell>
                  <TabelaHeadCell alinhar="direita"></TabelaHeadCell>
                </tr>
              </TabelaHead>
              <TabelaBody>
                {cargos.map((c) => (
                  <TabelaRow key={c.id}>
                    <TabelaCell className="font-medium">{c.nome}</TabelaCell>
                    <TabelaCell>
                      {c.admin ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-medium text-brand">
                          <ShieldCheck className="size-3" strokeWidth={2} />
                          Acesso total
                        </span>
                      ) : (
                        <span className="text-text-muted">Restrito</span>
                      )}
                    </TabelaCell>
                    <TabelaCell alinhar="direita" className="text-text-muted">
                      {c.admin ? `todos (${totalItens})` : `${c.itens_visiveis.length} de ${totalItens}`}
                    </TabelaCell>
                    <TabelaCell alinhar="direita">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => abrirEdicao(c)}
                          className="u-motion u-press inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 text-[13px] font-medium text-text hover:border-brand/50 hover:text-brand"
                        >
                          <Pencil className="size-3.5" strokeWidth={1.5} />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => excluir(c)}
                          className="u-motion u-press inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 text-[13px] font-medium text-text hover:border-err/50 hover:text-err"
                        >
                          <Trash2 className="size-3.5" strokeWidth={1.5} />
                        </button>
                      </div>
                    </TabelaCell>
                  </TabelaRow>
                ))}
              </TabelaBody>
            </Tabela>
          </div>

          {/* Mobile */}
          <div className="space-y-2 lg:hidden">
            {cargos.map((c) => (
              <CardLinha
                key={c.id}
                titulo={c.nome}
                destaque={
                  c.admin ? (
                    <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-medium text-brand">
                      Acesso total
                    </span>
                  ) : undefined
                }
                campos={[
                  {
                    label: 'Botões',
                    valor: c.admin ? `todos (${totalItens})` : `${c.itens_visiveis.length} de ${totalItens}`,
                  },
                ]}
                acoes={
                  <>
                    <button
                      type="button"
                      onClick={() => abrirEdicao(c)}
                      className="u-motion u-press inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-surface-2 text-[13px] font-medium text-text"
                    >
                      <Pencil className="size-3.5" strokeWidth={1.5} />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => excluir(c)}
                      className="u-motion u-press inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 text-[13px] font-medium text-text"
                    >
                      <Trash2 className="size-3.5" strokeWidth={1.5} />
                    </button>
                  </>
                }
              />
            ))}
          </div>
        </>
      )}

      {/* Sheet de criar/editar */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="flex w-full flex-col sm:max-w-md">
          <SheetHeader className="border-b border-border">
            <SheetTitle>{editando ? 'Editar cargo' : 'Novo cargo'}</SheetTitle>
            <p className="text-[13px] text-text-muted">
              Marque os botões que esse cargo vê na sidebar.
            </p>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                Nome do cargo
              </label>
              <Input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex.: Entregador"
                autoFocus
              />
            </div>

            <label className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 p-3">
              <input
                type="checkbox"
                checked={form.admin}
                onChange={(e) => setForm((f) => ({ ...f, admin: e.target.checked }))}
                className="size-4 accent-brand"
              />
              <div>
                <p className="text-sm font-medium text-text">Acesso total (admin)</p>
                <p className="text-[12px] text-text-muted">
                  Vê tudo e pode configurar usuários e cargos.
                </p>
              </div>
            </label>

            {!form.admin && (
              <div className="flex flex-col gap-4">
                {GRUPOS_CATALOGO.map(([grupo, itens]) => {
                  const hrefs = itens.map((i) => i.href)
                  const todosMarcados = hrefs.every((h) => form.itens.has(h))
                  return (
                    <div key={grupo}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                          {grupo}
                        </p>
                        <button
                          type="button"
                          onClick={() => toggleGrupo(hrefs, !todosMarcados)}
                          className="text-[11px] font-medium text-brand hover:underline"
                        >
                          {todosMarcados ? 'Desmarcar' : 'Marcar todos'}
                        </button>
                      </div>
                      <div className="space-y-1">
                        {itens.map((i) => (
                          <label
                            key={i.href}
                            className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-surface-2"
                          >
                            <input
                              type="checkbox"
                              checked={form.itens.has(i.href)}
                              onChange={() => toggleItem(i.href)}
                              className="size-4 accent-brand"
                            />
                            <span className="text-sm text-text">{i.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="u-motion u-press mt-1 inline-flex h-10 w-full items-center justify-center rounded-lg bg-brand text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar cargo'}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
