import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleX,
  Download,
  Info,
  RotateCcw,
  TriangleAlert,
  Upload,
} from 'lucide-react'
import { useRef, type ReactNode } from 'react'
import type { ClienteApi } from '../../api/cliente'
import { Abas } from '../../componentes/Abas'
import { formatarNumero } from '../../componentes/formatos'
import { temAlteracoes, useModelo, type AbaInferior } from '../../estado/useModelo'
import { SimulacaoDeExemplo } from '../simulacao-exemplo/SimulacaoDeExemplo'

const ICONE_DO_NIVEL: Record<string, ReactNode> = {
  erro: <CircleX size={16} className="cor-erro" aria-label="Erro" />,
  alerta: <TriangleAlert size={16} className="cor-alerta" aria-label="Advertência" />,
  info: <Info size={16} className="cor-info" aria-label="Informação" />,
}
const ICONE_DO_ESTADO: Record<string, ReactNode> = {
  ok: <CircleCheck size={16} className="cor-ok" aria-label="Pronto" />,
  pendente: <CircleAlert size={16} className="cor-alerta" aria-label="Pendente" />,
  erro: <CircleX size={16} className="cor-erro" aria-label="Com erro" />,
  nao_implementado: (
    <CircleDashed size={16} className="cor-fraca" aria-label="Ainda não implementado" />
  ),
}
const ROTULO_DO_ESTADO: Record<string, string> = {
  ok: 'Pronto',
  pendente: 'Pendente',
  erro: 'Com erro',
  nao_implementado: 'Ainda não implementado',
}

/** Painel inferior: diagnóstico, modelo térmico, simulação e histórico de alterações. */
export function PainelInferior({ api, extra }: { api: ClienteApi; extra?: ReactNode }) {
  const analise = useModelo((e) => e.analise)
  const aba = useModelo((e) => e.abaInferior)
  const ajustes = useModelo((e) => e.ajustes)
  const { definir, selecionar } = useModelo.getState()
  if (!analise) return null
  const { bim, termico } = analise
  const problemas = bim.diagnostico.filter((d) => d.nivel !== 'info').length
  const falhas = termico.checagens.filter((c) => !c.ok).length

  function selecionarAlvo(id: string) {
    if (bim.elementos.some((e) => e.global_id === id)) selecionar({ tipo: 'elemento', id })
    else if (bim.ambientes.some((a) => a.global_id === id)) selecionar({ tipo: 'ambiente', id })
    else if (bim.materiais.some((m) => m.id === id)) selecionar({ tipo: 'material', id })
  }

  return (
    <section className="painel-inferior" aria-label="Diagnóstico, modelo térmico e simulação">
      <Abas<AbaInferior>
        nome="Painel inferior"
        ativa={aba}
        aoTrocar={(id) => definir({ abaInferior: id })}
        extra={extra}
        abas={[
          {
            id: 'diagnostico',
            rotulo: 'Diagnóstico',
            contador: bim.diagnostico.length,
            alerta: problemas > 0,
          },
          { id: 'termico', rotulo: 'Modelo térmico', contador: falhas, alerta: true },
          { id: 'simulacao', rotulo: 'Simulação' },
          { id: 'alteracoes', rotulo: 'Alterações', contador: ajustes.historico.length },
        ]}
      />
      <div className="painel-inferior__corpo" role="tabpanel">
        {aba === 'diagnostico' &&
          (bim.diagnostico.length === 0 ? (
            <p className="vazio">Nenhum problema encontrado na leitura do modelo.</p>
          ) : (
            <ul className="mensagens">
              {bim.diagnostico.map((d, i) => (
                <li key={i} className={`mensagem mensagem--${d.nivel}`}>
                  {ICONE_DO_NIVEL[d.nivel]}
                  <div>
                    <p>{d.mensagem}</p>
                    {d.como_resolver && (
                      <p className="mensagem__acao">
                        <strong>O que fazer:</strong> {d.como_resolver}
                      </p>
                    )}
                    {(d.alvos ?? []).length > 0 && (d.alvos ?? []).length <= 12 && (
                      <p className="mensagem__alvos">
                        {(d.alvos ?? []).map((id) => (
                          <button
                            key={id}
                            type="button"
                            className="ligacao"
                            onClick={() => selecionarAlvo(id)}
                          >
                            {bim.elementos.find((e) => e.global_id === id)?.nome ??
                              bim.ambientes.find((a) => a.global_id === id)?.nome ??
                              bim.materiais.find((m) => m.id === id)?.nome ??
                              id}
                          </button>
                        ))}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ))}

        {aba === 'termico' && (
          <div className="colunas">
            <div>
              <h3>Prontidão para a simulação</h3>
              <ol className="etapas-prontidao">
                {termico.prontidao.map((e) => (
                  <li key={e.codigo}>
                    {ICONE_DO_ESTADO[e.estado]}
                    <div>
                      <p>
                        <strong>{e.nome}</strong>{' '}
                        <span className={`estado estado--${e.estado}`}>
                          {ROTULO_DO_ESTADO[e.estado]}
                        </span>
                      </p>
                      <p className="discreto">{e.detalhe}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h3>
                Modelo térmico: {termico.zonas.length} zona(s), {termico.superficies.length}{' '}
                superfície(s), {termico.aberturas.length} abertura(s)
              </h3>
              {termico.zonas.length === 0 ? (
                <p className="vazio">
                  Não há modelo térmico: o IFC não tem ambientes com fronteiras de espaço de 2º
                  nível. Veja a aba Diagnóstico.
                </p>
              ) : (
                <>
                  <ul className="mensagens">
                    {termico.checagens.map((c) => (
                      <li key={c.codigo} className="mensagem">
                        {ICONE_DO_ESTADO[c.ok ? 'ok' : 'erro']}
                        <div>
                          <p>{c.nome}</p>
                          <p className="discreto">{c.detalhe}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <h3>Suposições adotadas</h3>
                  <ul className="lista-simples">
                    {termico.suposicoes.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}

        {aba === 'simulacao' && <SimulacaoDeExemplo api={api} />}

        {aba === 'alteracoes' && <Alteracoes />}
      </div>
    </section>
  )
}

function Alteracoes() {
  const ajustes = useModelo((e) => e.ajustes)
  const analise = useModelo((e) => e.analise)
  const pendente = useModelo(temAlteracoes)
  const somenteNavegador = useModelo((e) => e.somenteNavegador)
  const { restaurar, importarAjustes, definir } = useModelo.getState()
  const arquivo = useRef<HTMLInputElement>(null)
  const texto = (v: number | string | null | undefined) =>
    v === null || v === undefined ? '—' : typeof v === 'number' ? formatarNumero(v) : v

  function exportar() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(ajustes, null, 2)], { type: 'application/json' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = `parametros-${analise?.bim.arquivo.replace(/\.ifc$/i, '') ?? 'modelo'}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="acoes-linha">
        <p className="discreto">
          {somenteNavegador
            ? 'Na demonstração, os parâmetros ficam guardados só neste navegador.'
            : 'Os parâmetros ficam em dados/modelos, no seu computador, separados do IFC.'}{' '}
          {pendente ? 'Há alterações não salvas.' : 'Tudo salvo.'}
        </p>
        <button type="button" className="botao-leve" onClick={exportar}>
          <Download size={14} aria-hidden /> Exportar parâmetros
        </button>
        <button type="button" className="botao-leve" onClick={() => arquivo.current?.click()}>
          <Upload size={14} aria-hidden /> Importar
        </button>
        <input
          ref={arquivo}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const escolhido = e.target.files?.[0]
            e.target.value = ''
            if (!escolhido) return
            const erro = importarAjustes(await escolhido.text())
            definir({
              aviso: erro
                ? { tipo: 'erro', texto: erro }
                : { tipo: 'ok', texto: 'Parâmetros importados. Confira e salve.' },
            })
          }}
        />
        <button
          type="button"
          className="botao-leve botao-leve--perigo"
          disabled={ajustes.historico.length === 0}
          onClick={() => restaurar()}
        >
          <RotateCcw size={14} aria-hidden /> Restaurar tudo ao IFC
        </button>
      </div>
      {ajustes.historico.length === 0 ? (
        <p className="vazio">
          Nenhuma alteração ainda. Selecione um elemento e use a aba “Parâmetros” do inspetor para
          editar materiais e camadas.
        </p>
      ) : (
        <div className="tabela-rolagem">
          <table>
            <thead>
              <tr>
                <th scope="col">Quando</th>
                <th scope="col">Onde</th>
                <th scope="col">O que mudou</th>
                <th scope="col">De</th>
                <th scope="col">Para</th>
              </tr>
            </thead>
            <tbody>
              {[...ajustes.historico].reverse().map((h, i) => (
                <tr key={`${h.quando}-${i}`}>
                  <td>{new Date(h.quando).toLocaleString('pt-BR')}</td>
                  <td>{h.alvo}</td>
                  <td>{h.campo}</td>
                  <td>{texto(h.de)}</td>
                  <td>{texto(h.para)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
