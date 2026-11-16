import { useCallback, useEffect, useState } from 'react'
import type { ClienteApi, Saude } from '../../api/cliente'
import { Aviso } from '../../componentes/Aviso'
import { Carregando } from '../../componentes/Carregando'

type Estado =
  { fase: 'carregando' } | { fase: 'pronto'; saude: Saude } | { fase: 'erro'; mensagem: string }

/** Mostra se o backend e o EnergyPlus estão prontos. */
export function EstadoDoSistema({
  api,
  aoMudar,
}: {
  api: ClienteApi
  aoMudar?: (pronto: boolean) => void
}) {
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' })

  const carregar = useCallback(() => {
    let ativo = true
    setEstado({ fase: 'carregando' })
    api
      .obterSaude()
      .then((saude) => {
        if (!ativo) return
        setEstado({ fase: 'pronto', saude })
        aoMudar?.(saude.energyplus.encontrado)
      })
      .catch((erro: unknown) => {
        if (!ativo) return
        setEstado({
          fase: 'erro',
          mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.',
        })
        aoMudar?.(false)
      })
    return () => {
      ativo = false
    }
  }, [api, aoMudar])

  useEffect(() => carregar(), [carregar])

  if (estado.fase === 'carregando') return <Carregando texto="Verificando o sistema…" />
  if (estado.fase === 'erro') {
    return (
      <Aviso tipo="erro" titulo="Backend indisponível">
        <p>{estado.mensagem}</p>
        <button type="button" className="botao botao--secundario" onClick={carregar}>
          Tentar de novo
        </button>
      </Aviso>
    )
  }
  const { energyplus, versao } = estado.saude
  const versaoCerta = energyplus.versao === energyplus.versao_esperada
  return (
    <Aviso
      tipo={!energyplus.encontrado ? 'erro' : versaoCerta ? 'ok' : 'alerta'}
      titulo={energyplus.mensagem}
    >
      <p className="discreto">
        Plataforma {versao} · pasta do EnergyPlus: <code>{energyplus.pasta}</code>
      </p>
    </Aviso>
  )
}
