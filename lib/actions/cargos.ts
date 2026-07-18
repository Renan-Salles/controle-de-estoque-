'use server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCargoUsuario } from '@/lib/permissoes'
import { getLocalAtivoId } from '@/lib/local'
import { revalidatePath } from 'next/cache'
import type { Cargo } from '@/lib/nav-catalogo'

// Só admin pode mexer em cargos/usuários (defesa no servidor, além da UI).
async function ehAdmin() {
  const c = await getCargoUsuario()
  return !!c?.admin
}

export async function listarCargos(): Promise<Cargo[]> {
  const s = await createServiceClient()
  const { data } = await s
    .from('cargos')
    .select('id, nome, admin, itens_visiveis, ativo')
    .order('admin', { ascending: false })
    .order('nome')
  return (data ?? []) as unknown as Cargo[]
}

export type UsuarioComCargo = {
  id: string
  nome: string | null
  email: string | null
  status: string | null
  cargo_id: string | null
  telefone: string | null
}

export async function listarUsuariosComCargo(): Promise<UsuarioComCargo[]> {
  const s = await createServiceClient()
  const { data } = await s
    .from('profiles')
    .select('id, nome, email, status, cargo_id, telefone')
    .order('created_at')
  return (data ?? []) as unknown as UsuarioComCargo[]
}

// Pra escolher "quem vai entregar" numa venda: só gente ativa que pode
// atender o local dessa venda (local_id nulo = sem restrição, mesma regra
// de getLocalAtivo/rotaPermitida). listarUsuariosComCargo() acima é usada
// sem esse filtro na tela de Equipe (admin precisa ver todo mundo, dos
// dois locais, pra gerenciar) -- não dá pra reusar ela aqui.
export async function listarEntregadoresElegiveis(localId?: string): Promise<UsuarioComCargo[]> {
  const local = localId ?? (await getLocalAtivoId())
  const s = await createServiceClient()
  const { data } = await s
    .from('profiles')
    .select('id, nome, email, status, cargo_id, telefone, local_id')
    .eq('status', 'ativo')
    .or(`local_id.is.null,local_id.eq.${local}`)
    .order('nome')
  return (data ?? []) as unknown as UsuarioComCargo[]
}

export async function criarCargo(input: {
  nome: string
  admin: boolean
  itens_visiveis: string[]
}) {
  if (!(await ehAdmin())) return { error: 'Sem permissão' }
  if (!input.nome.trim()) return { error: 'Informe o nome do cargo' }
  const s = await createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (s.from('cargos') as any).insert({
    nome: input.nome.trim(),
    admin: !!input.admin,
    itens_visiveis: input.itens_visiveis ?? [],
  })
  if (error) return { error: error.message }
  revalidatePath('/configuracoes/cargos')
  return { success: true }
}

export async function atualizarCargo(
  id: string,
  input: { nome?: string; admin?: boolean; itens_visiveis?: string[]; ativo?: boolean },
) {
  if (!(await ehAdmin())) return { error: 'Sem permissão' }
  const s = await createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: any = {}
  if (input.nome !== undefined) patch.nome = input.nome.trim()
  if (input.admin !== undefined) patch.admin = !!input.admin
  if (input.itens_visiveis !== undefined) patch.itens_visiveis = input.itens_visiveis
  if (input.ativo !== undefined) patch.ativo = !!input.ativo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error, count } = await (s.from('cargos') as any).update(patch, { count: 'exact' }).eq('id', id)
  if (error) return { error: error.message }
  if (count === 0) return { error: 'Cargo não encontrado.' }
  revalidatePath('/configuracoes/cargos')
  return { success: true }
}

export async function excluirCargo(id: string) {
  if (!(await ehAdmin())) return { error: 'Sem permissão' }
  const s = await createServiceClient()
  // Não exclui cargo com usuários vinculados (evita deixar gente sem cargo).
  const { count: vinculados } = await s
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('cargo_id', id)
  if (vinculados && vinculados > 0)
    return { error: 'Esse cargo tem usuários. Mude-os de cargo antes de excluir.' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error, count } = await (s.from('cargos') as any).delete({ count: 'exact' }).eq('id', id)
  if (error) return { error: error.message }
  if (count === 0) return { error: 'Cargo não encontrado.' }
  revalidatePath('/configuracoes/cargos')
  return { success: true }
}

export async function atualizarUsuario(
  id: string,
  input: { cargo_id?: string | null; status?: string; telefone?: string | null },
) {
  if (!(await ehAdmin())) return { error: 'Sem permissão' }
  const s = await createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: any = {}
  if (input.cargo_id !== undefined) patch.cargo_id = input.cargo_id
  if (input.status !== undefined) patch.status = input.status
  if (input.telefone !== undefined) patch.telefone = input.telefone?.trim() || null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error, count } = await (s.from('profiles') as any).update(patch, { count: 'exact' }).eq('id', id)
  if (error) return { error: error.message }
  if (count === 0) return { error: 'Usuário não encontrado.' }
  revalidatePath('/configuracoes/usuarios')
  return { success: true }
}
