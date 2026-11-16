import type { Origem, Valor } from '../api/modelos'
import { ROTULOS_ORIGEM } from '../dominio/modeloEfetivo'
import { formatarValor } from './formatos'

/** Selo que diz de onde veio um valor (IFC, calculado, manual, biblioteca, ausente). */
export function SeloDeOrigem({ origem, fonte }: { origem: Origem; fonte?: string | null }) {
  return (
    <span className={`selo selo--${origem}`} title={fonte ?? ROTULOS_ORIGEM[origem]}>
      {ROTULOS_ORIGEM[origem]}
    </span>
  )
}

/** Uma linha "nome — valor — origem" usada em todo o inspetor. */
export function LinhaDeValor({
  nome,
  valor,
  simbolo,
}: {
  nome: string
  valor: Valor | undefined | null
  simbolo?: string
}) {
  const origem = valor?.origem ?? 'ausente'
  return (
    <div className="linha-valor">
      <dt>
        {nome}
        {simbolo && <span className="simbolo"> {simbolo}</span>}
      </dt>
      <dd className={origem === 'ausente' ? 'ausente' : undefined}>
        {origem === 'ausente' ? 'Não informado' : formatarValor(valor)}
      </dd>
      <SeloDeOrigem origem={origem} fonte={valor?.fonte} />
    </div>
  )
}

/** Linha simples, sem origem (textos de identificação). */
export function LinhaDeTexto({ nome, children }: { nome: string; children: React.ReactNode }) {
  return (
    <div className="linha-valor linha-valor--texto">
      <dt>{nome}</dt>
      <dd>{children ?? '—'}</dd>
    </div>
  )
}
