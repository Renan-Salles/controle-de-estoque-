export const CATEGORIAS = [
  'aluguel', 'salario', 'energia', 'agua', 'telefone',
  'internet', 'combustivel', 'manutencao', 'contabilidade', 'impostos', 'outros',
] as const

export const RECORRENCIAS = ['mensal', 'anual', 'unico'] as const

export const LABEL_CAT: Record<string, string> = {
  aluguel: 'Aluguel', salario: 'Salário', energia: 'Energia', agua: 'Água',
  telefone: 'Telefone', internet: 'Internet', combustivel: 'Combustível',
  manutencao: 'Manutenção', contabilidade: 'Contabilidade',
  impostos: 'Impostos', outros: 'Outros',
}

export const LABEL_REC: Record<string, string> = {
  mensal: 'Mensal', anual: 'Anual', unico: 'Único',
}
