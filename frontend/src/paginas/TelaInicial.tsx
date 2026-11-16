import { Box, FolderOpen, Layers, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { useRef, useState } from 'react'
import { Aviso } from '../componentes/Aviso'
import { Carregando } from '../componentes/Carregando'
import { Logotipo } from '../componentes/Logotipo'
import { useModelo } from '../estado/useModelo'

/** Primeira tela: abrir a residência de exemplo ou um arquivo IFC. */
export function TelaInicial({ modoDemo }: { modoDemo: boolean }) {
  const fase = useModelo((e) => e.fase)
  const etapa = useModelo((e) => e.etapa)
  const erro = useModelo((e) => e.erro)
  const { abrirExemplo, abrirArquivo } = useModelo.getState()
  const arquivo = useRef<HTMLInputElement>(null)
  const [arrastando, setArrastando] = useState(false)
  const ocupado = fase === 'carregando'

  return (
    <main
      className={`inicio${arrastando ? ' inicio--arrastando' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setArrastando(true)
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(e) => {
        e.preventDefault()
        setArrastando(false)
        const solto = e.dataTransfer.files[0]
        if (solto && !ocupado) void abrirArquivo(solto)
      }}
    >
      <div className="inicio__cartao">
        <div className="inicio__marca">
          <Logotipo tamanho={44} />
          <div>
            <h1>IFC Energy</h1>
            <p>Análise termoenergética de edificações a partir de modelos IFC</p>
          </div>
        </div>

        {ocupado ? (
          <Carregando texto={etapa} />
        ) : (
          <>
            <div className="inicio__acoes">
              <button
                type="button"
                className="botao botao--grande"
                onClick={() => void abrirExemplo()}
              >
                <Box size={20} aria-hidden />
                <span>
                  Explorar residência de exemplo
                  <small>Casa térrea de 70 m², IFC4 sintético com 3 ambientes</small>
                </span>
              </button>
              <button
                type="button"
                className="botao botao--secundario botao--grande"
                onClick={() => arquivo.current?.click()}
              >
                <FolderOpen size={20} aria-hidden />
                <span>
                  Abrir arquivo IFC…
                  <small>
                    {modoDemo
                      ? 'Disponível ao rodar no seu computador'
                      : 'ou arraste o arquivo para esta janela'}
                  </small>
                </span>
              </button>
              <input
                ref={arquivo}
                type="file"
                accept=".ifc"
                hidden
                onChange={(e) => {
                  const escolhido = e.target.files?.[0]
                  e.target.value = ''
                  if (escolhido) void abrirArquivo(escolhido)
                }}
              />
            </div>
            {erro && (
              <Aviso tipo="erro" titulo="Não foi possível abrir o modelo">
                <p>{erro}</p>
              </Aviso>
            )}
          </>
        )}

        <ul className="inicio__recursos">
          <li>
            <Layers size={18} aria-hidden />
            <span>
              <strong>Modelo 3D real</strong> — a geometria vem do próprio IFC; clique em paredes,
              janelas, pisos e coberturas.
            </span>
          </li>
          <li>
            <SlidersHorizontal size={18} aria-hidden />
            <span>
              <strong>Parâmetros térmicos rastreáveis</strong> — cada valor diz se veio do IFC, de
              cálculo, da biblioteca ou de você.
            </span>
          </li>
          <li>
            <ShieldCheck size={18} aria-hidden />
            <span>
              <strong>Seu arquivo fica no seu computador</strong> — nada é enviado a serviços
              externos.
            </span>
          </li>
        </ul>
        {modoDemo && (
          <p className="nota nota--info">
            <strong>Modo demonstração.</strong> Aqui não há backend: a residência de exemplo e a sua
            análise foram gravadas a partir de uma execução real da plataforma. As edições ficam
            guardadas só neste navegador.
          </p>
        )}
      </div>
    </main>
  )
}
