import { useState } from 'react'
import type { ClienteApi } from '../../api/cliente'
import { EstadoDoSistema } from '../sistema/EstadoDoSistema'
import { PainelSimulacao } from './PainelSimulacao'

/** Estado do sistema + simulação do exemplo que acompanha o EnergyPlus. */
export function SimulacaoDeExemplo({
  api,
  intervaloMs,
}: {
  api: ClienteApi
  intervaloMs?: number
}) {
  const [pronto, setPronto] = useState(false)
  return (
    <div className="colunas">
      <section className="pilha" aria-labelledby="titulo-sistema">
        <p className="nota nota--info">
          A simulação <strong>do IFC aberto</strong> ainda não está disponível: falta a conversão
          validada do modelo térmico para o EnergyPlus (veja “Modelo térmico”). O que roda hoje, de
          ponta a ponta, é o exemplo que acompanha o EnergyPlus.
        </p>
        <h3 id="titulo-sistema">Estado do sistema</h3>
        <EstadoDoSistema api={api} aoMudar={setPronto} />
      </section>
      <section className="pilha" aria-labelledby="titulo-simulacao">
        <h3 id="titulo-simulacao">Simulação do exemplo do EnergyPlus</h3>
        <PainelSimulacao api={api} habilitado={pronto} intervaloMs={intervaloMs} />
      </section>
    </div>
  )
}
