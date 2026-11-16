import type { ConsumoAnual } from '../../api/cliente'
import { formatarArea, formatarIntensidade, formatarKwh, formatarParcela } from './formatos'

// Cada fonte de energia tem sempre a mesma cor (a cor segue a fonte, não a
// posição na lista). Cores validadas para daltonismo nos temas claro e escuro.
const COR_DA_FONTE: Record<string, string> = {
  Electricity: 'var(--serie-1)',
  'Natural Gas': 'var(--serie-2)',
  'District Cooling': 'var(--serie-3)',
  'District Heating Water': 'var(--serie-4)',
}
const corDaFonte = (chave: string) => COR_DA_FONTE[chave] ?? 'var(--serie-outras)'

/** Consumo anual por uso final: números-resumo, barras e tabela. */
export function PainelConsumo({ consumo }: { consumo: ConsumoAnual }) {
  if (consumo.itens.length === 0) {
    return (
      <p className="vazio">
        A simulação terminou, mas não registrou consumo de energia. Confira se o modelo tem
        iluminação, equipamentos ou climatização.
      </p>
    )
  }
  const itens = [...consumo.itens].sort((a, b) => b.kwh - a.kwh)
  const maior = itens[0]!.kwh
  const variasFontes = consumo.total_por_fonte.length > 1

  return (
    <div className="consumo">
      <dl className="resumo">
        <div className="resumo__item">
          <dt>Consumo anual total</dt>
          <dd>{formatarKwh(consumo.total_kwh)}</dd>
        </div>
        <div className="resumo__item">
          <dt>Por área condicionada</dt>
          <dd>{formatarIntensidade(consumo.intensidade_kwh_m2)}</dd>
        </div>
        <div className="resumo__item">
          <dt>Área condicionada</dt>
          <dd>{formatarArea(consumo.area_condicionada_m2)}</dd>
        </div>
      </dl>

      <figure className="grafico">
        <figcaption>Consumo anual por uso final (kWh)</figcaption>
        {variasFontes && (
          <ul className="legenda" aria-label="Fontes de energia">
            {consumo.total_por_fonte.map((t) => (
              <li key={t.fonte_chave}>
                <span
                  className="legenda__cor"
                  style={{ background: corDaFonte(t.fonte_chave) }}
                  aria-hidden="true"
                />
                {t.fonte} · {formatarKwh(t.kwh)}
              </li>
            ))}
          </ul>
        )}
        <ul className="barras">
          {itens.map((item) => (
            <li
              key={`${item.uso_final_chave}-${item.fonte_chave}`}
              className="barras__linha"
              title={`${item.uso_final} (${item.fonte}): ${formatarKwh(item.kwh)} — ${formatarParcela(item.kwh / consumo.total_kwh)} do total`}
            >
              <span className="barras__rotulo">
                {item.uso_final}
                <small>{item.fonte}</small>
              </span>
              <span className="barras__trilho">
                <span
                  className="barras__barra"
                  style={{
                    width: `${Math.max((item.kwh / maior) * 100, 0.5)}%`,
                    background: corDaFonte(item.fonte_chave),
                  }}
                />
                <span className="barras__valor">{formatarKwh(item.kwh)}</span>
              </span>
            </li>
          ))}
        </ul>
      </figure>

      <details className="tabela-detalhes">
        <summary>Ver como tabela</summary>
        <div className="tabela-rolagem">
          <table>
            <caption className="so-leitor">Consumo anual por uso final e fonte de energia</caption>
            <thead>
              <tr>
                <th scope="col">Uso final</th>
                <th scope="col">Fonte</th>
                <th scope="col" className="numero">
                  kWh/ano
                </th>
                <th scope="col" className="numero">
                  Parcela
                </th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => (
                <tr key={`${item.uso_final_chave}-${item.fonte_chave}`}>
                  <th scope="row">{item.uso_final}</th>
                  <td>{item.fonte}</td>
                  <td className="numero">{formatarKwh(item.kwh).replace(' kWh', '')}</td>
                  <td className="numero">{formatarParcela(item.kwh / consumo.total_kwh)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={2}>
                  Total
                </th>
                <td className="numero">{formatarKwh(consumo.total_kwh).replace(' kWh', '')}</td>
                <td className="numero">100,0%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </details>
    </div>
  )
}
