import type { EstadoSimulacao } from '../../api/cliente'

const ETAPAS: { estado: EstadoSimulacao; rotulo: string }[] = [
  { estado: 'na_fila', rotulo: 'Na fila' },
  { estado: 'validando', rotulo: 'Validação do arquivo' },
  { estado: 'dias_de_projeto', rotulo: 'Dias de projeto' },
  { estado: 'anual', rotulo: 'Simulação anual' },
]

/** Lista das etapas da simulação, marcando a que está em andamento. */
export function Etapas({ estado }: { estado: EstadoSimulacao }) {
  const atual =
    estado === 'concluida' ? ETAPAS.length : ETAPAS.findIndex((e) => e.estado === estado)
  return (
    <ol className="etapas" aria-label="Etapas da simulação">
      {ETAPAS.map((etapa, i) => {
        const situacao = i < atual ? 'feita' : i === atual ? 'andamento' : 'pendente'
        return (
          <li
            key={etapa.estado}
            className={`etapas__item etapas__item--${situacao}`}
            aria-current={situacao === 'andamento' ? 'step' : undefined}
          >
            <span className="etapas__marca" aria-hidden="true">
              {situacao === 'feita' ? '✓' : i + 1}
            </span>
            {etapa.rotulo}
            <span className="so-leitor">
              {situacao === 'feita'
                ? ' (concluída)'
                : situacao === 'andamento'
                  ? ' (em andamento)'
                  : ' (pendente)'}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
