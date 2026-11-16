import { CircleAlert, CircleCheck, Copy, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { CampoNumero } from '../../componentes/CampoNumero'
import { useModelo } from '../../estado/useModelo'
import {
  ambientesCompletos,
  faltantes,
  GRUPOS_DE_USO,
  SUPOSICOES_DE_USO,
  usoCompleto,
} from '../../dominio/operacao'

/**
 * Formulário de uso e operação: ocupação, iluminação, equipamentos,
 * temperaturas de configuração e infiltração, ambiente por ambiente.
 * Nenhum campo vem preenchido: o IFC não traz esses dados.
 */
export function PainelDeUso() {
  const analise = useModelo((e) => e.analise)
  const operacao = useModelo((e) => e.ajustes.operacao)
  const ajustes = useModelo((e) => e.ajustes)
  const selecao = useModelo((e) => e.selecao)
  const { selecionar, editarUso, copiarUso, limparUso } = useModelo.getState()
  const [erro, setErro] = useState<string | null>(null)
  if (!analise) return null
  const { ambientes } = analise.bim

  if (ambientes.length === 0) {
    return (
      <p className="vazio">
        Este IFC não tem ambientes (IfcSpace), então não há onde informar os dados de uso. Veja a
        aba Diagnóstico.
      </p>
    )
  }

  const ambiente =
    selecao?.tipo === 'ambiente' ? ambientes.find((a) => a.global_id === selecao.id) : undefined
  const uso = ambiente ? operacao[ambiente.global_id] : undefined
  const faltam = faltantes(uso)
  const completos = ambientesCompletos(ajustes, ambientes)

  return (
    <div className="uso">
      <div className="uso__topo">
        <div className="uso__ambientes" role="group" aria-label="Ambiente a preencher">
          {ambientes.map((a) => {
            const completo = usoCompleto(operacao[a.global_id])
            return (
              <button
                key={a.global_id}
                type="button"
                className="uso__ambiente"
                aria-pressed={a.global_id === ambiente?.global_id}
                onClick={() => {
                  setErro(null)
                  selecionar({ tipo: 'ambiente', id: a.global_id })
                }}
              >
                {completo ? (
                  <CircleCheck size={15} className="cor-ok" aria-hidden />
                ) : (
                  <CircleAlert size={15} className="cor-alerta" aria-hidden />
                )}
                {a.nome ?? a.global_id}
                <small>{completo ? 'completo' : 'incompleto'}</small>
              </button>
            )
          })}
        </div>
        <p className="discreto">
          {completos} de {ambientes.length} ambientes com os dados de uso completos.
        </p>
      </div>

      {!ambiente ? (
        <p className="vazio">
          Escolha um ambiente acima para informar ocupação, iluminação, equipamentos, temperaturas
          de configuração e infiltração. O IFC não traz esses dados e a plataforma não sugere
          valores: os campos começam vazios.
        </p>
      ) : (
        <>
          <div className="uso__grupos">
            {GRUPOS_DE_USO.map((grupo) => (
              <fieldset key={grupo.id} className="uso__grupo">
                <legend>{grupo.titulo}</legend>
                <div className="grade-campos">
                  {grupo.parametros.map((p) => {
                    const valor = uso?.[p.id]?.valor
                    return (
                      <CampoNumero
                        key={`${ambiente.global_id}-${p.id}`}
                        rotulo={p.rotulo}
                        unidade={p.unidade}
                        valor={typeof valor === 'number' ? valor : null}
                        permiteVazio
                        dica={p.dica}
                        aoGravar={(novo) => editarUso(ambiente.global_id, p.id, novo)}
                      />
                    )
                  })}
                </div>
                <p className="uso__destino">No EnergyPlus: {grupo.destino}</p>
              </fieldset>
            ))}
          </div>

          <div className="acoes-linha">
            <p className={faltam.length ? 'discreto' : 'discreto cor-ok'}>
              {faltam.length === 0
                ? `Dados de uso de “${ambiente.nome}” completos.`
                : `Faltam ${faltam.length}: ${faltam.map((p) => p.rotulo.toLowerCase()).join(', ')}.`}
            </p>
            <button
              type="button"
              className="botao-leve"
              disabled={!uso || Object.keys(uso).length === 0}
              onClick={() => setErro(copiarUso(ambiente.global_id))}
            >
              <Copy size={14} aria-hidden /> Copiar para os outros ambientes
            </button>
            <button
              type="button"
              className="botao-leve botao-leve--perigo"
              disabled={!uso || Object.keys(uso).length === 0}
              onClick={() => limparUso(ambiente.global_id)}
            >
              <Trash2 size={14} aria-hidden /> Apagar os dados deste ambiente
            </button>
          </div>
          {erro && (
            <p className="campo__erro" role="alert">
              {erro}
            </p>
          )}
          <ul className="lista-simples discreto">
            {SUPOSICOES_DE_USO.map((s) => (
              <li key={s}>{s}</li>
            ))}
            <li>
              Onde há zero pessoas ou potência zero, os horários daquele grupo não precisam ser
              informados.
            </li>
          </ul>
        </>
      )}
    </div>
  )
}
