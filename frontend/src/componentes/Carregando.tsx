export function Carregando({ texto }: { texto: string }) {
  return (
    <p className="carregando" role="status">
      <span className="carregando__giro" aria-hidden="true" />
      {texto}
    </p>
  )
}
