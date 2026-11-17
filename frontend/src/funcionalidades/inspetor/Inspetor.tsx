import { Copy, MousePointerClick, Plus, RotateCcw, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { Ambiente, Construcao, Elemento, Material, ModeloAnalise } from '../../api/modelos'
import { Abas } from '../../componentes/Abas'
import { CampoNumero } from '../../componentes/CampoNumero'
import {
  CONDICAO_ENERGYPLUS,
  formatarNumero,
  formatarValor,
  ROTULOS_CONDICAO,
} from '../../componentes/formatos'
import { LinhaDeTexto, LinhaDeValor, SeloDeOrigem } from '../../componentes/ValorComOrigem'
import {
  convencaoDe,
  desempenhoDaConstrucao,
  listarValores,
  materialEfetivo,
  PROPRIEDADES,
  ROTULOS_DIMENSAO,
  ROTULOS_ORIGEM,
  ROTULOS_VIDRO,
  type DesempenhoDaConstrucao,
} from '../../dominio/modeloEfetivo'
import { GRUPOS_DE_USO } from '../../dominio/operacao'
import { CATEGORIAS, useModelo } from '../../estado/useModelo'

type AbaId = 'identificacao' | 'geometria' | 'camadas' | 'desempenho' | 'parametros' | 'origem'
const numero = (v: { valor?: unknown } | undefined | null) =>
  typeof v?.valor === 'number' ? v.valor : null
const calculado = (valor: number | null, unidade: string, fonte: string) =>
  valor === null
    ? { valor: null, unidade, origem: 'ausente' as const }
    : { valor, unidade, origem: 'calculado' as const, fonte }

/** Painel direito: mostra e edita os parâmetros do que está selecionado. */
export function Inspetor() {
  const analise = useModelo((e) => e.analise)
  const selecao = useModelo((e) => e.selecao)
  const [aba, setAba] = useState<AbaId>('identificacao')
  if (!analise) return null

  if (!selecao) {
    return (
      <div className="inspetor inspetor--vazio">
        <MousePointerClick size={28} aria-hidden />
        <p>
          <strong>Nenhum elemento selecionado.</strong>
        </p>
        <p>
          Clique em uma parede, janela, piso ou cobertura no modelo 3D — ou em um item do navegador
          — para ver e editar os parâmetros.
        </p>
      </div>
    )
  }
  if (selecao.tipo === 'material') return <InspetorDeMaterial id={selecao.id} analise={analise} />
  if (selecao.tipo === 'ambiente') {
    const ambiente = analise.bim.ambientes.find((a) => a.global_id === selecao.id)
    return ambiente ? <InspetorDeAmbiente ambiente={ambiente} analise={analise} /> : null
  }
  const elemento = analise.bim.elementos.find((e) => e.global_id === selecao.id)
  if (!elemento) {
    return (
      <div className="inspetor inspetor--vazio">
        <p>
          Este objeto existe na geometria do IFC, mas não é um elemento construtivo com propriedades
          (GlobalId <code>{selecao.id}</code>).
        </p>
      </div>
    )
  }
  const janela = elemento.categoria === 'janela'
  return (
    <div className="inspetor">
      <Cabecalho
        titulo={elemento.nome ?? elemento.classe}
        subtitulo={`${CATEGORIAS.find((c) => c.id === elemento.categoria)?.rotulo} · ${elemento.classe}`}
      />
      <Abas
        nome="Propriedades do elemento"
        ativa={aba}
        aoTrocar={setAba}
        abas={[
          { id: 'identificacao', rotulo: 'Identificação' },
          { id: 'geometria', rotulo: 'Geometria' },
          { id: 'camadas', rotulo: janela ? 'Vidro e caixilho' : 'Camadas' },
          { id: 'desempenho', rotulo: 'Desempenho' },
          { id: 'parametros', rotulo: 'Parâmetros' },
          { id: 'origem', rotulo: 'Origem' },
        ]}
      />
      <div
        className="inspetor__corpo"
        role="tabpanel"
        aria-labelledby={`aba-Propriedades do elemento-${aba}`}
      >
        {aba === 'identificacao' && <AbaIdentificacao elemento={elemento} analise={analise} />}
        {aba === 'geometria' && <AbaGeometria elemento={elemento} analise={analise} />}
        {aba === 'camadas' && <AbaCamadas elemento={elemento} analise={analise} />}
        {aba === 'desempenho' && <AbaDesempenho elemento={elemento} analise={analise} />}
        {aba === 'parametros' && <AbaParametros elemento={elemento} analise={analise} />}
        {aba === 'origem' && <AbaOrigem elemento={elemento} analise={analise} />}
      </div>
    </div>
  )
}

function Cabecalho({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <header className="inspetor__topo">
      <h2>{titulo}</h2>
      <p>{subtitulo}</p>
    </header>
  )
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="secao">
      <h3>{titulo}</h3>
      {children}
    </section>
  )
}

function Ligacao({
  tipo,
  id,
  children,
}: {
  tipo: 'elemento' | 'ambiente' | 'material'
  id: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="ligacao"
      onClick={() => useModelo.getState().selecionar({ tipo, id })}
    >
      {children}
    </button>
  )
}

function GlobalId({ id }: { id: string }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <span className="globalid">
      <code>{id}</code>
      <button
        type="button"
        className="icone"
        aria-label="Copiar o GlobalId"
        title={copiado ? 'Copiado' : 'Copiar'}
        onClick={() =>
          navigator.clipboard
            ?.writeText(id)
            .then(() => setCopiado(true))
            .catch(() => setCopiado(false))
        }
      >
        <Copy size={13} aria-hidden />
      </button>
    </span>
  )
}

interface Props {
  elemento: Elemento
  analise: ModeloAnalise
}

function useConstrucao({ elemento, analise }: Props) {
  const ajustes = useModelo((e) => e.ajustes)
  const biblioteca = useModelo((e) => e.biblioteca)
  const construcao = analise.bim.construcoes.find((c) => c.id === elemento.construcao_id) ?? null
  const desempenho =
    construcao && construcao.tipo === 'camadas'
      ? desempenhoDaConstrucao(analise.bim, ajustes, biblioteca, construcao, elemento)
      : null
  return { ajustes, biblioteca, construcao, desempenho }
}

// ---- Aba 1 ---------------------------------------------------------------------
function AbaIdentificacao({ elemento, analise }: Props) {
  const { bim } = analise
  const nomeDe = (id: string) => bim.elementos.find((e) => e.global_id === id)?.nome ?? id
  const construcao = bim.construcoes.find((c) => c.id === elemento.construcao_id)
  return (
    <>
      <dl className="lista-valores">
        <LinhaDeTexto nome="Nome">{elemento.nome}</LinhaDeTexto>
        <LinhaDeTexto nome="Classe IFC">{elemento.classe}</LinhaDeTexto>
        <LinhaDeTexto nome="GlobalId">
          <GlobalId id={elemento.global_id} />
        </LinhaDeTexto>
        <LinhaDeTexto nome="Etiqueta">{elemento.etiqueta}</LinhaDeTexto>
        <LinhaDeTexto nome="Descrição">{elemento.descricao}</LinhaDeTexto>
        <LinhaDeTexto nome="Tipo predefinido">{elemento.tipo_predefinido}</LinhaDeTexto>
        <LinhaDeTexto nome="Tipo construtivo">{elemento.tipo_construtivo}</LinhaDeTexto>
        <LinhaDeTexto nome="Pavimento">
          {bim.pavimentos.find((p) => p.global_id === elemento.pavimento_id)?.nome}
        </LinhaDeTexto>
        <LinhaDeValor nome="Elemento externo" valor={elemento.externo} />
      </dl>
      <Secao titulo="Relações com outros elementos">
        <dl className="lista-valores">
          <LinhaDeTexto nome="Ambientes associados">
            {(elemento.ambientes_ids ?? []).length === 0
              ? 'Nenhum (sem fronteira de espaço)'
              : (elemento.ambientes_ids ?? []).map((id) => (
                  <Ligacao key={id} tipo="ambiente" id={id}>
                    {bim.ambientes.find((a) => a.global_id === id)?.nome ?? id}
                  </Ligacao>
                ))}
          </LinhaDeTexto>
          {elemento.hospedeiro_id && (
            <LinhaDeTexto nome="Instalado em">
              <Ligacao tipo="elemento" id={elemento.hospedeiro_id}>
                {nomeDe(elemento.hospedeiro_id)}
              </Ligacao>
            </LinhaDeTexto>
          )}
          {(elemento.aberturas_ids ?? []).length > 0 && (
            <LinhaDeTexto nome="Aberturas">
              {(elemento.aberturas_ids ?? []).map((id) => (
                <Ligacao key={id} tipo="elemento" id={id}>
                  {nomeDe(id)}
                </Ligacao>
              ))}
            </LinhaDeTexto>
          )}
          {construcao && (
            <LinhaDeTexto nome="Mesma composição">
              {(construcao.elementos_ids ?? []).length} elemento(s) usam “{construcao.nome}”
            </LinhaDeTexto>
          )}
        </dl>
      </Secao>
    </>
  )
}

// ---- Aba 2 ---------------------------------------------------------------------
function AbaGeometria({ elemento, analise }: Props) {
  const superficies = analise.termico.superficies.filter(
    (s) => s.elemento_id === elemento.global_id,
  )
  const aberturas = analise.termico.aberturas.filter((a) => a.elemento_id === elemento.global_id)
  const o = elemento.orientacao
  return (
    <>
      <dl className="lista-valores">
        {Object.entries(elemento.dimensoes ?? {}).map(([chave, valor]) => (
          <LinhaDeValor key={chave} nome={ROTULOS_DIMENSAO[chave] ?? chave} valor={valor} />
        ))}
      </dl>
      <Secao titulo="Orientação">
        {o ? (
          <dl className="lista-valores">
            <LinhaDeValor
              nome="Orientação"
              valor={{
                valor:
                  o.azimute == null
                    ? o.inclinacao < 90
                      ? 'Horizontal, voltada para cima'
                      : 'Horizontal, voltada para baixo'
                    : `${o.rotulo} (azimute ${formatarNumero(o.azimute)}°)`,
                origem: 'calculado',
                fonte: o.fonte,
              }}
            />
            <LinhaDeValor
              nome="Inclinação"
              valor={{ valor: o.inclinacao, unidade: '°', origem: 'calculado', fonte: o.fonte }}
            />
          </dl>
        ) : (
          <p className="nota">
            Sem orientação: o elemento não tem fronteira de espaço voltada para o exterior.
          </p>
        )}
      </Secao>
      <Secao titulo="Superfícies relacionadas (modelo térmico)">
        {superficies.length + aberturas.length === 0 ? (
          <p className="nota">Nenhuma superfície térmica foi gerada a partir deste elemento.</p>
        ) : (
          <div className="tabela-rolagem">
            <table>
              <thead>
                <tr>
                  <th scope="col">Superfície</th>
                  <th scope="col">Zona</th>
                  <th scope="col">Condição</th>
                  <th scope="col" className="numero">
                    Área líquida
                  </th>
                </tr>
              </thead>
              <tbody>
                {superficies.map((s) => (
                  <tr key={s.id}>
                    <th scope="row">{s.id}</th>
                    <td>{analise.termico.zonas.find((z) => z.id === s.zona_id)?.nome}</td>
                    <td>{ROTULOS_CONDICAO[s.condicao]}</td>
                    <td className="numero">{formatarNumero(s.area_liquida)} m²</td>
                  </tr>
                ))}
                {aberturas.map((a) => (
                  <tr key={a.id}>
                    <th scope="row">{a.id}</th>
                    <td>
                      {
                        analise.termico.zonas.find(
                          (z) =>
                            z.id ===
                            analise.termico.superficies.find((s) => s.id === a.superficie_id)
                              ?.zona_id,
                        )?.nome
                      }
                    </td>
                    <td>Abertura em {a.superficie_id}</td>
                    <td className="numero">{formatarNumero(a.area)} m²</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Secao>
    </>
  )
}

// ---- Aba 3 ---------------------------------------------------------------------
function PropriedadesDoMaterial({ material }: { material: Material }) {
  const opaco = material.propriedades.transmitancia_solar?.valor == null
  return (
    <dl className="lista-valores">
      {Object.entries(PROPRIEDADES)
        .filter(([chave]) =>
          opaco
            ? !chave.startsWith('transmitancia_') && !chave.startsWith('refletancia_')
            : chave !== 'absortancia_solar',
        )
        .map(([chave, def]) => (
          <LinhaDeValor
            key={chave}
            nome={def.rotulo}
            simbolo={def.simbolo}
            valor={material.propriedades[chave]}
          />
        ))}
    </dl>
  )
}

function AbaCamadas(props: Props) {
  const { elemento, analise } = props
  const { ajustes, construcao, desempenho } = useConstrucao(props)
  if (!construcao) {
    return (
      <p className="nota nota--alerta">
        O IFC não informa material nem camadas para este elemento. Sem isso não é possível calcular
        o desempenho térmico.
      </p>
    )
  }
  if (!desempenho) {
    const vidro = elemento.envidracamento ?? {}
    return (
      <>
        <p className="nota">
          <strong>{construcao.nome}</strong>. As propriedades abaixo separam o <em>vidro</em> (dados
          do material) da <em>janela completa</em> (vidro + caixilho), que ficam na aba Desempenho.
        </p>
        {Object.keys(vidro).length > 0 && (
          <Secao titulo="Envidraçamento informado no IFC">
            <dl className="lista-valores">
              {Object.entries(vidro)
                .filter(
                  ([chave]) =>
                    !chave.startsWith('transmitancia_termica') && chave !== 'fator_solar',
                )
                .map(([chave, valor]) => (
                  <LinhaDeValor key={chave} nome={ROTULOS_VIDRO[chave] ?? chave} valor={valor} />
                ))}
            </dl>
          </Secao>
        )}
        {(construcao.constituintes ?? []).map((c) => {
          const material = c.material_id
            ? materialEfetivo(analise.bim, ajustes, c.material_id)
            : null
          return (
            <details key={c.nome} className="camada" open>
              <summary>
                <span className="camada__nome">
                  {c.nome} — {material?.nome ?? 'sem material'}
                </span>
              </summary>
              {material ? (
                <PropriedadesDoMaterial material={material} />
              ) : (
                <p className="nota">Constituinte sem material no IFC.</p>
              )}
            </details>
          )
        })}
      </>
    )
  }
  return (
    <>
      <p className="nota">
        <strong>{construcao.nome}</strong> — camadas de <strong>fora para dentro</strong>.
        {desempenho.alterada && ' Esta composição tem parâmetros alterados em relação ao IFC.'}
      </p>
      <ol className="camadas">
        {desempenho.camadas.map((camada, i) => (
          <li key={i}>
            <details className="camada">
              <summary>
                <span className="camada__numero">{i + 1}</span>
                <span className="camada__nome">{camada.nome}</span>
                <span className="camada__medida">{formatarValor(camada.espessura)}</span>
              </summary>
              <dl className="lista-valores">
                <LinhaDeValor nome="Espessura" simbolo="e" valor={camada.espessura} />
                <LinhaDeValor
                  nome="Resistência térmica da camada"
                  simbolo="R = e/λ"
                  valor={calculado(camada.resistencia, 'm²·K/W', 'espessura ÷ condutividade')}
                />
              </dl>
              {camada.material ? (
                <PropriedadesDoMaterial material={camada.material} />
              ) : (
                <p className="nota nota--alerta">Camada sem material no IFC.</p>
              )}
            </details>
          </li>
        ))}
      </ol>
      <p className="nota">
        Espessura total:{' '}
        {desempenho.espessura_total === null
          ? 'não calculável'
          : `${formatarNumero(desempenho.espessura_total)} m`}
        . Para editar, use a aba Parâmetros.
      </p>
    </>
  )
}

// ---- Aba 4 ---------------------------------------------------------------------
function AbaDesempenho(props: Props) {
  const { elemento, analise } = props
  const { ajustes, construcao, desempenho } = useConstrucao(props)
  const superficies = analise.termico.superficies.filter(
    (s) => s.elemento_id === elemento.global_id,
  )
  const condicoes = [...new Set(superficies.map((s) => s.condicao))]
  const manual = ajustes.aberturas[elemento.construcao_id ?? ''] ?? {}
  return (
    <>
      {desempenho && (
        <>
          <ResumoTermico d={desempenho} />
          <Secao titulo="Como foi calculado">
            <dl className="lista-valores">
              <LinhaDeValor
                nome="Resistência das camadas"
                simbolo="Rt = Σ e/λ"
                valor={calculado(
                  desempenho.resistencia_camadas,
                  'm²·K/W',
                  'soma de e/λ das camadas',
                )}
              />
              <LinhaDeValor
                nome="Resistência superficial interna"
                simbolo="Rsi"
                valor={
                  desempenho.rsi === null
                    ? null
                    : {
                        valor: desempenho.rsi,
                        unidade: 'm²·K/W',
                        origem: desempenho.origemDaConvencao ?? 'ausente',
                        fonte: desempenho.fonteDaConvencao,
                      }
                }
              />
              <LinhaDeValor
                nome={
                  elemento.condicao === 'interior'
                    ? 'Resistência superficial do outro lado (ar interno)'
                    : 'Resistência superficial externa'
                }
                simbolo="Rse"
                valor={
                  desempenho.rse === null
                    ? null
                    : {
                        valor: desempenho.rse,
                        unidade: 'm²·K/W',
                        origem: desempenho.origemDaConvencao ?? 'ausente',
                        fonte: desempenho.fonteDaConvencao,
                      }
                }
              />
              <LinhaDeValor
                nome="Resistência total"
                simbolo="RT = Rsi + Rt + Rse"
                valor={calculado(desempenho.resistencia_total, 'm²·K/W', 'Rsi + Rt + Rse')}
              />
              <LinhaDeValor
                nome="Transmitância térmica"
                simbolo="U = 1/RT"
                valor={calculado(desempenho.transmitancia, 'W/(m²·K)', '1 ÷ RT')}
              />
              <LinhaDeValor
                nome="Capacidade térmica"
                simbolo="CT = Σ e·ρ·c"
                valor={calculado(
                  desempenho.capacidade_termica === null
                    ? null
                    : desempenho.capacidade_termica / 1000,
                  'kJ/(m²·K)',
                  'soma de espessura × densidade × calor específico',
                )}
              />
            </dl>
            {desempenho.fonteDaConvencao && desempenho.rsi !== null && (
              <p className="nota">
                As resistências superficiais são uma <strong>convenção de cálculo</strong>, não uma
                propriedade das camadas. Fonte: {desempenho.fonteDaConvencao}.
              </p>
            )}
            {desempenho.pendencias.map((p) => (
              <p key={p} className="nota nota--alerta">
                {p}
              </p>
            ))}
          </Secao>
        </>
      )}
      {elemento.categoria === 'janela' && (
        <Secao titulo="Janela completa (vidro + caixilho)">
          <dl className="lista-valores">
            {(['fator_solar', 'transmitancia_termica_verao'] as const).map((chave) => (
              <LinhaDeValor
                key={chave}
                nome={ROTULOS_VIDRO[chave]!.replace(' (verão)', '')}
                valor={manual[chave] ?? elemento.envidracamento?.[chave]}
              />
            ))}
          </dl>
          <p className="nota">
            O IFC informa as propriedades do <em>vidro</em>, não as da janela completa. Na
            simulação, o EnergyPlus calcula a transmitância e o fator solar da janela a partir do
            vidro. Se você tiver os valores do fabricante, informe-os na aba Parâmetros.
          </p>
        </Secao>
      )}
      {!desempenho && elemento.categoria !== 'janela' && (
        <p className="nota nota--alerta">
          Sem camadas com material, não há desempenho térmico a calcular para este elemento.
        </p>
      )}
      <Secao titulo="Condição de contorno">
        <dl className="lista-valores">
          <LinhaDeValor
            nome="Exposição do elemento"
            valor={{
              valor: ROTULOS_CONDICAO[elemento.condicao ?? 'indefinida'],
              origem: elemento.condicao === 'indefinida' ? 'ausente' : 'calculado',
              fonte: 'fronteiras de espaço de 2º nível do IFC',
            }}
          />
          {condicoes.map((c) => (
            <LinhaDeTexto key={c} nome={`No EnergyPlus (${ROTULOS_CONDICAO[c]})`}>
              <code>outside_boundary_condition = {CONDICAO_ENERGYPLUS[c]}</code>
            </LinhaDeTexto>
          ))}
          {construcao && (
            <LinhaDeTexto nome="Composição no modelo térmico">
              <code>{construcao.id}</code>
            </LinhaDeTexto>
          )}
        </dl>
        <p className="nota">
          A condição de contorno vem das fronteiras de espaço do IFC e não é editável aqui: mudá-la
          sem mudar a geometria deixaria o modelo incoerente.
        </p>
      </Secao>
    </>
  )
}

function ResumoTermico({ d }: { d: DesempenhoDaConstrucao }) {
  const bloco = (rotulo: string, valor: number | null, unidade: string) => (
    <div className="indicador">
      <dt>{rotulo}</dt>
      <dd>
        {valor === null ? '—' : formatarNumero(valor)}
        {valor !== null && <small> {unidade}</small>}
      </dd>
    </div>
  )
  return (
    <dl className="indicadores">
      {bloco('Transmitância U', d.transmitancia, 'W/(m²·K)')}
      {bloco('Resistência total RT', d.resistencia_total ?? d.resistencia_camadas, 'm²·K/W')}
      {bloco(
        'Capacidade térmica CT',
        d.capacidade_termica === null ? null : d.capacidade_termica / 1000,
        'kJ/(m²·K)',
      )}
    </dl>
  )
}

// ---- Aba 5 ---------------------------------------------------------------------
function EditorDeMaterial({ material }: { material: Material }) {
  const biblioteca = useModelo((e) => e.biblioteca)
  const alterado = useModelo((e) => material.id in e.ajustes.materiais)
  const { editarMaterial, aplicarBiblioteca, restaurar } = useModelo.getState()
  const [erro, setErro] = useState<string | null>(null)
  const opaco = material.propriedades.transmitancia_solar?.valor == null
  const chaves = opaco
    ? ['condutividade', 'densidade', 'calor_especifico', 'absortancia_solar', 'emissividade']
    : [
        'condutividade',
        'transmitancia_solar',
        'refletancia_solar',
        'transmitancia_visivel',
        'emissividade',
      ]
  return (
    <div className="editor-material">
      <div className="grade-campos">
        {chaves.map((chave) => {
          const def = PROPRIEDADES[chave]!
          const valor = material.propriedades[chave]
          return (
            <CampoNumero
              key={chave}
              rotulo={`${def.rotulo}${def.simbolo ? ` (${def.simbolo})` : ''}`}
              unidade={def.unidade}
              valor={numero(valor)}
              permiteVazio
              dica={ROTULOS_ORIGEM[valor?.origem ?? 'ausente']}
              aoGravar={(v) => editarMaterial(material.id, chave, v)}
            />
          )
        })}
      </div>
      <div className="acoes-linha">
        <label className="seletor">
          <span>Aplicar valores da biblioteca</span>
          <select
            value=""
            onChange={(e) =>
              e.target.value && setErro(aplicarBiblioteca(material.id, e.target.value))
            }
          >
            <option value="">Escolher material…</option>
            {biblioteca?.materiais
              .filter((m) => typeof m.condutividade === 'number')
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome} (λ = {formatarNumero(m.condutividade!)})
                </option>
              ))}
          </select>
        </label>
        {alterado && (
          <button
            type="button"
            className="botao-leve"
            onClick={() => restaurar({ material: material.id })}
          >
            <RotateCcw size={14} aria-hidden /> Restaurar valores do IFC
          </button>
        )}
      </div>
      {erro && (
        <p className="campo__erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  )
}

function EditorDeCamadas({ construcao, d }: { construcao: Construcao; d: DesempenhoDaConstrucao }) {
  const biblioteca = useModelo((e) => e.biblioteca)
  const alterada = useModelo((e) => construcao.id in e.ajustes.camadas)
  const acoes = useModelo.getState()
  const [novo, setNovo] = useState({ material: 'isolante', espessura: 0.05, posicao: 1 })
  const [erro, setErro] = useState<string | null>(null)
  const utilizaveis = biblioteca?.materiais.filter((m) => typeof m.condutividade === 'number') ?? []
  return (
    <>
      <ol className="camadas">
        {d.camadas.map((camada, i) => (
          <li key={`${i}-${camada.material?.id}`}>
            <details className="camada" open={i === 1}>
              <summary>
                <span className="camada__numero">{i + 1}</span>
                <span className="camada__nome">{camada.nome}</span>
                <span className="camada__medida">
                  R = {camada.resistencia === null ? '—' : formatarNumero(camada.resistencia)}
                </span>
              </summary>
              <div className="grade-campos">
                <CampoNumero
                  rotulo="Espessura (e)"
                  unidade="m"
                  valor={numero(camada.espessura)}
                  dica={ROTULOS_ORIGEM[camada.espessura.origem ?? 'ausente']}
                  aoGravar={(v) => (v === null ? null : acoes.editarEspessura(construcao.id, i, v))}
                />
                <label className="seletor">
                  <span>Trocar o material por um da biblioteca</span>
                  <select
                    value=""
                    onChange={(e) =>
                      e.target.value &&
                      setErro(acoes.trocarMaterialDaCamada(construcao.id, i, e.target.value))
                    }
                  >
                    <option value="">Manter “{camada.nome}”</option>
                    {utilizaveis.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {camada.material && <EditorDeMaterial material={camada.material} />}
              <button
                type="button"
                className="botao-leve botao-leve--perigo"
                onClick={() => setErro(acoes.removerCamada(construcao.id, i))}
              >
                <Trash2 size={14} aria-hidden /> Remover esta camada
              </button>
            </details>
          </li>
        ))}
      </ol>
      <Secao titulo="Acrescentar camada">
        <div className="grade-campos">
          <label className="seletor">
            <span>Material da biblioteca</span>
            <select
              value={novo.material}
              onChange={(e) => setNovo({ ...novo, material: e.target.value })}
            >
              {utilizaveis.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </label>
          <CampoNumero
            rotulo="Espessura"
            unidade="m"
            valor={novo.espessura}
            aoGravar={(v) => {
              if (v !== null) setNovo({ ...novo, espessura: v })
              return null
            }}
          />
          <label className="seletor">
            <span>Posição (1 = mais externa)</span>
            <select
              value={novo.posicao}
              onChange={(e) => setNovo({ ...novo, posicao: Number(e.target.value) })}
            >
              {Array.from({ length: d.camadas.length + 1 }, (_, i) => (
                <option key={i} value={i}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="acoes-linha">
          <button
            type="button"
            className="botao-leve botao-leve--primario"
            onClick={() =>
              setErro(
                acoes.adicionarCamada(
                  construcao.id,
                  Math.min(novo.posicao, d.camadas.length),
                  novo.material,
                  novo.espessura,
                ),
              )
            }
          >
            <Plus size={14} aria-hidden /> Acrescentar camada
          </button>
          {alterada && (
            <button
              type="button"
              className="botao-leve"
              onClick={() => acoes.restaurar({ construcao: construcao.id })}
            >
              <RotateCcw size={14} aria-hidden /> Restaurar as camadas do IFC
            </button>
          )}
        </div>
        {erro && (
          <p className="campo__erro" role="alert">
            {erro}
          </p>
        )}
      </Secao>
    </>
  )
}

function AbaParametros(props: Props) {
  const { elemento, analise } = props
  const { ajustes, biblioteca, construcao, desempenho } = useConstrucao(props)
  const { editarResistencia, editarAbertura } = useModelo.getState()
  const tipo = convencaoDe(elemento)
  const convencao = tipo ? biblioteca?.resistencias_superficiais[tipo] : undefined
  if (!construcao) {
    return (
      <p className="nota nota--alerta">
        Este elemento não tem material no IFC, então não há parâmetros para editar. A escolha de uma
        composição da biblioteca para elementos sem material ainda não foi implementada.
      </p>
    )
  }
  const n = (construcao.elementos_ids ?? []).length
  return (
    <>
      <p className="nota nota--info">
        As alterações valem para <strong>os {n} elemento(s)</strong> que usam “{construcao.nome}”. O
        arquivo IFC original não é modificado: os valores ficam em um conjunto de parâmetros
        separado, com histórico.
      </p>
      {desempenho && <ResumoTermico d={desempenho} />}
      {desempenho ? (
        <EditorDeCamadas construcao={construcao} d={desempenho} />
      ) : (
        <>
          {elemento.categoria === 'janela' && (
            <Secao titulo="Janela completa (valores do fabricante, se houver)">
              <div className="grade-campos">
                <CampoNumero
                  rotulo="Fator solar (SHGC)"
                  valor={numero(ajustes.aberturas[construcao.id]?.fator_solar)}
                  permiteVazio
                  dica="Entre 0 e 1. Deixe vazio para o EnergyPlus calcular."
                  aoGravar={(v) => editarAbertura(construcao.id, 'fator_solar', v)}
                />
                <CampoNumero
                  rotulo="Transmitância térmica da janela (U)"
                  unidade="W/(m²·K)"
                  valor={numero(ajustes.aberturas[construcao.id]?.transmitancia_termica_verao)}
                  permiteVazio
                  dica="Deixe vazio para o EnergyPlus calcular."
                  aoGravar={(v) => editarAbertura(construcao.id, 'transmitancia_termica_verao', v)}
                />
              </div>
            </Secao>
          )}
          {(construcao.constituintes ?? []).map((c) => {
            const material = c.material_id
              ? materialEfetivo(analise.bim, ajustes, c.material_id)
              : null
            return (
              material && (
                <Secao key={c.nome} titulo={`${c.nome}: ${material.nome}`}>
                  <EditorDeMaterial material={material} />
                </Secao>
              )
            )
          })}
        </>
      )}
      {desempenho && tipo && convencao && elemento.condicao !== 'solo' && (
        <Secao titulo="Convenção de cálculo: resistências superficiais">
          <p className="nota">
            {convencao.nome}. Vale para todos os elementos deste tipo.
            {!convencao.aprovado && ' Valor padrão ainda pendente de aprovação.'}
          </p>
          <div className="grade-campos">
            <CampoNumero
              rotulo="Interna (Rsi)"
              unidade="m²·K/W"
              valor={desempenho.rsi}
              aoGravar={(v) => editarResistencia(tipo, 'rsi', v)}
            />
            {elemento.condicao !== 'interior' && (
              <CampoNumero
                rotulo="Externa (Rse)"
                unidade="m²·K/W"
                valor={desempenho.rse}
                aoGravar={(v) => editarResistencia(tipo, 'rse', v)}
              />
            )}
          </div>
        </Secao>
      )}
    </>
  )
}

// ---- Aba 6 ---------------------------------------------------------------------
function AbaOrigem({ elemento, analise }: Props) {
  const ajustes = useModelo((e) => e.ajustes)
  const valores = listarValores(analise.bim, ajustes, elemento)
  const contagem: Record<string, number> = {}
  valores.forEach((v) => {
    const origem = v.valor.origem ?? 'ausente'
    contagem[origem] = (contagem[origem] ?? 0) + 1
  })
  const ausentes = valores.filter((v) => (v.valor.origem ?? 'ausente') === 'ausente')
  const grupos = [...new Set(valores.map((v) => v.grupo))]
  return (
    <>
      <ul className="resumo-origens" aria-label="Quantidade de parâmetros por origem">
        {(['ifc', 'calculado', 'manual', 'biblioteca', 'estimado', 'ausente'] as const).map(
          (origem) => (
            <li key={origem}>
              <SeloDeOrigem origem={origem} /> <strong>{contagem[origem] ?? 0}</strong>
            </li>
          ),
        )}
      </ul>
      {ausentes.length > 0 ? (
        <p className="nota nota--alerta">
          <strong>{ausentes.length} parâmetro(s) não informado(s):</strong>{' '}
          {ausentes.map((v) => `${v.nome} (${v.grupo.replace('Material: ', '')})`).join('; ')}.
        </p>
      ) : (
        <p className="nota nota--ok">Todos os parâmetros deste elemento têm valor.</p>
      )}
      {grupos.map((g) => (
        <Secao key={g} titulo={g}>
          <div className="tabela-rolagem">
            <table>
              <thead>
                <tr>
                  <th scope="col">Parâmetro</th>
                  <th scope="col">Valor</th>
                  <th scope="col">Origem</th>
                  <th scope="col">De onde veio</th>
                </tr>
              </thead>
              <tbody>
                {valores
                  .filter((v) => v.grupo === g)
                  .map((v) => (
                    <tr key={v.nome}>
                      <th scope="row">{v.nome}</th>
                      <td>{formatarValor(v.valor)}</td>
                      <td>
                        <SeloDeOrigem origem={v.valor.origem ?? 'ausente'} />
                      </td>
                      <td className="fonte">{v.valor.fonte ?? '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Secao>
      ))}
    </>
  )
}

// ---- Material -------------------------------------------------------------------
function InspetorDeMaterial({ id, analise }: { id: string; analise: ModeloAnalise }) {
  const ajustes = useModelo((e) => e.ajustes)
  const material = materialEfetivo(analise.bim, ajustes, id)
  if (!material) return null
  const usos = analise.bim.construcoes.filter(
    (c) =>
      (c.camadas ?? []).some((k) => k.material_id === id) ||
      (c.constituintes ?? []).some((k) => k.material_id === id),
  )
  return (
    <div className="inspetor">
      <Cabecalho
        titulo={material.nome}
        subtitulo={`Material · ${material.categoria ?? 'IfcMaterial'}`}
      />
      <div className="inspetor__corpo">
        {material.descricao && <p className="nota">{material.descricao}</p>}
        <Secao titulo="Propriedades">
          <PropriedadesDoMaterial material={material} />
        </Secao>
        <Secao titulo="Editar">
          <EditorDeMaterial material={material} />
        </Secao>
        <Secao titulo="Usado em">
          {usos.length === 0 ? (
            <p className="nota">Nenhuma composição usa este material.</p>
          ) : (
            <ul className="lista-simples">
              {usos.map((c) => (
                <li key={c.id}>
                  {c.nome} — {(c.elementos_ids ?? []).length} elemento(s)
                </li>
              ))}
            </ul>
          )}
        </Secao>
      </div>
    </div>
  )
}

// ---- Ambiente -------------------------------------------------------------------
function InspetorDeAmbiente({ ambiente, analise }: { ambiente: Ambiente; analise: ModeloAnalise }) {
  const [aba, setAba] = useState<'geral' | 'superficies' | 'operacao'>('geral')
  const { termico, bim } = analise
  const zona = termico.zonas.find((z) => z.ambiente_id === ambiente.global_id)
  const superficies = termico.superficies.filter((s) => s.zona_id === zona?.id)
  const uso = useModelo((e) => e.ajustes.operacao[ambiente.global_id])
  const nomeDe = (id: string | null | undefined) =>
    bim.elementos.find((e) => e.global_id === id)?.nome ?? '—'
  return (
    <div className="inspetor">
      <Cabecalho
        titulo={`${ambiente.numero ?? ''} ${ambiente.nome ?? 'Ambiente'}`.trim()}
        subtitulo={`Ambiente · IfcSpace${zona ? ` · zona térmica ${zona.id}` : ''}`}
      />
      <Abas
        nome="Propriedades do ambiente"
        ativa={aba}
        aoTrocar={setAba}
        abas={[
          { id: 'geral', rotulo: 'Geral' },
          { id: 'superficies', rotulo: 'Superfícies', contador: superficies.length },
          { id: 'operacao', rotulo: 'Operação' },
        ]}
      />
      <div className="inspetor__corpo" role="tabpanel">
        {aba === 'geral' && (
          <>
            <dl className="lista-valores">
              <LinhaDeTexto nome="Nome">{ambiente.nome}</LinhaDeTexto>
              <LinhaDeTexto nome="Número">{ambiente.numero}</LinhaDeTexto>
              <LinhaDeTexto nome="GlobalId">
                <GlobalId id={ambiente.global_id} />
              </LinhaDeTexto>
              <LinhaDeTexto nome="Pavimento">
                {bim.pavimentos.find((p) => p.global_id === ambiente.pavimento_id)?.nome}
              </LinhaDeTexto>
              <LinhaDeTexto nome="Zona térmica associada">{zona?.id ?? 'Nenhuma'}</LinhaDeTexto>
              {Object.entries(ambiente.dimensoes ?? {}).map(([chave, valor]) => (
                <LinhaDeValor key={chave} nome={ROTULOS_DIMENSAO[chave] ?? chave} valor={valor} />
              ))}
              {zona && (
                <LinhaDeValor
                  nome="Volume pelas superfícies"
                  valor={calculado(
                    zona.volume_calculado ?? null,
                    'm³',
                    'volume fechado pelas fronteiras de espaço',
                  )}
                />
              )}
            </dl>
            <p className="nota">
              Com o ambiente selecionado, o modelo 3D mostra as superfícies que o delimitam,
              coloridas pela condição de contorno.
            </p>
          </>
        )}
        {aba === 'superficies' &&
          (superficies.length === 0 ? (
            <p className="nota nota--alerta">
              Este ambiente não tem fronteiras de espaço de 2º nível no IFC, então não há
              superfícies térmicas.
            </p>
          ) : (
            <div className="tabela-rolagem">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Superfície</th>
                    <th scope="col">Elemento</th>
                    <th scope="col">Condição</th>
                    <th scope="col">Orientação</th>
                    <th scope="col" className="numero">
                      Área líquida
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {superficies.map((s) => (
                    <tr key={s.id}>
                      <th scope="row">
                        {s.id}
                        <small> {s.tipo}</small>
                      </th>
                      <td>
                        {s.elemento_id ? (
                          <Ligacao tipo="elemento" id={s.elemento_id}>
                            {nomeDe(s.elemento_id)}
                          </Ligacao>
                        ) : (
                          '—'
                        )}
                        {termico.aberturas
                          .filter((a) => a.superficie_id === s.id)
                          .map((a) => (
                            <span key={a.id} className="abertura-filha">
                              ↳{' '}
                              {a.elemento_id ? (
                                <Ligacao tipo="elemento" id={a.elemento_id}>
                                  {nomeDe(a.elemento_id)}
                                </Ligacao>
                              ) : (
                                a.id
                              )}{' '}
                              ({formatarNumero(a.area)} m²)
                            </span>
                          ))}
                      </td>
                      <td>
                        {ROTULOS_CONDICAO[s.condicao]}
                        {s.zona_vizinha_id &&
                          `: ${termico.zonas.find((z) => z.id === s.zona_vizinha_id)?.nome}`}
                      </td>
                      <td>
                        {s.azimute == null
                          ? s.inclinacao < 90
                            ? 'Para cima'
                            : 'Para baixo'
                          : `${formatarNumero(s.azimute)}°`}
                      </td>
                      <td className="numero">{formatarNumero(s.area_liquida)} m²</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        {aba === 'operacao' && (
          <>
            <p className="nota nota--info">
              O IFC descreve a geometria e os materiais, mas <strong>não traz</strong> os dados de
              uso do ambiente. Eles precisam ser informados por você antes da simulação — a
              plataforma não preenche esses valores por conta própria.
            </p>
            <button
              type="button"
              className="botao-leve botao-leve--primario"
              onClick={() => useModelo.getState().abrirAba('operacao')}
            >
              <SlidersHorizontal size={14} aria-hidden /> Preencher os dados de uso
            </button>
            {GRUPOS_DE_USO.map((grupo) => (
              <Secao key={grupo.id} titulo={grupo.titulo}>
                <dl className="lista-valores">
                  {grupo.parametros.map((p) => (
                    <LinhaDeValor key={p.id} nome={p.rotulo} valor={uso?.[p.id]} />
                  ))}
                </dl>
              </Secao>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
