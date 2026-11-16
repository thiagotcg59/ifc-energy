/** Marca do IFC Energy: uma casa em corte com o fluxo de calor atravessando a parede. */
export function Logotipo({ tamanho = 28 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="var(--marca)" />
      <path
        d="M6 15.5 16 7l10 8.5V25a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z"
        fill="none"
        stroke="var(--marca-tinta)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M17.5 12.5 13 19h3.5l-1.5 5 5-7h-3.6z"
        fill="var(--marca-tinta)"
        stroke="var(--marca-tinta)"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}
