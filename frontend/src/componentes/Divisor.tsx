import { useCallback, useState } from 'react'

/**
 * Barra que redimensiona um painel arrastando (ou com as setas do teclado).
 * ``sentido`` = +1 quando arrastar no sentido positivo do eixo aumenta o painel.
 */
export function useTamanho(chave: string, inicial: number, min: number, max: number) {
  const [tamanho, setTamanho] = useState(() => {
    try {
      const salvo = Number(window.localStorage.getItem(`ifc-energy:painel:${chave}`))
      return salvo >= min && salvo <= max ? salvo : inicial
    } catch {
      return inicial
    }
  })
  const definir = useCallback(
    (valor: number) => {
      const limitado = Math.round(Math.min(max, Math.max(min, valor)))
      setTamanho(limitado)
      try {
        window.localStorage.setItem(`ifc-energy:painel:${chave}`, String(limitado))
      } catch {
        // sem armazenamento: o tamanho vale só nesta sessão
      }
    },
    [chave, min, max],
  )
  return [tamanho, definir] as const
}

export function Divisor({
  eixo,
  sentido,
  tamanho,
  aoMudar,
  rotulo,
}: {
  eixo: 'x' | 'y'
  sentido: 1 | -1
  tamanho: number
  aoMudar: (tamanho: number) => void
  rotulo: string
}) {
  // Um separador focável e arrastável é o padrão ARIA "window splitter".
  /* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
  return (
    <div
      className={`divisor divisor--${eixo}`}
      role="separator"
      tabIndex={0}
      aria-orientation={eixo === 'x' ? 'vertical' : 'horizontal'}
      aria-label={rotulo}
      aria-valuenow={tamanho}
      onPointerDown={(e) => {
        e.preventDefault()
        const inicio = eixo === 'x' ? e.clientX : e.clientY
        const mover = (m: PointerEvent) =>
          aoMudar(tamanho + sentido * ((eixo === 'x' ? m.clientX : m.clientY) - inicio))
        const soltar = () => {
          window.removeEventListener('pointermove', mover)
          window.removeEventListener('pointerup', soltar)
          document.body.classList.remove('arrastando')
        }
        document.body.classList.add('arrastando')
        window.addEventListener('pointermove', mover)
        window.addEventListener('pointerup', soltar)
      }}
      onKeyDown={(e) => {
        const mais = eixo === 'x' ? 'ArrowRight' : 'ArrowDown'
        const menos = eixo === 'x' ? 'ArrowLeft' : 'ArrowUp'
        if (e.key === mais) aoMudar(tamanho + sentido * 16)
        if (e.key === menos) aoMudar(tamanho - sentido * 16)
      }}
    />
  )
}
