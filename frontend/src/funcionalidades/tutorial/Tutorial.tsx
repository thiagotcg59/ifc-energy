import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useModelo, type AbaInferior } from '../../estado/useModelo'

interface Passo {
  id: string
  titulo: string
  conteudo: ReactNode
  /** Atalho que leva à parte da tela de que o passo fala (só com modelo aberto). */
  atalho?: { rotulo: string; aba: AbaInferior; superficies?: boolean }
}

const PASSOS: Passo[] = [
  {
    id: 'visao',
    titulo: 'Visão geral',
    conteudo: (
      <>
        <p>
          O IFC Energy lê o modelo IFC de uma casa, mostra a geometria em 3D e reúne os dados
          térmicos de paredes, pisos, coberturas, janelas e ambientes, preparando o modelo para a
          simulação no EnergyPlus.
        </p>
        <p>A tela de trabalho tem quatro áreas:</p>
        <ul>
          <li>
            <strong>Navegador BIM</strong> (esquerda): a lista de ambientes, elementos e materiais.
          </li>
          <li>
            <strong>Modelo 3D</strong> (centro): a geometria real do arquivo.
          </li>
          <li>
            <strong>Inspetor de propriedades</strong> (direita): os dados do que está selecionado.
          </li>
          <li>
            <strong>Painel inferior</strong>: diagnóstico, uso e operação, modelo térmico, simulação
            e alterações.
          </li>
        </ul>
        <p className="nota nota--alerta">
          A plataforma <strong>ainda não simula o seu IFC</strong>: falta a conversão validada do
          modelo térmico para o EnergyPlus. Por isso o botão “Executar simulação” fica desabilitado.
        </p>
      </>
    ),
  },
  {
    id: 'abrir',
    titulo: 'Abrir um modelo',
    conteudo: (
      <>
        <ol>
          <li>
            Para conhecer a ferramenta, clique em <strong>Explorar residência de exemplo</strong>:
            uma casa térrea de 70 m² com sala e cozinha, quarto e banheiro.
          </li>
          <li>
            Para o seu projeto, clique em <strong>Abrir IFC</strong> ou arraste o arquivo para a
            janela.
          </li>
        </ol>
        <p>O arquivo precisa ser:</p>
        <ul>
          <li>IFC4 em texto (extensão .ifc, não compactado);</li>
          <li>com os ambientes modelados (IfcSpace);</li>
          <li>
            com fronteiras de espaço de 2º nível, que dizem qual superfície limita cada ambiente.
          </li>
        </ul>
        <p>
          Se faltar alguma dessas informações, a aba <strong>Diagnóstico</strong> diz o que falta e
          como corrigir no programa de modelagem. A plataforma não adivinha ambientes.
        </p>
        <p className="nota nota--info">
          O seu arquivo fica só no seu computador. Na demonstração pública, apenas a residência de
          exemplo pode ser aberta.
        </p>
      </>
    ),
    atalho: { rotulo: 'Ver o diagnóstico', aba: 'diagnostico' },
  },
  {
    id: '3d',
    titulo: 'Navegar no modelo 3D',
    conteudo: (
      <>
        <ul>
          <li>
            <strong>Girar:</strong> arraste com o botão esquerdo do mouse.
          </li>
          <li>
            <strong>Aproximar e afastar:</strong> use a roda do mouse.
          </li>
          <li>
            <strong>Deslocar:</strong> arraste com o botão direito.
          </li>
          <li>
            <strong>Selecionar:</strong> clique em uma parede, janela, porta, piso ou cobertura.
          </li>
        </ul>
        <p>
          Na barra de cima do 3D ficam as vistas prontas, <strong>Enquadrar tudo</strong> e{' '}
          <strong>Enquadrar seleção</strong>. Na barra lateral ficam: ocultar ou isolar o elemento
          selecionado, mostrar tudo, volumes e nomes dos ambientes, superfícies do modelo térmico,
          corte horizontal e a visibilidade por categoria.
        </p>
      </>
    ),
  },
  {
    id: 'navegador',
    titulo: 'Encontrar elementos',
    conteudo: (
      <>
        <p>
          O <strong>Navegador BIM</strong> agrupa o modelo em ambientes, paredes, pisos, coberturas,
          janelas, portas, materiais e zonas térmicas.
        </p>
        <ul>
          <li>Clique em um item para selecioná-lo; o 3D destaca o mesmo elemento.</li>
          <li>O ícone de olho ao lado do item oculta ou mostra o elemento no 3D.</li>
          <li>
            A busca aceita o nome, a classe IFC (por exemplo, <code>IfcWindow</code>) ou o GlobalId.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'inspetor',
    titulo: 'Ler as propriedades',
    conteudo: (
      <>
        <p>Com um elemento selecionado, o inspetor mostra as abas:</p>
        <ul>
          <li>
            <strong>Identificação</strong> e <strong>Geometria</strong>: nome, classe, GlobalId e
            dimensões.
          </li>
          <li>
            <strong>Camadas</strong>: os materiais, de fora para dentro, com espessura e
            propriedades.
          </li>
          <li>
            <strong>Desempenho</strong>: resistência térmica, transmitância U e capacidade térmica,
            com a conta mostrada.
          </li>
          <li>
            <strong>Parâmetros</strong>: onde os valores são editados.
          </li>
          <li>
            <strong>Origem</strong>: de onde veio cada valor.
          </li>
        </ul>
        <p>Todo valor tem um selo de origem:</p>
        <ul className="tutorial__selos">
          <li>
            <span className="selo selo--ifc">Extraído do IFC</span> estava no arquivo.
          </li>
          <li>
            <span className="selo selo--calculado">Calculado</span> saiu de uma conta com os outros
            valores.
          </li>
          <li>
            <span className="selo selo--manual">Informado manualmente</span> foi digitado por você.
          </li>
          <li>
            <span className="selo selo--biblioteca">Biblioteca técnica</span> veio da biblioteca de
            materiais, com a fonte citada.
          </li>
          <li>
            <span className="selo selo--ausente">Não informado</span> não existe no arquivo; a
            plataforma não inventa.
          </li>
          <li>
            <span className="selo selo--estimado">Estimado</span> veio do perfil aprovado, aplicado
            por você após conferir a prévia e as fontes.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'parametros',
    titulo: 'Editar parâmetros térmicos',
    conteudo: (
      <>
        <ol>
          <li>Selecione uma parede, um piso ou uma cobertura.</li>
          <li>
            Abra a aba <strong>Parâmetros</strong> do inspetor.
          </li>
          <li>
            Altere a espessura de uma camada, as propriedades de um material, ou troque o material
            por um da biblioteca. Digite o valor e aperte Enter.
          </li>
          <li>
            A transmitância U é recalculada na hora. Valores fora dos limites são recusados com a
            explicação.
          </li>
        </ol>
        <p>
          A edição vale para todos os elementos que usam a mesma composição. O arquivo IFC original
          nunca é alterado: as edições ficam guardadas à parte e podem ser desfeitas em{' '}
          <strong>Restaurar</strong>.
        </p>
        <p className="nota nota--alerta">
          Os valores da biblioteca de materiais e as resistências superficiais ainda aguardam
          aprovação e aparecem marcados como pendentes.
        </p>
      </>
    ),
  },
  {
    id: 'uso',
    titulo: 'Uso e operação',
    conteudo: (
      <>
        <p>
          O IFC descreve a construção, mas não diz como a casa é usada. Esses dados são informados
          por você, ambiente por ambiente, na aba <strong>Uso e operação</strong> do painel
          inferior:
        </p>
        <ul>
          <li>
            <strong>Ocupação:</strong> número de pessoas, calor liberado por pessoa e horário.
          </li>
          <li>
            <strong>Iluminação</strong> e <strong>equipamentos:</strong> potência por área de piso
            (W/m²) e horário.
          </li>
          <li>
            <strong>Temperaturas de configuração:</strong> setpoints de aquecimento e de
            resfriamento.
          </li>
          <li>
            <strong>Infiltração de ar:</strong> trocas de ar por hora.
          </li>
        </ul>
        <ol>
          <li>Escolha o ambiente nos botões do topo do formulário.</li>
          <li>Preencha os campos; cada um é gravado ao apertar Enter ou sair do campo.</li>
          <li>
            Use <strong>Copiar para os outros ambientes</strong> quando o uso for parecido e depois
            ajuste as diferenças.
          </li>
        </ol>
        <p className="nota nota--info">
          Ao abrir o IFC, os campos começam vazios: <strong>a plataforma não sugere valores</strong>{' '}
          automaticamente. Use os dados do seu projeto ou o botão{' '}
          <strong>Estimar dados faltantes</strong> na barra superior. Confira o perfil de referência
          de Cuiabá, aplique as estimativas e salve os parâmetros. É possível desfazer cada
          aplicação, preservando edições posteriores.
        </p>
      </>
    ),
    atalho: { rotulo: 'Ir para o formulário', aba: 'operacao' },
  },
  {
    id: 'preparar',
    titulo: 'Preparar a simulação',
    conteudo: (
      <>
        <p>
          O botão <strong>Preparar simulação</strong> abre a aba <strong>Modelo térmico</strong> e
          mostra no 3D as superfícies de cada zona, coloridas pela condição de contorno (exterior,
          solo, outra zona).
        </p>
        <ul>
          <li>
            <strong>Prontidão:</strong> a lista do que já está pronto e do que falta para simular.
          </li>
          <li>
            <strong>Checagens automáticas:</strong> volume da zona, zonas fechadas, normais para
            fora, pares entre zonas e aberturas contidas na parede.
          </li>
          <li>
            <strong>Suposições adotadas:</strong> o que a plataforma assumiu ao montar o modelo.
          </li>
        </ul>
        <p>
          A aba <strong>Simulação</strong> roda, de ponta a ponta, um exemplo que acompanha o
          EnergyPlus. Ela mostra que a instalação funciona; não é a simulação do seu modelo.
        </p>
      </>
    ),
    atalho: { rotulo: 'Ver a prontidão', aba: 'termico', superficies: true },
  },
  {
    id: 'salvar',
    titulo: 'Salvar e exportar',
    conteudo: (
      <>
        <ul>
          <li>
            <strong>Salvar parâmetros</strong> (barra superior) grava as edições e os dados de uso.
            O botão fica em destaque quando há algo não salvo.
          </li>
          <li>
            No seu computador, os dados ficam na pasta <code>dados/modelos</code>, separados do IFC.
            Na demonstração pública, ficam só no navegador.
          </li>
          <li>
            A aba <strong>Alterações</strong> lista tudo o que foi mudado, com data, valor anterior
            e valor novo.
          </li>
          <li>
            <strong>Exportar parâmetros</strong> gera um arquivo para guardar ou levar a outro
            computador; <strong>Importar</strong> lê esse arquivo de volta.
          </li>
          <li>
            <strong>Restaurar tudo ao IFC</strong> desfaz as edições de materiais e camadas. Os
            dados de uso são apagados no próprio formulário.
          </li>
        </ul>
      </>
    ),
    atalho: { rotulo: 'Ver as alterações', aba: 'alteracoes' },
  },
]

/** Tutorial em passos (uma aba por passo), aberto pela barra superior ou pela tela inicial. */
export function Tutorial({ aoFechar }: { aoFechar: () => void }) {
  const [indice, setIndice] = useState(0)
  const modeloAberto = useModelo((e) => e.fase === 'pronto')
  const caixa = useRef<HTMLDivElement>(null)
  const passo = PASSOS[indice]!

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null
    caixa.current?.focus()
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      anterior?.focus?.()
    }
  }, [aoFechar])

  function irPara(atalho: NonNullable<Passo['atalho']>) {
    const { abrirAba, definir } = useModelo.getState()
    abrirAba(atalho.aba)
    if (atalho.superficies) definir({ mostrarSuperficies: true })
    aoFechar()
  }

  return (
    <div className="tutorial__fundo">
      <div
        ref={caixa}
        className="tutorial"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-titulo"
        tabIndex={-1}
      >
        <header className="tutorial__cabecalho">
          <h2 id="tutorial-titulo">Como usar o IFC Energy</h2>
          <button type="button" className="icone" aria-label="Fechar o tutorial" onClick={aoFechar}>
            <X size={18} aria-hidden />
          </button>
        </header>
        <div className="tutorial__corpo">
          <div
            className="tutorial__passos"
            role="tablist"
            aria-label="Passos do tutorial"
            aria-orientation="vertical"
          >
            {PASSOS.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                id={`tutorial-aba-${p.id}`}
                aria-selected={i === indice}
                aria-controls="tutorial-painel"
                tabIndex={i === indice ? 0 : -1}
                className="tutorial__passo"
                onClick={() => setIndice(i)}
                onKeyDown={(e) => {
                  const passoDaTecla =
                    e.key === 'ArrowDown' || e.key === 'ArrowRight'
                      ? 1
                      : e.key === 'ArrowUp' || e.key === 'ArrowLeft'
                        ? -1
                        : 0
                  if (!passoDaTecla) return
                  e.preventDefault()
                  const novo = (i + passoDaTecla + PASSOS.length) % PASSOS.length
                  setIndice(novo)
                  document.getElementById(`tutorial-aba-${PASSOS[novo]!.id}`)?.focus()
                }}
              >
                <span className="tutorial__numero">{i + 1}</span>
                {p.titulo}
              </button>
            ))}
          </div>
          <div
            id="tutorial-painel"
            className="tutorial__painel"
            role="tabpanel"
            aria-labelledby={`tutorial-aba-${passo.id}`}
          >
            <h3>
              {indice + 1}. {passo.titulo}
            </h3>
            {passo.conteudo}
            {passo.atalho &&
              (modeloAberto ? (
                <button
                  type="button"
                  className="botao-leve botao-leve--primario"
                  onClick={() => irPara(passo.atalho!)}
                >
                  {passo.atalho.rotulo} <ArrowRight size={14} aria-hidden />
                </button>
              ) : (
                <p className="discreto">
                  Abra a residência de exemplo para ver esta parte da tela.
                </p>
              ))}
          </div>
        </div>
        <footer className="tutorial__rodape">
          <button
            type="button"
            className="botao-leve"
            disabled={indice === 0}
            onClick={() => setIndice(indice - 1)}
          >
            <ArrowLeft size={14} aria-hidden /> Anterior
          </button>
          <span className="discreto">
            Passo {indice + 1} de {PASSOS.length}
          </span>
          {indice < PASSOS.length - 1 ? (
            <button type="button" className="botao-leve" onClick={() => setIndice(indice + 1)}>
              Próximo <ArrowRight size={14} aria-hidden />
            </button>
          ) : (
            <button type="button" className="botao-leve botao-leve--primario" onClick={aoFechar}>
              Concluir
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
