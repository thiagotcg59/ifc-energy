import { useState } from 'react'
import type { ClienteApi } from '../api/cliente'
import { PainelSimulacao } from '../funcionalidades/simulacao-exemplo/PainelSimulacao'
import { EstadoDoSistema } from '../funcionalidades/sistema/EstadoDoSistema'

export function PaginaInicial({
  api,
  modoDemo,
  intervaloMs,
}: {
  api: ClienteApi
  modoDemo: boolean
  intervaloMs?: number
}) {
  const [pronto, setPronto] = useState(false)

  return (
    <>
      {modoDemo && (
        <p className="faixa-demo" role="note">
          <strong>Modo demonstração.</strong> Nada é simulado aqui: os números foram gravados de uma
          execução real do EnergyPlus. Para simular de verdade, rode a plataforma no seu computador.
        </p>
      )}
      <header className="topo">
        <h1>ifc-energy</h1>
        <p>Simulação termoenergética de casas unifamiliares a partir de IFC, com EnergyPlus.</p>
      </header>
      <main className="conteudo">
        <section className="cartao" aria-labelledby="titulo-sistema">
          <h2 id="titulo-sistema">Estado do sistema</h2>
          <EstadoDoSistema api={api} aoMudar={setPronto} />
        </section>
        <section className="cartao" aria-labelledby="titulo-simulacao">
          <h2 id="titulo-simulacao">Simulação de exemplo</h2>
          <PainelSimulacao api={api} habilitado={pronto} intervaloMs={intervaloMs} />
        </section>
      </main>
      <footer className="rodape">
        Fase 1 de 8 ·{' '}
        <a href="https://github.com/thiagotcg59/ifc-energy/blob/main/docs/PROGRESSO.md">
          ver progresso
        </a>
      </footer>
    </>
  )
}
