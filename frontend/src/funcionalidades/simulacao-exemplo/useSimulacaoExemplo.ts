import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClienteApi, ConsumoAnual, Simulacao } from '../../api/cliente'

export type EstadoTela =
  | { fase: 'vazia' }
  | { fase: 'enviando' }
  | { fase: 'acompanhando'; simulacao: Simulacao }
  | { fase: 'concluida'; simulacao: Simulacao; resultados: ConsumoAnual }
  | { fase: 'falhou'; simulacao: Simulacao }
  | { fase: 'erro'; mensagem: string }

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms))

/**
 * Pede a simulação de exemplo e consulta o estado de tempos em tempos até
 * ela terminar. A simulação roda no backend, em segundo plano.
 */
export function useSimulacaoExemplo(api: ClienteApi, intervaloMs = 1000) {
  const [estado, setEstado] = useState<EstadoTela>({ fase: 'vazia' })
  // Cada clique ganha um número; respostas de cliques antigos são ignoradas.
  const rodada = useRef(0)

  useEffect(
    () => () => {
      rodada.current = -1 // tela fechada: para de consultar
    },
    [],
  )

  const simular = useCallback(async () => {
    const minha = ++rodada.current
    const atual = () => rodada.current === minha
    setEstado({ fase: 'enviando' })
    try {
      let simulacao = await api.simularExemplo()
      while (atual() && simulacao.estado !== 'concluida' && simulacao.estado !== 'falhou') {
        setEstado({ fase: 'acompanhando', simulacao })
        await esperar(intervaloMs)
        if (!atual()) return
        simulacao = await api.obterSimulacao(simulacao.id)
      }
      if (!atual()) return
      if (simulacao.estado === 'falhou') {
        setEstado({ fase: 'falhou', simulacao })
        return
      }
      const resultados = await api.obterResultados(simulacao.id)
      if (atual()) setEstado({ fase: 'concluida', simulacao, resultados })
    } catch (erro) {
      if (atual()) {
        setEstado({
          fase: 'erro',
          mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido. Tente de novo.',
        })
      }
    }
  }, [api, intervaloMs])

  return { estado, simular }
}
