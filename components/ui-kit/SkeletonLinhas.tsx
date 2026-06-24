// Skeleton de linhas de tabela, casado com o layout de <Tabela>.
// Renderiza N linhas x M colunas de placeholders com shimmer.

export function SkeletonLinhas({
  colunas = 4,
  linhas = 6,
}: {
  colunas?: number
  linhas?: number
}) {
  return (
    <div className="overflow-clip rounded-lg border border-border bg-surface">
      {/* Cabeçalho fantasma */}
      <div className="flex h-10 items-center gap-4 border-b border-border bg-surface px-4">
        {Array.from({ length: colunas }).map((_, c) => (
          <div
            key={`h-${c}`}
            className="skeleton h-2.5"
            style={{ width: c === 0 ? '40%' : '14%' }}
          />
        ))}
      </div>
      {/* Linhas */}
      <div className="divide-y divide-border/60">
        {Array.from({ length: linhas }).map((_, r) => (
          <div key={`r-${r}`} className="flex h-12 items-center gap-4 px-4">
            {Array.from({ length: colunas }).map((_, c) => (
              <div
                key={`c-${r}-${c}`}
                className="skeleton h-3"
                style={{
                  width: c === 0 ? '45%' : `${10 + ((r + c) % 3) * 4}%`,
                  opacity: 0.7,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
