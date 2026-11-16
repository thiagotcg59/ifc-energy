import {
  Box,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  FolderOpen,
  Moon,
  PanelLeft,
  PanelRight,
  Play,
  Save,
  Sun,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { ClienteApi } from '../api/cliente'
import { Divisor, useTamanho } from '../componentes/Divisor'
import { Logotipo } from '../componentes/Logotipo'
import { temAlteracoes, useModelo } from '../estado/useModelo'
import { Inspetor } from '../funcionalidades/inspetor/Inspetor'
import { NavegadorBim } from '../funcionalidades/navegador/NavegadorBim'
import { PainelInferior } from '../funcionalidades/painel/PainelInferior'
import { Visualizador as VisualizadorPadrao } from '../visualizador3d/Visualizador'
import { TelaInicial } from './TelaInicial'

function temaInicial(): boolean {
  try {
    const salvo = window.localStorage.getItem('ifc-energy:tema')
    if (salvo) return salvo === 'escuro'
  } catch {
    // sem armazenamento
  }
  return true // o tema escuro é o padrão da área de modelagem
}

/** Ambiente de trabalho: barra superior, navegador, visualizador, inspetor e painel inferior. */
export function AreaDeTrabalho({
  api,
  modoDemo,
  Visualizador = VisualizadorPadrao,
}: {
  api: ClienteApi
  modoDemo: boolean
  Visualizador?: ComponentType<{ escuro: boolean }>
}) {
  const fase = useModelo((e) => e.fase)
  const analise = useModelo((e) => e.analise)
  const pendente = useModelo(temAlteracoes)
  const salvando = useModelo((e) => e.salvando)
  const aviso = useModelo((e) => e.aviso)
  const acoes = useModelo.getState()
  const [escuro, setEscuro] = useState(temaInicial)
  const [esquerda, setEsquerda] = useState(true)
  const [direita, setDireita] = useState(true)
  const [inferior, setInferior] = useState(true)
  const [larguraEsq, setLarguraEsq] = useTamanho('esquerda', 290, 200, 520)
  const [larguraDir, setLarguraDir] = useTamanho('direita', 400, 300, 720)
  const [alturaInf, setAlturaInf] = useTamanho('inferior', 230, 120, 560)
  const arquivo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.documentElement.dataset.tema = escuro ? 'escuro' : 'claro'
    try {
      window.localStorage.setItem('ifc-energy:tema', escuro ? 'escuro' : 'claro')
    } catch {
      // sem armazenamento
    }
  }, [escuro])

  useEffect(() => {
    if (!aviso) return
    const relogio = setTimeout(() => acoes.definir({ aviso: null }), 6000)
    return () => clearTimeout(relogio)
  }, [aviso, acoes])

  // Avisa antes de fechar a página com alterações não salvas.
  useEffect(() => {
    if (!pendente) return
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [pendente])

  const tema = (
    <button
      type="button"
      className="icone"
      aria-label={escuro ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
      title={escuro ? 'Tema claro' : 'Tema escuro'}
      onClick={() => setEscuro(!escuro)}
    >
      {escuro ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
    </button>
  )

  if (fase !== 'pronto' || !analise) {
    return (
      <div className="app app--inicio">
        <div className="inicio__tema">{tema}</div>
        <TelaInicial modoDemo={modoDemo} />
      </div>
    )
  }

  const abrirPreparacao = () => {
    setInferior(true)
    acoes.definir({ abaInferior: 'termico', mostrarSuperficies: true })
  }

  return (
    <div className="app">
      <header className="barra">
        <div className="barra__marca">
          <Logotipo />
          <span className="barra__nome">IFC Energy</span>
        </div>
        <div className="barra__projeto" title={analise.bim.arquivo}>
          <strong>{analise.bim.projeto.nome ?? analise.bim.arquivo}</strong>
          <span>
            {analise.bim.arquivo} · {analise.bim.esquema}
            {modoDemo && ' · demonstração'}
          </span>
        </div>
        <nav className="barra__acoes" aria-label="Ações do projeto">
          <button type="button" className="botao-barra" onClick={() => arquivo.current?.click()}>
            <FolderOpen size={16} aria-hidden /> <span>Abrir IFC</span>
          </button>
          <input
            ref={arquivo}
            type="file"
            accept=".ifc"
            hidden
            onChange={(e) => {
              const escolhido = e.target.files?.[0]
              e.target.value = ''
              if (escolhido) void acoes.abrirArquivo(escolhido)
            }}
          />
          <button type="button" className="botao-barra" onClick={() => void acoes.abrirExemplo()}>
            <Box size={16} aria-hidden /> <span>Modelo de exemplo</span>
          </button>
          <button
            type="button"
            className={`botao-barra${pendente ? ' botao-barra--destaque' : ''}`}
            disabled={!pendente || salvando}
            title={pendente ? 'Salvar os parâmetros editados' : 'Não há alterações para salvar'}
            onClick={() => void acoes.salvar()}
          >
            <Save size={16} aria-hidden />{' '}
            <span>{salvando ? 'Salvando…' : 'Salvar parâmetros'}</span>
          </button>
          <button
            type="button"
            className="botao-barra"
            title="Ver o modelo térmico, as checagens e o que falta para simular"
            onClick={abrirPreparacao}
          >
            <ClipboardCheck size={16} aria-hidden /> <span>Preparar simulação</span>
          </button>
          <button
            type="button"
            className="botao-barra"
            disabled
            title="A simulação deste IFC ainda não está disponível: falta a conversão validada para o EnergyPlus. Veja “Preparar simulação”."
          >
            <Play size={16} aria-hidden /> <span>Executar simulação</span>
          </button>
        </nav>
        <div className="barra__fim">
          <button
            type="button"
            className="icone"
            aria-label="Mostrar ou ocultar o navegador BIM"
            aria-pressed={esquerda}
            onClick={() => setEsquerda(!esquerda)}
          >
            <PanelLeft size={18} aria-hidden />
          </button>
          <button
            type="button"
            className="icone"
            aria-label="Mostrar ou ocultar o inspetor de propriedades"
            aria-pressed={direita}
            onClick={() => setDireita(!direita)}
          >
            <PanelRight size={18} aria-hidden />
          </button>
          {tema}
        </div>
      </header>

      <div className="corpo">
        {esquerda && (
          <>
            <aside className="painel painel--esquerda" style={{ width: larguraEsq }}>
              <h2 className="painel__titulo">Navegador BIM</h2>
              <NavegadorBim />
            </aside>
            <Divisor
              eixo="x"
              sentido={1}
              tamanho={larguraEsq}
              aoMudar={setLarguraEsq}
              rotulo="Redimensionar o navegador BIM"
            />
          </>
        )}
        <div className="centro">
          <Visualizador escuro={escuro} />
          {inferior ? (
            <>
              <Divisor
                eixo="y"
                sentido={-1}
                tamanho={alturaInf}
                aoMudar={setAlturaInf}
                rotulo="Redimensionar o painel inferior"
              />
              <div className="painel painel--inferior" style={{ height: alturaInf }}>
                <PainelInferior
                  api={api}
                  extra={
                    <button
                      type="button"
                      className="icone"
                      aria-label="Recolher o painel inferior"
                      onClick={() => setInferior(false)}
                    >
                      <ChevronDown size={16} aria-hidden />
                    </button>
                  }
                />
              </div>
            </>
          ) : (
            <button type="button" className="reabrir-inferior" onClick={() => setInferior(true)}>
              <ChevronUp size={14} aria-hidden /> Diagnóstico, modelo térmico e simulação
            </button>
          )}
        </div>
        {direita && (
          <>
            <Divisor
              eixo="x"
              sentido={-1}
              tamanho={larguraDir}
              aoMudar={setLarguraDir}
              rotulo="Redimensionar o inspetor de propriedades"
            />
            <aside className="painel painel--direita" style={{ width: larguraDir }}>
              <h2 className="painel__titulo">Inspetor de propriedades</h2>
              <Inspetor />
            </aside>
          </>
        )}
      </div>

      {aviso && (
        <div
          className={`torrada torrada--${aviso.tipo}`}
          role={aviso.tipo === 'erro' ? 'alert' : 'status'}
        >
          {aviso.texto}
          <button
            type="button"
            className="icone"
            aria-label="Fechar o aviso"
            onClick={() => acoes.definir({ aviso: null })}
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      )}
    </div>
  )
}
