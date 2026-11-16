import {
  Box,
  Eye,
  EyeOff,
  Focus,
  Layers,
  Maximize,
  Scissors,
  SquareDashed,
  Tag,
  Target,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Aviso } from '../componentes/Aviso'
import { Carregando } from '../componentes/Carregando'
import { CORES_DA_CONDICAO } from '../componentes/formatos'
import { CATEGORIAS, useModelo } from '../estado/useModelo'
import { carregarIfc } from './carregarIfc'
import { Cena, type SuperficieDesenhada, type Vista } from './Cena'

const VISTAS: { id: Vista; rotulo: string }[] = [
  { id: 'iso', rotulo: 'Isométrica' },
  { id: 'topo', rotulo: 'Superior' },
  { id: 'frente', rotulo: 'Frontal' },
  { id: 'lado', rotulo: 'Lateral' },
]

/** Visualizador 3D do IFC, ligado ao estado da área de trabalho. */
export function Visualizador({ escuro }: { escuro: boolean }) {
  const alvo = useRef<HTMLDivElement>(null)
  const cena = useRef<Cena | null>(null)
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'erro'>('carregando')
  const [erro, setErro] = useState('')
  const [dica, setDica] = useState<{ texto: string; x: number; y: number } | null>(null)
  const [corte, setCorte] = useState<number | null>(null)
  const [alturaMaxima, setAlturaMaxima] = useState(3)
  const [menu, setMenu] = useState(false)

  const ifc = useModelo((e) => e.ifc)
  const analise = useModelo((e) => e.analise)
  const selecao = useModelo((e) => e.selecao)
  const ocultos = useModelo((e) => e.ocultos)
  const isolados = useModelo((e) => e.isolados)
  const categoriasOcultas = useModelo((e) => e.categoriasOcultas)
  const transparentes = useModelo((e) => e.transparentes)
  const mostrarAmbientes = useModelo((e) => e.mostrarAmbientes)
  const mostrarRotulos = useModelo((e) => e.mostrarRotulos)
  const mostrarSuperficies = useModelo((e) => e.mostrarSuperficies)
  const acoes = useModelo.getState()

  const nomes = useMemo(() => {
    const mapa = new Map<string, string>()
    analise?.bim.elementos.forEach((e) => mapa.set(e.global_id, e.nome ?? e.classe))
    analise?.bim.ambientes.forEach((a) =>
      mapa.set(a.global_id, `Ambiente ${a.numero ?? ''} ${a.nome ?? ''}`),
    )
    return mapa
  }, [analise])

  // Cria a cena uma vez.
  useEffect(() => {
    if (!alvo.current) return
    let nova: Cena
    try {
      nova = new Cena(alvo.current, {
        aoSelecionar(id) {
          const { analise: atual, selecionar } = useModelo.getState()
          if (!id) return selecionar(null)
          const ambiente = atual?.bim.ambientes.some((a) => a.global_id === id)
          selecionar({ tipo: ambiente ? 'ambiente' : 'elemento', id })
        },
        aoPassar(id, x, y) {
          setDica(id ? { texto: nomesRef.current.get(id) ?? id, x, y } : null)
        },
      })
    } catch {
      setErro(
        'O navegador não conseguiu iniciar os gráficos 3D (WebGL). Atualize o navegador ou ative a aceleração de hardware nas configurações.',
      )
      setEstado('erro')
      return
    }
    cena.current = nova
    ;(window as unknown as { __ifcEnergy?: unknown }).__ifcEnergy = {
      cena: nova,
      estado: () => useModelo.getState(),
    }
    return () => {
      nova.destruir()
      cena.current = null
    }
  }, [])
  const nomesRef = useRef(nomes)
  nomesRef.current = nomes

  // Carrega a geometria quando o arquivo muda.
  useEffect(() => {
    if (!ifc || !analise || !cena.current) return
    let ativo = true
    setEstado('carregando')
    carregarIfc(ifc)
      .then((elementos) => {
        if (!ativo || !cena.current) return
        const categorias = Object.fromEntries(
          analise.bim.elementos.map((e) => [e.global_id, e.categoria]),
        )
        cena.current.carregar(elementos, categorias)
        setAlturaMaxima(cena.current.alturaDoModelo())
        setCorte(null)
        setEstado('pronto')
      })
      .catch((falha: unknown) => {
        if (!ativo) return
        setErro(
          `Não foi possível desenhar a geometria do IFC. ${falha instanceof Error ? falha.message : ''} Recarregue a página e abra o arquivo de novo.`,
        )
        setEstado('erro')
      })
    return () => {
      ativo = false
    }
  }, [ifc, analise])

  const zonaSelecionada =
    selecao?.tipo === 'ambiente'
      ? analise?.termico.zonas.find((z) => z.ambiente_id === selecao.id)
      : undefined
  const fantasma = mostrarSuperficies || Boolean(zonaSelecionada)

  useEffect(() => {
    if (estado !== 'pronto') return
    cena.current?.aplicarVisibilidade({
      ocultos,
      isolados,
      categoriasOcultas,
      transparentes,
      mostrarAmbientes,
      fantasma,
    })
  }, [estado, ocultos, isolados, categoriasOcultas, transparentes, mostrarAmbientes, fantasma])

  useEffect(() => {
    if (estado === 'pronto') cena.current?.selecionar(selecao?.id ?? null)
  }, [estado, selecao])

  useEffect(() => cena.current?.tema(escuro), [escuro])
  useEffect(() => cena.current?.corte(corte), [corte])

  useEffect(() => {
    if (estado !== 'pronto' || !analise) return
    cena.current?.definirRotulos(
      mostrarRotulos
        ? analise.bim.ambientes.map((a) => ({
            id: a.global_id,
            texto: `${a.numero ?? ''} ${a.nome ?? ''}`.trim(),
          }))
        : [],
    )
  }, [estado, analise, mostrarRotulos])

  useEffect(() => {
    if (estado !== 'pronto' || !analise) return
    if (!fantasma) return cena.current?.definirSuperficies(null)
    const { superficies, aberturas } = analise.termico
    const daZona = (zonaId: string) => !zonaSelecionada || zonaSelecionada.id === zonaId
    const zonaDe = new Map(superficies.map((s) => [s.id, s.zona_id]))
    const lista: SuperficieDesenhada[] = [
      ...superficies
        .filter((s) => daZona(s.zona_id))
        .map((s) => ({
          id: s.id,
          vertices: s.vertices as [number, number, number][],
          cor: CORES_DA_CONDICAO[s.condicao]!.cor,
          destacada: selecao?.id === s.elemento_id,
        })),
      ...aberturas
        .filter((a) => daZona(zonaDe.get(a.superficie_id) ?? ''))
        .map((a) => ({
          id: a.id,
          vertices: a.vertices as [number, number, number][],
          cor: CORES_DA_CONDICAO.abertura!.cor,
          destacada: true,
        })),
    ]
    cena.current?.definirSuperficies(lista)
  }, [estado, analise, fantasma, zonaSelecionada, selecao])

  const idSelecionado = selecao && selecao.tipo !== 'material' ? selecao.id : null

  return (
    <section className="visualizador" aria-label="Visualizador 3D do modelo IFC">
      <div ref={alvo} className="visualizador__tela" />

      {estado === 'pronto' && (
        <>
          <div className="barra-3d barra-3d--topo" role="toolbar" aria-label="Vistas e câmera">
            {VISTAS.map((v) => (
              <button
                key={v.id}
                type="button"
                className="botao-3d"
                onClick={() => cena.current?.vista(v.id)}
              >
                {v.rotulo}
              </button>
            ))}
            <span className="barra-3d__sep" />
            <button
              type="button"
              className="botao-3d"
              title="Enquadrar o modelo inteiro"
              onClick={() => cena.current?.enquadrar()}
            >
              <Maximize size={15} aria-hidden /> Enquadrar tudo
            </button>
            <button
              type="button"
              className="botao-3d"
              disabled={!idSelecionado}
              title="Enquadrar o elemento selecionado"
              onClick={() => idSelecionado && cena.current?.enquadrar([idSelecionado])}
            >
              <Focus size={15} aria-hidden /> Enquadrar seleção
            </button>
          </div>

          <div className="barra-3d barra-3d--lado" role="toolbar" aria-label="Visibilidade">
            <button
              type="button"
              className="botao-3d"
              disabled={selecao?.tipo !== 'elemento'}
              title="Ocultar o elemento selecionado"
              onClick={() => idSelecionado && acoes.alternarOculto(idSelecionado)}
            >
              <EyeOff size={15} aria-hidden /> Ocultar
            </button>
            <button
              type="button"
              className="botao-3d"
              aria-pressed={isolados !== null}
              disabled={selecao?.tipo !== 'elemento' && isolados === null}
              title="Mostrar só o elemento selecionado"
              onClick={() => acoes.isolar(isolados ? null : idSelecionado ? [idSelecionado] : null)}
            >
              <Target size={15} aria-hidden /> Isolar
            </button>
            <button
              type="button"
              className="botao-3d"
              title="Mostrar todos os elementos"
              onClick={acoes.mostrarTudo}
            >
              <Eye size={15} aria-hidden /> Mostrar tudo
            </button>
            <span className="barra-3d__sep" />
            <button
              type="button"
              className="botao-3d"
              aria-pressed={mostrarAmbientes}
              title="Mostrar os volumes dos ambientes (IfcSpace)"
              onClick={() => acoes.definir({ mostrarAmbientes: !mostrarAmbientes })}
            >
              <Box size={15} aria-hidden /> Ambientes
            </button>
            <button
              type="button"
              className="botao-3d"
              aria-pressed={mostrarRotulos}
              title="Mostrar os nomes dos ambientes"
              onClick={() => acoes.definir({ mostrarRotulos: !mostrarRotulos })}
            >
              <Tag size={15} aria-hidden /> Rótulos
            </button>
            <button
              type="button"
              className="botao-3d"
              aria-pressed={mostrarSuperficies}
              title="Mostrar as superfícies do modelo térmico, coloridas pela condição de contorno"
              onClick={() => acoes.definir({ mostrarSuperficies: !mostrarSuperficies })}
            >
              <SquareDashed size={15} aria-hidden /> Superfícies térmicas
            </button>
            <button
              type="button"
              className="botao-3d"
              aria-pressed={corte !== null}
              title="Corte horizontal"
              onClick={() => setCorte(corte === null ? Math.min(1.5, alturaMaxima / 2) : null)}
            >
              <Scissors size={15} aria-hidden /> Corte
            </button>
            <button
              type="button"
              className="botao-3d"
              aria-expanded={menu}
              title="Visibilidade e transparência por categoria"
              onClick={() => setMenu(!menu)}
            >
              <Layers size={15} aria-hidden /> Categorias
            </button>
          </div>

          {corte !== null && (
            <label className="corte">
              Altura do corte: {corte.toFixed(2).replace('.', ',')} m
              <input
                type="range"
                min={0.05}
                max={alturaMaxima}
                step={0.05}
                value={corte}
                onChange={(e) => setCorte(Number(e.target.value))}
              />
            </label>
          )}

          {menu && (
            <div className="menu-categorias" role="group" aria-label="Categorias">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Categoria</th>
                    <th scope="col">Visível</th>
                    <th scope="col">Transparente</th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORIAS.filter((c) =>
                    analise?.bim.elementos.some((e) => e.categoria === c.id),
                  ).map((c) => (
                    <tr key={c.id}>
                      <th scope="row">{c.plural}</th>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`${c.plural} visíveis`}
                          checked={!categoriasOcultas[c.id]}
                          onChange={() => acoes.alternarCategoria(c.id)}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`${c.plural} transparentes`}
                          checked={Boolean(transparentes[c.id])}
                          onChange={() => acoes.alternarTransparencia(c.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {fantasma && (
            <ul className="legenda-3d" aria-label="Condição de contorno das superfícies">
              {Object.entries(CORES_DA_CONDICAO).map(([chave, { cor, rotulo }]) => (
                <li key={chave}>
                  <span style={{ background: cor }} aria-hidden />
                  {rotulo}
                </li>
              ))}
            </ul>
          )}
          <p className="ajuda-3d">
            Arraste para girar · botão direito para mover · roda para aproximar · clique para
            selecionar
          </p>
        </>
      )}

      {dica && estado === 'pronto' && (
        <span className="dica-3d" style={{ left: dica.x + 14, top: dica.y + 14 }}>
          {dica.texto}
        </span>
      )}
      {estado === 'carregando' && (
        <div className="visualizador__sobre">
          <Carregando texto="Lendo a geometria do IFC…" />
        </div>
      )}
      {estado === 'erro' && (
        <div className="visualizador__sobre">
          <Aviso tipo="erro" titulo="Visualizador 3D indisponível">
            <p>{erro}</p>
          </Aviso>
        </div>
      )}
    </section>
  )
}
