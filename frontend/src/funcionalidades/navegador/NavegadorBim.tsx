import {
  Blocks,
  Box,
  DoorOpen,
  Eye,
  EyeOff,
  Grid2x2,
  Home,
  Layers,
  PanelBottom,
  PanelTop,
  Search,
  Thermometer,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import type { Elemento } from '../../api/modelos'
import { CATEGORIAS, useModelo, type Categoria, type Selecao } from '../../estado/useModelo'

const ICONES: Record<Categoria, ReactNode> = {
  parede: <Blocks size={14} aria-hidden />,
  piso: <PanelBottom size={14} aria-hidden />,
  cobertura: <PanelTop size={14} aria-hidden />,
  janela: <Grid2x2 size={14} aria-hidden />,
  porta: <DoorOpen size={14} aria-hidden />,
  outro: <Box size={14} aria-hidden />,
}

const semAcento = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Árvore do projeto: edificação, pavimentos, ambientes, elementos, materiais e zonas. */
export function NavegadorBim() {
  const analise = useModelo((e) => e.analise)
  const selecao = useModelo((e) => e.selecao)
  const ocultos = useModelo((e) => e.ocultos)
  const { selecionar, alternarOculto } = useModelo.getState()
  const [busca, setBusca] = useState('')

  const termo = semAcento(busca.trim())
  const casa = useMemo(
    () => (campos: (string | null | undefined)[]) =>
      termo === '' || campos.some((c) => c && semAcento(c).includes(termo)),
    [termo],
  )
  if (!analise) return null
  const { bim, termico } = analise

  const item = (
    alvo: NonNullable<Selecao>,
    icone: ReactNode,
    rotulo: string,
    detalhe?: string | null,
    podeOcultar = false,
  ) => {
    const ativo = selecao?.tipo === alvo.tipo && selecao.id === alvo.id
    const oculto = Boolean(ocultos[alvo.id])
    return (
      <li key={`${alvo.tipo}-${alvo.id}`} className="arvore__item">
        <button
          type="button"
          className={`arvore__botao${ativo ? ' arvore__botao--ativo' : ''}${oculto ? ' arvore__botao--oculto' : ''}`}
          aria-current={ativo ? 'true' : undefined}
          onClick={() => selecionar(alvo)}
        >
          {icone}
          <span className="arvore__rotulo">{rotulo}</span>
          {detalhe && <span className="arvore__detalhe">{detalhe}</span>}
        </button>
        {podeOcultar && (
          <button
            type="button"
            className="arvore__olho"
            aria-label={oculto ? `Mostrar ${rotulo}` : `Ocultar ${rotulo}`}
            aria-pressed={oculto}
            onClick={() => alternarOculto(alvo.id)}
          >
            {oculto ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
          </button>
        )}
      </li>
    )
  }

  const grupo = (titulo: string, icone: ReactNode, filhos: ReactNode[], aberto = true) =>
    filhos.length > 0 && (
      <li key={titulo}>
        <details open={aberto || termo !== ''}>
          <summary>
            {icone}
            {titulo}
            <span className="arvore__contagem">{filhos.length}</span>
          </summary>
          <ul>{filhos}</ul>
        </details>
      </li>
    )

  const doElemento = (e: Elemento) =>
    item(
      { tipo: 'elemento', id: e.global_id },
      ICONES[e.categoria],
      e.nome ?? e.classe,
      e.etiqueta,
      true,
    )

  const pavimentos = bim.pavimentos.length
    ? bim.pavimentos
    : [{ global_id: '', nome: 'Sem pavimento', elevacao: null }]
  const total =
    bim.elementos.filter((e) =>
      casa([e.nome, e.classe, e.global_id, e.etiqueta, e.tipo_construtivo]),
    ).length +
    bim.ambientes.filter((a) => casa([a.nome, a.numero, 'IfcSpace', a.global_id])).length +
    bim.materiais.filter((m) => casa([m.nome, m.categoria, 'IfcMaterial'])).length

  return (
    <nav className="navegador" aria-label="Navegador BIM">
      <div className="navegador__busca">
        <Search size={15} aria-hidden />
        <input
          type="search"
          value={busca}
          placeholder="Buscar por nome, classe IFC ou GlobalId"
          aria-label="Buscar no modelo por nome, classe IFC ou GlobalId"
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>
      {termo !== '' && total === 0 ? (
        <p className="vazio">
          Nada encontrado para “{busca}”. Tente parte do nome, a classe (ex.: IfcWall) ou o
          GlobalId.
        </p>
      ) : (
        <ul className="arvore">
          <li>
            <details open>
              <summary>
                <Home size={14} aria-hidden />
                {bim.projeto.edificio ?? bim.projeto.nome ?? 'Edificação'}
              </summary>
              <ul>
                {pavimentos.map((p) => {
                  const dele = (id: string | null | undefined) =>
                    !p.global_id || !id || id === p.global_id
                  const ambientes = bim.ambientes
                    .filter(
                      (a) =>
                        dele(a.pavimento_id) && casa([a.nome, a.numero, 'IfcSpace', a.global_id]),
                    )
                    .map((a) =>
                      item(
                        { tipo: 'ambiente', id: a.global_id },
                        <Box size={14} aria-hidden />,
                        a.nome ?? 'Ambiente',
                        a.numero,
                      ),
                    )
                  return (
                    <li key={p.global_id || 'sem'}>
                      <details open>
                        <summary>
                          <Layers size={14} aria-hidden />
                          {p.nome ?? 'Pavimento'}
                        </summary>
                        <ul>
                          {grupo('Ambientes', <Box size={14} aria-hidden />, ambientes)}
                          {CATEGORIAS.map((c) =>
                            grupo(
                              c.plural,
                              ICONES[c.id],
                              bim.elementos
                                .filter(
                                  (e) =>
                                    e.categoria === c.id &&
                                    dele(e.pavimento_id) &&
                                    casa([
                                      e.nome,
                                      e.classe,
                                      e.global_id,
                                      e.etiqueta,
                                      e.tipo_construtivo,
                                    ]),
                                )
                                .map(doElemento),
                              c.id !== 'outro',
                            ),
                          )}
                        </ul>
                      </details>
                    </li>
                  )
                })}
              </ul>
            </details>
          </li>
          {grupo(
            'Materiais',
            <Layers size={14} aria-hidden />,
            bim.materiais
              .filter((m) => casa([m.nome, m.categoria, 'IfcMaterial']))
              .map((m) =>
                item(
                  { tipo: 'material', id: m.id },
                  <Layers size={14} aria-hidden />,
                  m.nome,
                  m.categoria,
                ),
              ),
            false,
          )}
          {grupo(
            'Zonas térmicas',
            <Thermometer size={14} aria-hidden />,
            termico.zonas
              .filter((z) => casa([z.nome, z.id]))
              .map((z) =>
                item(
                  { tipo: 'ambiente', id: z.ambiente_id },
                  <Thermometer size={14} aria-hidden />,
                  z.nome ?? z.id,
                  z.id,
                ),
              ),
            false,
          )}
        </ul>
      )}
    </nav>
  )
}
