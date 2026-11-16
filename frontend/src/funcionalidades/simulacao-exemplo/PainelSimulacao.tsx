import type { ClienteApi } from '../../api/cliente'
import { Aviso } from '../../componentes/Aviso'
import { Etapas } from './Etapas'
import { PainelConsumo } from './PainelConsumo'
import { useSimulacaoExemplo } from './useSimulacaoExemplo'

export function PainelSimulacao({
  api,
  habilitado,
  intervaloMs,
}: {
  api: ClienteApi
  habilitado: boolean
  intervaloMs?: number
}) {
  const { estado, simular } = useSimulacaoExemplo(api, intervaloMs)
  const ocupado = estado.fase === 'enviando' || estado.fase === 'acompanhando'

  return (
    <>
      <p>
        Casa térrea de exemplo que acompanha o EnergyPlus (186 m², 3 zonas, clima de Chicago, EUA).
        Serve para provar que a plataforma roda uma simulação completa; a casa brasileira em IFC
        entra nas próximas fases.
      </p>
      <button
        type="button"
        className="botao"
        onClick={simular}
        disabled={!habilitado || ocupado}
        aria-describedby={habilitado ? undefined : 'motivo-desabilitado'}
      >
        {ocupado ? 'Simulando…' : estado.fase === 'vazia' ? 'Simular exemplo' : 'Simular de novo'}
      </button>
      {!habilitado && (
        <p id="motivo-desabilitado" className="discreto">
          Resolva o problema indicado em “Estado do sistema” para liberar a simulação.
        </p>
      )}

      <div aria-live="polite">
        {estado.fase === 'vazia' && (
          <p className="vazio">
            Nenhuma simulação ainda. Clique em “Simular exemplo” para ver o consumo anual por uso
            final.
          </p>
        )}
        {estado.fase === 'enviando' && <Etapas estado="na_fila" />}
        {estado.fase === 'acompanhando' && (
          <>
            <Etapas estado={estado.simulacao.estado} />
            <p className="discreto">{estado.simulacao.mensagem}</p>
          </>
        )}
        {estado.fase === 'erro' && (
          <Aviso tipo="erro" titulo="Não foi possível simular">
            <p>{estado.mensagem}</p>
          </Aviso>
        )}
        {estado.fase === 'falhou' && (
          <Aviso tipo="erro" titulo="A simulação falhou">
            <p>{estado.simulacao.mensagem}</p>
            {estado.simulacao.detalhes.length > 0 && (
              <ul className="detalhes-erro">
                {estado.simulacao.detalhes.map((detalhe, i) => (
                  <li key={i}>{detalhe}</li>
                ))}
              </ul>
            )}
          </Aviso>
        )}
        {estado.fase === 'concluida' && (
          <>
            <Aviso tipo="ok" titulo={estado.simulacao.mensagem} />
            <PainelConsumo consumo={estado.resultados} />
          </>
        )}
      </div>
    </>
  )
}
