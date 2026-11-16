import type { ReactNode } from 'react'

type Tipo = 'erro' | 'alerta' | 'info' | 'ok'
const SIMBOLO: Record<Tipo, string> = { erro: '✕', alerta: '!', info: 'i', ok: '✓' }

/** Caixa de mensagem. Erros são anunciados por leitores de tela na hora. */
export function Aviso({
  tipo,
  titulo,
  children,
}: {
  tipo: Tipo
  titulo: string
  children?: ReactNode
}) {
  return (
    <div className={`aviso aviso--${tipo}`} role={tipo === 'erro' ? 'alert' : 'status'}>
      <span className="aviso__simbolo" aria-hidden="true">
        {SIMBOLO[tipo]}
      </span>
      <div>
        <p className="aviso__titulo">{titulo}</p>
        {children && <div className="aviso__corpo">{children}</div>}
      </div>
    </div>
  )
}
