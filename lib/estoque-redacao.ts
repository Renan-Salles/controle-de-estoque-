// custo_medio/valor_total de v_posicao_estoque (custo de produto e valor
// agregado de estoque) so quem pode ver dado financeiro enxerga -- mesmo
// principio das outras telas dessa feature (ver
// .superpowers/sdd/final-review-fixes-report.md, Grupo E). Ausentes (nao
// zerados), pra nao passar a impressao de "custo zero"/"sem valor em
// estoque" pra quem so nao tem permissao de ver.
//
// Implementacao unica, usada por buscarPosicaoEstoque() e buscarReposicao()
// (lib/actions/estoque.ts) e buscarPosicaoProdutos() (lib/actions/produtos.ts)
// -- nao pode viver num arquivo 'use server' (server actions so podem
// exportar funcao async), por isso arquivo proprio.

type ComCustoEstoque = {
  custo_medio?: number | null
  valor_total?: number | null
}

export function redigirCustoEstoque<T extends ComCustoEstoque>(linha: T, podeVerFinanceiro: boolean): T
export function redigirCustoEstoque<T extends ComCustoEstoque>(linhas: T[], podeVerFinanceiro: boolean): T[]
export function redigirCustoEstoque<T extends ComCustoEstoque>(
  linhaOuLinhas: T | T[],
  podeVerFinanceiro: boolean,
): T | T[] {
  const redigirUma = (l: T): T => {
    if (podeVerFinanceiro) return l
    const { custo_medio: _custoMedio, valor_total: _valorTotal, ...resto } = l
    return resto as T
  }
  return Array.isArray(linhaOuLinhas) ? linhaOuLinhas.map(redigirUma) : redigirUma(linhaOuLinhas)
}
