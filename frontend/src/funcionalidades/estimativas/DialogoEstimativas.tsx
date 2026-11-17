import { RotateCcw, WandSparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatarValor } from '../../componentes/formatos'
import {
  gerarPrevia,
  sugerirEscolhas,
  type CampoPrevisto,
  type TipoAmbiente,
} from '../../dominio/estimativas'
import {
  FONTES_ESTIMATIVAS,
  MATERIAIS_ESTIMATIVAS,
  NOME_PERFIL,
} from '../../dominio/perfilEstimativas'
import { temAlteracoes, useModelo } from '../../estado/useModelo'

export function DialogoEstimativas({ aoFechar }: { aoFechar: () => void }) {
  const analise = useModelo((e) => e.analise)!
  const ajustes = useModelo((e) => e.ajustes)
  const salvando = useModelo((e) => e.salvando)
  const pendente = useModelo(temAlteracoes)
  const aviso = useModelo((e) => e.aviso)
  const [escolhas, setEscolhas] = useState(() => ({
    ...sugerirEscolhas(analise.bim),
    municipio: ajustes.estimativas.at(-1)?.municipio ?? '',
  }))
  const [mensagem, setMensagem] = useState('')
  const [loteEscolhido, setLoteEscolhido] = useState('')
  const caixa = useRef<HTMLDivElement>(null)
  const previa = useMemo(
    () => gerarPrevia(analise.bim, ajustes, escolhas),
    [analise.bim, ajustes, escolhas],
  )
  const lote = ajustes.estimativas.find((l) => l.id === loteEscolhido) ?? ajustes.estimativas.at(-1)
  const grupos = new Map<string, { alvo: string; campos: CampoPrevisto[] }>()
  for (const campo of previa.campos) {
    const id = `${campo.grupo}:${campo.alvo_id}`
    if (!grupos.has(id)) grupos.set(id, { alvo: campo.alvo, campos: [] })
    grupos.get(id)!.campos.push(campo)
  }

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null
    const app = document.querySelector<HTMLElement>('.app')
    if (app) app.inert = true
    caixa.current?.focus()
    const teclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        aoFechar()
      }
      if (e.key !== 'Tab') return
      const itens = [
        ...(caixa.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, select, summary, a[href], [tabindex="0"]',
        ) ?? []),
      ].filter((n) => !n.closest('details:not([open])') || n.tagName === 'SUMMARY')
      if (
        e.shiftKey &&
        (document.activeElement === itens[0] || document.activeElement === caixa.current)
      ) {
        e.preventDefault()
        itens.at(-1)?.focus()
      } else if (!e.shiftKey && document.activeElement === itens.at(-1)) {
        e.preventDefault()
        itens[0]?.focus()
      }
    }
    document.addEventListener('keydown', teclado)
    return () => {
      if (app) app.inert = false
      document.removeEventListener('keydown', teclado)
      anterior?.focus()
    }
  }, [aoFechar])

  return createPortal(
    <div className="tutorial__fundo">
      <div
        ref={caixa}
        className="tutorial estimativas"
        role="dialog"
        aria-modal="true"
        aria-labelledby="estimativas-titulo"
        tabIndex={-1}
      >
        <header className="tutorial__cabecalho">
          <h2 id="estimativas-titulo">
            <WandSparkles size={19} aria-hidden /> Estimar dados faltantes
          </h2>
          <button
            type="button"
            className="icone"
            aria-label="Fechar estimativas"
            onClick={aoFechar}
          >
            <X size={18} aria-hidden />
          </button>
        </header>
        <div className="estimativas__corpo">
          <p className="estimativas__perfil">{NOME_PERFIL}</p>
          <p>
            Confira as associações e as fontes. Serão preenchidos somente campos vazios, com a
            origem <strong>Estimado</strong>. Os dados existentes e o IFC são preservados.
          </p>
          <label className="estimativas__municipio">
            Município do projeto (opcional)
            <input
              value={escolhas.municipio}
              placeholder="Ex.: Rondonópolis/MT"
              maxLength={120}
              onChange={(e) => setEscolhas({ ...escolhas, municipio: e.target.value })}
            />
          </label>
          <p className="discreto">
            A referência de uso é Cuiabá. O município fica registrado para revisão; o perfil não
            adapta o clima nem escolhe o arquivo climático.
          </p>
          {!previa.bloqueado && (
            <>
              <details className="estimativas__secao">
                <summary>Conferir ambientes e materiais</summary>
                <div className="estimativas__associacoes">
                  {analise.bim.ambientes.map((a) => (
                    <label key={a.global_id}>
                      {a.nome ?? a.global_id}
                      <select
                        value={escolhas.ambientes[a.global_id] ?? ''}
                        onChange={(e) =>
                          setEscolhas({
                            ...escolhas,
                            ambientes: {
                              ...escolhas.ambientes,
                              [a.global_id]: e.target.value as TipoAmbiente,
                            },
                          })
                        }
                      >
                        <option value="">Sem perfil compatível</option>
                        <option value="quarto">Dormitório</option>
                        <option value="sala">Sala / sala e cozinha integrada</option>
                      </select>
                    </label>
                  ))}
                  {[...analise.bim.materiais, ...ajustes.materiais_novos].map((m) => (
                    <label key={m.id}>
                      {m.nome}
                      <select
                        value={escolhas.materiais[m.id] ?? ''}
                        onChange={(e) =>
                          setEscolhas({
                            ...escolhas,
                            materiais: { ...escolhas.materiais, [m.id]: e.target.value },
                          })
                        }
                      >
                        <option value="">Sem referência compatível</option>
                        {MATERIAIS_ESTIMATIVAS.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <p className="discreto">
                  Associe somente composições compatíveis. A biblioteca genérica continua separada
                  deste perfil aprovado.
                </p>
              </details>
              <details className="estimativas__secao">
                <summary>Fontes e hipóteses aprovadas</summary>
                <ul className="lista-simples">
                  {Object.entries(FONTES_ESTIMATIVAS).map(([id, f]) => (
                    <li key={id}>
                      <a href={f.url} target="_blank" rel="noreferrer">
                        {f.nome}
                      </a>
                      <p>{f.hipotese}</p>
                    </li>
                  ))}
                </ul>
                <p>
                  Materiais: datasets locais do EnergyPlus 26.2.0; a fonte de cada campo informa a
                  entrada usada. Perfil e adaptações aprovados em 16/11/2026. Estudo preliminar, sem
                  classificação normativa.
                </p>
              </details>
              <div className="estimativas__resumo" role="status">
                <strong>{previa.campos.length}</strong> campos podem ser preenchidos em{' '}
                {grupos.size} ambientes ou materiais.
              </div>
              {previa.campos.length === 0 && (
                <p>Nenhuma nova estimativa disponível. Confira as pendências abaixo.</p>
              )}
              {[...grupos.entries()].map(([id, grupo]) => (
                <details key={id} className="estimativas__secao" open>
                  <summary>
                    {grupo.alvo} <span className="discreto">· {grupo.campos.length} campos</span>
                  </summary>
                  <div className="estimativas__tabela">
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">Campo</th>
                          <th scope="col">Estimativa</th>
                          <th scope="col">Referência</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grupo.campos.map((c) => (
                          <tr key={c.parametro}>
                            <th scope="row">{c.rotulo}</th>
                            <td>{formatarValor(c.valor)}</td>
                            <td>
                              <details>
                                <summary>Ver fonte</summary>
                                <p>{c.valor.fonte}</p>
                              </details>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ))}
            </>
          )}
          <details
            className="estimativas__secao"
            open={previa.bloqueado || previa.campos.length === 0}
          >
            <summary>Pendências e limites do perfil</summary>
            <ul className="lista-simples">
              {previa.pendencias.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </details>
          {lote && (
            <div className="estimativas__desfazer">
              <label>
                Aplicação para desfazer
                <select value={lote.id} onChange={(e) => setLoteEscolhido(e.target.value)}>
                  {ajustes.estimativas.map((l) => (
                    <option key={l.id} value={l.id}>
                      {new Date(l.quando).toLocaleString('pt-BR')} · {l.campos.length} campos
                      {l.municipio ? ` · ${l.municipio}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="botao-leve"
                disabled={salvando}
                onClick={() => {
                  useModelo.getState().desfazerEstimativa(lote.id)
                  setMensagem(
                    'Estimativas desfeitas. Edições posteriores foram preservadas. Salve os parâmetros.',
                  )
                }}
              >
                <RotateCcw size={14} aria-hidden /> Desfazer estimativas
              </button>
            </div>
          )}
          {mensagem && (
            <p className="nota nota--info" role="status">
              {mensagem}
            </p>
          )}
          {aviso && <p role={aviso.tipo === 'erro' ? 'alert' : 'status'}>{aviso.texto}</p>}
        </div>
        <footer className="tutorial__rodape">
          <button type="button" className="botao-leve" onClick={aoFechar}>
            Fechar
          </button>
          <div className="acoes-linha">
            <button
              type="button"
              className="botao-leve"
              disabled={!pendente || salvando}
              onClick={() => void useModelo.getState().salvar()}
            >
              {salvando ? 'Salvando…' : 'Salvar parâmetros'}
            </button>
            <button
              type="button"
              className="botao-leve botao-leve--primario"
              disabled={previa.bloqueado || previa.campos.length === 0 || salvando}
              onClick={() => {
                const n = previa.campos.length
                useModelo.getState().estimar(escolhas)
                setMensagem(
                  `Estimativas aplicadas: ${n} campos. Salve os parâmetros para manter as alterações.`,
                )
              }}
            >
              Aplicar estimativas
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
