import { useEffect, useId, useState } from 'react'
import { formatarNumero, lerNumero } from './formatos'

/**
 * Campo numérico que só grava ao sair do campo ou ao apertar Enter.
 * ``aoGravar`` devolve uma mensagem de erro (ou null se aceitou).
 */
export function CampoNumero({
  rotulo,
  valor,
  unidade,
  aoGravar,
  permiteVazio = false,
  dica,
}: {
  rotulo: string
  valor: number | null
  unidade?: string | null
  aoGravar: (valor: number | null) => string | null
  permiteVazio?: boolean
  dica?: string
}) {
  const id = useId()
  const [texto, setTexto] = useState(valor === null ? '' : formatarNumero(valor))
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    setTexto(valor === null ? '' : formatarNumero(valor))
    setErro(null)
  }, [valor])

  function gravar() {
    const numero = lerNumero(texto)
    if (Number.isNaN(numero)) return setErro('Informe um número (use vírgula para decimais).')
    if (numero === null && !permiteVazio) {
      setTexto(valor === null ? '' : formatarNumero(valor))
      return setErro(null)
    }
    if (numero === valor) return setErro(null)
    setErro(aoGravar(numero))
  }

  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      <div className="campo__entrada">
        <input
          id={id}
          inputMode="decimal"
          value={texto}
          placeholder={permiteVazio ? 'não informado' : undefined}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${id}-erro` : dica ? `${id}-dica` : undefined}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={gravar}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              setTexto(valor === null ? '' : formatarNumero(valor))
              setErro(null)
            }
          }}
        />
        {unidade && <span className="campo__unidade">{unidade}</span>}
      </div>
      {erro ? (
        <p id={`${id}-erro`} className="campo__erro" role="alert">
          {erro}
        </p>
      ) : (
        dica && (
          <p id={`${id}-dica`} className="campo__dica">
            {dica}
          </p>
        )
      )}
    </div>
  )
}
