import { Landmark } from 'lucide-react'
import { PageHeader } from '@/components/ui-kit/PageHeader'
import { EstadoVazio } from '@/components/ui-kit/EstadoVazio'
import {
  Tabela,
  TabelaHead,
  TabelaHeadCell,
  TabelaBody,
  TabelaRow,
  TabelaCell,
} from '@/components/ui-kit/tabela'
import { Money } from '@/components/ui-kit/Money'
import { FormFechamento } from '@/components/caixa/FormFechamento'
import { listarFechamentos, fechamentoDeHoje } from '@/lib/actions/caixa'
import { formatarData, formatarReal } from '@/lib/formatos'
import { cn } from '@/lib/utils'
import { getCargoUsuario } from '@/lib/permissoes'

export default async function CaixaPage() {
  const [fechamentos, deHoje, cargo] = await Promise.all([
    listarFechamentos(30),
    fechamentoDeHoje(),
    getCargoUsuario(),
  ])
  const podeVerEsperado = !cargo || cargo.admin

  return (
    <div className="mx-auto max-w-3xl px-6 py-5">
      <PageHeader
        titulo="Caixa"
        subtitulo="Fechamento diário: conte a gaveta e confira com o que o sistema esperava."
      />

      <FormFechamento jaFechouHoje={!!deHoje} />

      <h2 className="mb-3 mt-8 text-sm font-semibold text-text">Fechamentos anteriores</h2>
      {fechamentos.length === 0 ? (
        <EstadoVazio
          icone={Landmark}
          titulo="Nenhum fechamento ainda"
          descricao="O primeiro fechamento de caixa aparece aqui."
        />
      ) : (
        <Tabela minWidth={podeVerEsperado ? 560 : 360}>
          <TabelaHead>
            <tr>
              <TabelaHeadCell>Data</TabelaHeadCell>
              {podeVerEsperado && <TabelaHeadCell alinhar="direita">Esperado</TabelaHeadCell>}
              <TabelaHeadCell alinhar="direita">Contado</TabelaHeadCell>
              {podeVerEsperado && <TabelaHeadCell alinhar="direita">Diferença</TabelaHeadCell>}
              <TabelaHeadCell>Por</TabelaHeadCell>
            </tr>
          </TabelaHead>
          <TabelaBody>
            {fechamentos.map((f) => {
              const temEsperado = 'diferenca' in f
              const ok = temEsperado && Math.abs(f.diferenca) < 0.005
              return (
                <TabelaRow key={f.id}>
                  <TabelaCell mono className="text-text-muted">
                    {formatarData(f.data)}
                  </TabelaCell>
                  {podeVerEsperado && temEsperado && (
                    <TabelaCell alinhar="direita">
                      <Money valor={f.esperado_dinheiro} />
                    </TabelaCell>
                  )}
                  <TabelaCell alinhar="direita">
                    <Money valor={f.dinheiro_contado} />
                  </TabelaCell>
                  {podeVerEsperado && temEsperado && (
                    <TabelaCell alinhar="direita">
                      <span
                        className={cn(
                          'font-mono text-sm font-semibold tabular-nums',
                          ok ? 'text-ok' : f.diferenca > 0 ? 'text-info' : 'text-err',
                        )}
                      >
                        {f.diferenca > 0 ? '+' : ''}
                        {formatarReal(f.diferenca)}
                      </span>
                    </TabelaCell>
                  )}
                  <TabelaCell className="text-text-muted">
                    {f.fechado_por_nome ?? '-'}
                  </TabelaCell>
                </TabelaRow>
              )
            })}
          </TabelaBody>
        </Tabela>
      )}
    </div>
  )
}
