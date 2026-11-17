import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import type { ClienteApi } from '../api/cliente'
import { ErroApi } from '../api/cliente'
import { definirApi, useModelo } from '../estado/useModelo'
import { ANALISE, apiFalsa, elemento } from '../testes/exemplo'
import { AreaDeTrabalho } from './AreaDeTrabalho'

// O visualizador de verdade precisa de WebGL (não existe no ambiente de teste).
// Este substituto faz o papel dele: mostra quem está selecionado e "clica" em
// um elemento chamando a mesma ação que o clique no 3D chama.
function VisualizadorFalso() {
  const selecao = useModelo((e) => e.selecao)
  return (
    <div>
      <output aria-label="Destacado no 3D">{selecao?.id ?? 'nada'}</output>
      {ANALISE.bim.elementos.map((e) => (
        <button
          key={e.global_id}
          type="button"
          onClick={() => useModelo.getState().selecionar({ tipo: 'elemento', id: e.global_id })}
        >
          3D: {e.etiqueta}
        </button>
      ))}
    </div>
  )
}

const apiSistema: ClienteApi = {
  obterSaude: vi.fn().mockRejectedValue(new ErroApi('sem backend')),
  simularExemplo: vi.fn(),
  obterSimulacao: vi.fn(),
  obterResultados: vi.fn(),
}
let falsa: ReturnType<typeof apiFalsa>

async function abrir(modoDemo = false) {
  render(<AreaDeTrabalho api={apiSistema} modoDemo={modoDemo} Visualizador={VisualizadorFalso} />)
  await userEvent.click(screen.getByRole('button', { name: /Explorar residência de exemplo/ }))
  await screen.findByRole('navigation', { name: 'Navegador BIM' })
}
const painelDireito = () => document.querySelector<HTMLElement>('.painel--direita')!
const aba = (nome: string) => userEvent.click(screen.getByRole('tab', { name: nome }))

beforeEach(() => {
  falsa = apiFalsa()
  definirApi(falsa.api)
  useModelo.getState().fechar()
  window.localStorage.clear()
})

test('tela inicial destaca a residência de exemplo e explica a privacidade', () => {
  render(<AreaDeTrabalho api={apiSistema} modoDemo={false} Visualizador={VisualizadorFalso} />)

  expect(screen.getByRole('button', { name: /Explorar residência de exemplo/ })).toBeEnabled()
  expect(screen.getByRole('button', { name: /Abrir arquivo IFC/ })).toBeEnabled()
  expect(screen.getByText(/Seu arquivo fica no seu computador/)).toBeInTheDocument()
  expect(screen.queryByText('Modo demonstração.')).not.toBeInTheDocument()
})

test('modo demonstração avisa que não há backend e onde ficam as edições', () => {
  render(<AreaDeTrabalho api={apiSistema} modoDemo Visualizador={VisualizadorFalso} />)

  expect(screen.getByText('Modo demonstração.')).toBeInTheDocument()
  expect(screen.getByText(/ficam guardadas só neste navegador/)).toBeInTheDocument()
})

test('erro ao abrir o modelo aparece com a orientação', async () => {
  definirApi(
    apiFalsa({ abrirExemplo: () => Promise.reject(new ErroApi('Confira o iniciar.ps1')) }).api,
  )
  render(<AreaDeTrabalho api={apiSistema} modoDemo={false} Visualizador={VisualizadorFalso} />)

  await userEvent.click(screen.getByRole('button', { name: /Explorar residência de exemplo/ }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Confira o iniciar.ps1')
})

test('a árvore BIM lista ambientes e elementos do IFC', async () => {
  await abrir()
  const arvore = screen.getByRole('navigation', { name: 'Navegador BIM' })

  for (const nome of [
    'Sala e cozinha',
    'Quarto',
    'Banheiro',
    'Parede externa sul',
    'Piso térreo',
  ]) {
    expect(within(arvore).getAllByText(nome).length).toBeGreaterThan(0)
  }
  expect(within(arvore).getByText('Paredes').parentElement).toHaveTextContent('6')
  expect(within(arvore).getByText('Janelas').parentElement).toHaveTextContent('5')
})

test('clicar no 3D seleciona o elemento, destaca na árvore e abre o inspetor', async () => {
  await abrir()
  expect(painelDireito()).toHaveTextContent('Nenhum elemento selecionado')

  await userEvent.click(screen.getByRole('button', { name: '3D: PE-N' }))

  expect(painelDireito()).toHaveTextContent('Parede externa norte')
  expect(painelDireito()).toHaveTextContent(elemento('PE-N').global_id)
  const ativo = document.querySelector('.arvore__botao--ativo')
  expect(ativo).toHaveTextContent('Parede externa norte')
})

test('clicar na árvore destaca o mesmo elemento no 3D', async () => {
  await abrir()
  const arvore = screen.getByRole('navigation', { name: 'Navegador BIM' })

  await userEvent.click(within(arvore).getByText('Janela da sala (norte)'))

  expect(screen.getByLabelText('Destacado no 3D')).toHaveTextContent(elemento('J1').global_id)
  expect(painelDireito()).toHaveTextContent('IfcWindow')
})

test('busca por nome, classe IFC e GlobalId', async () => {
  await abrir()
  const busca = screen.getByRole('searchbox')
  const arvore = screen.getByRole('navigation', { name: 'Navegador BIM' })

  await userEvent.type(busca, 'ifcdoor')
  expect(within(arvore).getByText('Porta de entrada')).toBeInTheDocument()
  expect(within(arvore).queryByText('Parede externa sul')).not.toBeInTheDocument()

  await userEvent.clear(busca)
  await userEvent.type(busca, elemento('PISO').global_id)
  expect(within(arvore).getByText('Piso térreo')).toBeInTheDocument()
  expect(within(arvore).queryByText('Porta de entrada')).not.toBeInTheDocument()

  await userEvent.clear(busca)
  await userEvent.type(busca, 'nada disso existe')
  expect(within(arvore).getByText(/Nada encontrado/)).toBeInTheDocument()
})

test('camadas com propriedades, unidades e origem de cada valor', async () => {
  await abrir()
  await userEvent.click(screen.getByRole('button', { name: '3D: PE-S' }))
  await aba('Camadas')

  const camadas = within(painelDireito()).getAllByRole('listitem')
  expect(camadas.map((c) => c.querySelector('.camada__nome')?.textContent)).toEqual([
    'Argamassa de reboco',
    'Alvenaria de tijolo cerâmico',
    'Argamassa de reboco',
  ])
  await userEvent.click(within(camadas[1]!).getByText('Alvenaria de tijolo cerâmico'))
  expect(camadas[1]).toHaveTextContent('0,89 W/(m·K)')
  expect(camadas[1]).toHaveTextContent('1.920 kg/m³')
  expect(camadas[1]).toHaveTextContent('790 J/(kg·K)')
  expect(camadas[1]).toHaveTextContent('Extraído do IFC')
  // A absortância solar não está no IFC: aparece como ausente, sem valor inventado.
  const absortancia = within(camadas[1]!).getByText('Absortância solar').closest('.linha-valor')
  expect(absortancia).toHaveTextContent('Não informado')
})

test('desempenho: R das camadas separado das resistências superficiais', async () => {
  await abrir()
  await userEvent.click(screen.getByRole('button', { name: '3D: PE-S' }))
  await aba('Desempenho')

  const linha = (nome: string) =>
    within(painelDireito()).getByText(nome).closest<HTMLElement>('.linha-valor')!
  expect(linha('Resistência das camadas')).toHaveTextContent('0,1818 m²·K/W')
  expect(linha('Resistência superficial interna')).toHaveTextContent('0,13 m²·K/W')
  expect(linha('Resistência superficial interna')).toHaveTextContent('Biblioteca técnica')
  expect(linha('Transmitância térmica')).toHaveTextContent('2,842 W/(m²·K)')
  expect(linha('Capacidade térmica')).toHaveTextContent('229,6 kJ/(m²·K)')
  expect(painelDireito()).toHaveTextContent('outside_boundary_condition = Outdoors')
})

test('editar a espessura recalcula U, registra o histórico e habilita o salvar', async () => {
  await abrir()
  await userEvent.click(screen.getByRole('button', { name: '3D: PE-S' }))
  await aba('Parâmetros')
  const salvar = screen.getByRole('button', { name: /Salvar parâmetros/ })
  expect(salvar).toBeDisabled()
  expect(painelDireito()).toHaveTextContent('os 4 elemento(s)')

  const campo = within(painelDireito()).getAllByLabelText('Espessura (e)')[1]!
  await userEvent.clear(campo)
  await userEvent.type(campo, '0,20{Enter}')

  // U = 1 / (0,13 + 0,025/0,72 + 0,20/0,89 + 0,025/0,72 + 0,04) = 2,154
  expect(within(painelDireito()).getByText('Transmitância U').parentElement).toHaveTextContent(
    '2,154',
  )
  expect(salvar).toBeEnabled()

  await userEvent.click(salvar)
  await waitFor(() =>
    expect(document.querySelector('.torrada')).toHaveTextContent('salvos neste computador'),
  )
  expect(falsa.salvos.get(ANALISE.id)!.historico).toHaveLength(1)
  expect(salvar).toBeDisabled()
})

test('valor inválido mostra o erro no campo e não altera nada', async () => {
  await abrir()
  await userEvent.click(screen.getByRole('button', { name: '3D: PE-S' }))
  await aba('Parâmetros')

  const campo = within(painelDireito()).getAllByLabelText('Espessura (e)')[1]!
  await userEvent.clear(campo)
  await userEvent.type(campo, 'abc{Enter}')
  expect(within(painelDireito()).getByRole('alert')).toHaveTextContent('Informe um número')

  await userEvent.clear(campo)
  await userEvent.type(campo, '50{Enter}')
  expect(within(painelDireito()).getByRole('alert')).toHaveTextContent('entre 0.001 e 2')
  expect(useModelo.getState().ajustes.historico).toHaveLength(0)
})

test('aba Origem conta os valores por origem e lista os ausentes', async () => {
  await abrir()
  await userEvent.click(screen.getByRole('button', { name: '3D: PE-S' }))
  await aba('Origem')

  const resumo = screen.getByRole('list', { name: 'Quantidade de parâmetros por origem' })
  expect(within(resumo).getByText('Não informado').closest('li')).toHaveTextContent('4')
  expect(painelDireito()).toHaveTextContent('4 parâmetro(s) não informado(s)')
  expect(painelDireito()).toHaveTextContent('Pset_MaterialThermal.ThermalConductivity')
})

test('janela: vidro separado da janela completa; U e fator solar não são inventados', async () => {
  await abrir()
  await userEvent.click(screen.getByRole('button', { name: '3D: J1' }))
  await aba('Vidro e caixilho')
  expect(painelDireito()).toHaveTextContent('Transmitância solar do vidro')
  expect(painelDireito()).toHaveTextContent('0,837')

  await aba('Desempenho')
  const fator = within(painelDireito()).getByText('Fator solar (SHGC) da janela')
  expect(fator.closest('.linha-valor')).toHaveTextContent('Não informado')
})

test('ambiente: superfícies delimitadoras e dados de operação não preenchidos', async () => {
  await abrir()
  const arvore = screen.getByRole('navigation', { name: 'Navegador BIM' })
  await userEvent.click(within(arvore).getAllByText('Sala e cozinha')[0]!)

  expect(painelDireito()).toHaveTextContent('zona térmica Z1')
  expect(painelDireito()).toHaveTextContent('39,2 m²')
  await userEvent.click(screen.getByRole('tab', { name: /Superfícies/ }))
  expect(within(painelDireito()).getAllByRole('row')).toHaveLength(9) // cabeçalho + 8
  expect(painelDireito()).toHaveTextContent('Outra zona térmica: Quarto')

  await aba('Operação')
  expect(painelDireito()).toHaveTextContent('não traz')
  // Antes havia uma linha única "Temperaturas de configuração"; com o formulário
  // de uso, cada setpoint tem a sua linha. Sem preenchimento, continua ausente.
  const setpoint = within(painelDireito()).getByText('Setpoint de resfriamento')
  expect(setpoint.closest('.linha-valor')).toHaveTextContent('Não informado')
})

test('painel inferior: diagnóstico, checagens e simulação do IFC marcada como indisponível', async () => {
  await abrir()
  const inferior = document.querySelector<HTMLElement>('.painel-inferior')!
  expect(inferior).toHaveTextContent('absortância solar')

  await userEvent.click(screen.getByRole('button', { name: /Preparar simulação/ }))
  expect(inferior).toHaveTextContent('Todas as zonas estão fechadas')
  expect(inferior).toHaveTextContent('Conversão do modelo térmico para epJSON')
  expect(inferior).toHaveTextContent('Ainda não implementado')
  expect(screen.getByRole('button', { name: /Executar simulação/ })).toBeDisabled()
})

// ---- Uso e operação ---------------------------------------------------------------
const inferior = () => document.querySelector<HTMLElement>('.painel-inferior')!
const sala = () => ANALISE.bim.ambientes.find((a) => a.nome === 'Sala e cozinha')!.global_id
async function abrirUsoDaSala() {
  await abrir()
  await userEvent.click(screen.getByRole('tab', { name: /Uso e operação/ }))
  expect(inferior()).toHaveTextContent('Escolha um ambiente')
  await userEvent.click(within(inferior()).getByRole('button', { name: /Sala e cozinha/ }))
}
async function preencher(rotulo: string, valor: string) {
  const campo = within(inferior()).getByLabelText(rotulo)
  await userEvent.clear(campo)
  await userEvent.type(campo, `${valor}{Enter}`)
}

test('uso: os campos começam vazios; o valor informado fica como manual e entra no histórico', async () => {
  await abrirUsoDaSala()
  for (const campo of within(inferior()).getAllByRole('textbox')) expect(campo).toHaveValue('')

  await preencher('Número de pessoas', '2')

  const salvo = useModelo.getState().ajustes.operacao[sala()]!.pessoas!
  expect(salvo).toMatchObject({ valor: 2, unidade: 'pessoas', origem: 'manual' })
  expect(useModelo.getState().ajustes.historico).toHaveLength(1)
  expect(screen.getByRole('button', { name: /Salvar parâmetros/ })).toBeEnabled()
  // O inspetor do ambiente mostra o mesmo valor, com a origem.
  await aba('Operação')
  const linha = within(painelDireito()).getByText('Número de pessoas').closest('.linha-valor')
  expect(linha).toHaveTextContent('2 pessoas')
  expect(linha).toHaveTextContent('Informado manualmente')
})

test('uso: valores fora do limite ou incoerentes são recusados com explicação', async () => {
  await abrirUsoDaSala()

  await preencher('Potência de iluminação', '5000')
  expect(within(inferior()).getByRole('alert')).toHaveTextContent('entre 0 e 100 W/m²')

  await preencher('Potência de iluminação', '')
  await preencher('Setpoint de aquecimento', '26')
  await preencher('Setpoint de resfriamento', '24')
  expect(within(inferior()).getByRole('alert')).toHaveTextContent(
    'resfriamento precisa ser maior que o de aquecimento',
  )
  expect(useModelo.getState().ajustes.operacao[sala()]).toEqual({
    setpoint_aquecimento: expect.objectContaining({ valor: 26 }),
  })
})

test('uso: copiar para os outros ambientes e apagar', async () => {
  await abrirUsoDaSala()
  await preencher('Número de pessoas', '2')

  await userEvent.click(screen.getByRole('button', { name: /Copiar para os outros ambientes/ }))
  const { operacao } = useModelo.getState().ajustes
  expect(ANALISE.bim.ambientes.map((a) => operacao[a.global_id]?.pessoas?.valor)).toEqual([2, 2, 2])

  await userEvent.click(screen.getByRole('button', { name: /Apagar os dados deste ambiente/ }))
  expect(useModelo.getState().ajustes.operacao[sala()]).toBeUndefined()
})

test('prontidão: os dados de uso ficam pendentes até todos os ambientes estarem completos', async () => {
  await abrir()
  await userEvent.click(screen.getByRole('button', { name: /Preparar simulação/ }))
  const etapa = () =>
    within(inferior()).getByText('Ocupação, iluminação, equipamentos e setpoints').closest('li')!
  expect(etapa()).toHaveTextContent('Pendente')
  expect(etapa()).toHaveTextContent('0 de 3 ambientes')

  // Ambiente sem pessoas, sem luz e sem equipamentos: só faltam setpoints e infiltração.
  const { editarUso } = useModelo.getState()
  for (const ambiente of ANALISE.bim.ambientes) {
    for (const [parametro, valor] of Object.entries({
      pessoas: 0,
      iluminacao_potencia: 0,
      equipamentos_potencia: 0,
      setpoint_aquecimento: 18,
      setpoint_resfriamento: 26,
      infiltracao: 1,
    })) {
      act(() => void editarUso(ambiente.global_id, parametro, valor))
    }
  }

  expect(etapa()).toHaveTextContent('Pronto')
  expect(etapa()).toHaveTextContent('3 de 3 ambientes')
  // A simulação do IFC continua indisponível: falta a conversão para epJSON.
  expect(screen.getByRole('button', { name: /Executar simulação/ })).toBeDisabled()
})

// ---- Tutorial ---------------------------------------------------------------------
test('tutorial: abre pela tela inicial, antes de qualquer modelo', async () => {
  render(<AreaDeTrabalho api={apiSistema} modoDemo={false} Visualizador={VisualizadorFalso} />)

  await userEvent.click(screen.getByRole('button', { name: /Como usar/ }))

  const tutorial = screen.getByRole('dialog', { name: 'Como usar o IFC Energy' })
  expect(within(tutorial).getAllByRole('tab').length).toBeGreaterThanOrEqual(8)
  expect(tutorial).toHaveTextContent('ainda não simula o seu IFC')
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('tutorial: o passo de uso e operação leva direto ao formulário', async () => {
  await abrir()
  await userEvent.click(screen.getByRole('button', { name: 'Tutorial' }))
  const tutorial = screen.getByRole('dialog', { name: 'Como usar o IFC Energy' })

  await userEvent.click(within(tutorial).getByRole('tab', { name: /Uso e operação/ }))
  expect(tutorial).toHaveTextContent('a plataforma não sugere valores')
  await userEvent.click(within(tutorial).getByRole('button', { name: /Ir para o formulário/ }))

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Uso e operação/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
})

test('estimativas: prévia não muda dados; aplicar mostra origem e pode ser desfeito', async () => {
  await abrir()
  const botao = screen.getByRole('button', { name: 'Estimar dados faltantes' })
  await userEvent.click(botao)
  const caixa = screen.getByRole('dialog', { name: 'Estimar dados faltantes' })
  expect(caixa).toHaveTextContent('referência: Cuiabá')
  expect(caixa).toHaveTextContent('Banheiro')
  expect(useModelo.getState().ajustes.operacao).toEqual({})
  await userEvent.click(within(caixa).getByRole('button', { name: 'Aplicar estimativas' }))
  expect(caixa).toHaveTextContent('Estimativas aplicadas')
  expect(useModelo.getState().ajustes.estimativas).toHaveLength(1)
  expect(within(caixa).getByRole('button', { name: 'Aplicar estimativas' })).toBeDisabled()
  await userEvent.click(within(caixa).getByRole('button', { name: 'Desfazer estimativas' }))
  expect(useModelo.getState().ajustes.operacao).toEqual({})
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(botao).toHaveFocus()
  expect(screen.getByRole('button', { name: /Executar simulação/ })).toBeDisabled()
})
