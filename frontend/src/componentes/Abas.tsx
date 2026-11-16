import type { ReactNode } from 'react'

export interface Aba<T extends string> {
  id: T
  rotulo: string
  contador?: number
  alerta?: boolean
}

/** Lista de abas acessível (setas do teclado trocam de aba). */
export function Abas<T extends string>({
  abas,
  ativa,
  aoTrocar,
  nome,
  extra,
}: {
  abas: Aba<T>[]
  ativa: T
  aoTrocar: (id: T) => void
  nome: string
  extra?: ReactNode
}) {
  const aoTeclar = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const i = abas.findIndex((a) => a.id === ativa)
    const proxima = abas[(i + (e.key === 'ArrowRight' ? 1 : -1) + abas.length) % abas.length]
    if (proxima) aoTrocar(proxima.id)
  }
  return (
    <div className="abas">
      <div className="abas__lista" role="tablist" aria-label={nome}>
        {abas.map((aba) => (
          <button
            key={aba.id}
            type="button"
            role="tab"
            id={`aba-${nome}-${aba.id}`}
            aria-selected={aba.id === ativa}
            tabIndex={aba.id === ativa ? 0 : -1}
            className="abas__aba"
            onClick={() => aoTrocar(aba.id)}
            onKeyDown={aoTeclar}
          >
            {aba.rotulo}
            {aba.contador !== undefined && aba.contador > 0 && (
              <span className={`abas__contador${aba.alerta ? ' abas__contador--alerta' : ''}`}>
                {aba.contador}
              </span>
            )}
          </button>
        ))}
      </div>
      {extra}
    </div>
  )
}
