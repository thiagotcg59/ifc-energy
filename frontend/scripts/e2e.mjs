// Teste de ponta a ponta em navegador de verdade (Edge), seguindo o roteiro
// de quem usa a plataforma: abrir a residência de exemplo, clicar em uma
// parede no 3D, ver camadas e desempenho, editar, salvar e reabrir.
//
// Uso:
//   node scripts/e2e.mjs                        -> http://localhost:5173 (com o iniciar.ps1 rodando)
//   node scripts/e2e.mjs <endereco> <prefixo>   -> outro endereço; capturas com outro prefixo
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { abrirNavegador } from './navegador.mjs'

const endereco = process.argv[2] ?? 'http://localhost:5173/'
const prefixo = process.argv[3] ?? 'local'
const pasta = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/capturas')
const captura = (nome) => resolve(pasta, `${prefixo}-${nome}.png`)

const n = await abrirNavegador()
let passo = 0
const etapa = (texto) => console.log(`${++passo}. ${texto}`)
function conferir(condicao, mensagem) {
  if (!condicao) throw new Error(`FALHOU: ${mensagem}`)
  console.log(`  ok: ${mensagem}`)
}
const texto = () => n.avaliar('document.body.innerText')
const inspetor = () => n.avaliar(`document.querySelector('.painel--direita')?.innerText ?? ''`)
const estado = (expressao) =>
  n.avaliar(`(() => { const e = window.__ifcEnergy.estado(); return ${expressao} })()`)
const idDe = (etiqueta) =>
  estado(
    `e.analise.bim.elementos.find((x) => x.etiqueta === ${JSON.stringify(etiqueta)}).global_id`,
  )

async function abrirExemplo() {
  await n.esperarTexto('Explorar residência de exemplo')
  await n.clicar('button', 'Explorar residência de exemplo')
  await n.esperarTexto('Enquadrar tudo', 90_000) // barra do visualizador = geometria pronta
  await n.dormir(600)
}

try {
  await n.tela(1500, 920)
  await n.ir(endereco)

  etapa('Tela inicial com a opção de explorar a residência de exemplo')
  await n.esperarTexto('Explorar residência de exemplo')
  await n.capturar(captura('01-inicio'))

  etapa('O IFC sintético é carregado e o modelo 3D aparece enquadrado')
  await abrirExemplo()
  const cores = await n.avaliar(`(() => {
    const origem = document.querySelector('.visualizador canvas')
    const copia = document.createElement('canvas')
    copia.width = 160; copia.height = 100
    const ctx = copia.getContext('2d')
    ctx.drawImage(origem, 0, 0, 160, 100)
    const dados = ctx.getImageData(0, 0, 160, 100).data
    const vistas = new Set()
    for (let i = 0; i < dados.length; i += 4) vistas.add((dados[i] >> 4) + ',' + (dados[i + 1] >> 4) + ',' + (dados[i + 2] >> 4))
    return vistas.size
  })()`)
  conferir(cores > 8, `o visualizador desenhou o modelo (${cores} tons diferentes na imagem)`)
  conferir(
    (await estado('e.analise.bim.elementos.length')) === 16,
    '16 elementos construtivos lidos do IFC',
  )
  await n.capturar(captura('02-modelo-3d'))

  etapa('A árvore BIM mostra ambientes e elementos')
  const arvore = await n.avaliar(`document.querySelector('.navegador').innerText`)
  for (const nome of [
    'Sala e cozinha',
    'Quarto',
    'Banheiro',
    'Parede externa sul',
    'Janela da sala (norte)',
    'Laje de cobertura',
  ]) {
    conferir(arvore.includes(nome), `árvore mostra “${nome}”`)
  }

  etapa('Clique em uma parede no modelo 3D seleciona exatamente essa parede')
  const parede = await idDe('PE-S')
  const ponto = await n.avaliar(`window.__ifcEnergy.cena.posicaoNaTela(${JSON.stringify(parede)})`)
  conferir(ponto !== null, 'a parede sul está visível na vista isométrica')
  await n.clicarEm(ponto.x, ponto.y)
  conferir((await estado('e.selecao?.id')) === parede, 'a seleção é a parede clicada')
  conferir((await inspetor()).includes('Parede externa sul'), 'o inspetor abriu a parede')
  conferir(
    await n.avaliar(
      `document.querySelector('.arvore__botao--ativo')?.innerText.includes('Parede externa sul')`,
    ),
    'a árvore destacou o mesmo elemento',
  )
  await n.capturar(captura('03-parede-selecionada'))

  etapa('O painel mostra materiais e camadas, com a origem de cada valor')
  await n.clicar('[role=tab]', 'Camadas')
  await n.clicar('.camada summary', 'Alvenaria de tijolo cerâmico')
  let painel = await inspetor()
  conferir(painel.includes('fora para dentro'), 'camadas na ordem de fora para dentro')
  conferir(painel.includes('0,89 W/(m·K)'), 'condutividade do tijolo: 0,89 W/(m·K)')
  conferir(painel.includes('Extraído do IFC'), 'valor marcado como extraído do IFC')
  conferir(painel.includes('Não informado'), 'absortância solar aparece como não informada')
  await n.capturar(captura('04-camadas'))

  etapa('Desempenho térmico calculado (U = 2,842 W/(m²·K) pela conta feita à mão)')
  await n.clicar('[role=tab]', 'Desempenho')
  painel = await inspetor()
  conferir(painel.includes('2,842'), 'transmitância térmica U = 2,842')
  conferir(painel.includes('0,1818'), 'resistência das camadas = 0,1818 m²·K/W')
  conferir(painel.includes('convenção de cálculo'), 'resistências superficiais explicadas à parte')
  conferir(painel.includes('Outdoors'), 'condição de contorno do EnergyPlus indicada')
  await n.capturar(captura('05-desempenho'))

  etapa('Editar um parâmetro recalcula as propriedades derivadas')
  await n.clicar('[role=tab]', 'Parâmetros')
  await n.preencher('Espessura (e)', '0,20') // camada 2 (tijolo): 10 cm -> 20 cm
  painel = await inspetor()
  // U = 1 / (0,13 + 0,025/0,72 + 0,20/0,89 + 0,025/0,72 + 0,04) = 2,154
  conferir(painel.includes('2,154'), 'U recalculado para 2,154 W/(m²·K)')
  await n.preencher('Espessura (e)', '9')
  conferir(
    (await inspetor()).includes('entre 0.001 e 2'),
    'valor fora do limite é recusado com explicação',
  )
  await n.preencher('Espessura (e)', '0,20')
  await n.capturar(captura('06-parametros-editados'))

  etapa('Salvar a configuração')
  await n.clicar('button', 'Salvar parâmetros')
  await n.esperar(`document.querySelector('.torrada')`, 'aviso de salvamento')
  const aviso = await n.avaliar(`document.querySelector('.torrada').innerText`)
  conferir(/navegador|computador/.test(aviso), `aviso de salvamento: “${aviso.trim()}”`)

  etapa('Selecionar uma janela pela árvore destaca no modelo e mostra o vidro')
  await n.clicar('.arvore__botao', 'Janela da sala (norte)')
  conferir(
    (await estado('e.selecao?.id')) === (await idDe('J1')),
    'seleção sincronizada com a árvore',
  )
  await n.clicar('[role=tab]', 'Vidro e caixilho')
  painel = await inspetor()
  conferir(painel.includes('0,837'), 'transmitância solar do vidro: 0,837')
  conferir(painel.includes('Caixilho'), 'vidro e caixilho aparecem separados')
  await n.clicar('[role=tab]', 'Desempenho')
  conferir(
    (await inspetor()).includes('O IFC informa as propriedades do vidro'),
    'diferença entre vidro e janela completa explicada',
  )
  await n.capturar(captura('07-janela'))

  etapa('Selecionar um ambiente mostra os limites térmicos')
  await n.clicar('.arvore__botao', 'Sala e cozinha')
  await n.clicar('[role=tab]', 'Superfícies')
  painel = await inspetor()
  conferir(painel.includes('IfcSpace'), 'inspetor do ambiente (IfcSpace)')
  conferir(painel.includes('Z1-S8'), 'as 8 superfícies da sala estão listadas')
  conferir((await texto()).includes('Exterior (ar)'), 'legenda das condições de contorno no 3D')
  await n.capturar(captura('08-ambiente-limites-termicos'))

  etapa('Diagnóstico e prontidão: nada de simulação prometida antes da hora')
  await n.clicar('button', 'Preparar simulação')
  const inferior = await n.avaliar(`document.querySelector('.painel-inferior').innerText`)
  conferir(inferior.includes('Todas as zonas estão fechadas'), 'checagem de zonas fechadas passou')
  conferir(
    inferior.includes('Ainda não implementado'),
    'conversão para epJSON marcada como não implementada',
  )
  conferir(
    await n.avaliar(
      `[...document.querySelectorAll('button')].find((b) => b.innerText.includes('Executar simulação')).disabled`,
    ),
    '“Executar simulação” desabilitado para este IFC',
  )
  await n.capturar(captura('09-modelo-termico'))

  etapa('Recarregar a página: a configuração salva continua lá')
  await n.recarregar()
  await abrirExemplo()
  await n.clicar('.arvore__botao', 'Parede externa sul')
  await n.clicar('[role=tab]', 'Desempenho')
  conferir((await inspetor()).includes('2,154'), 'U = 2,154 depois de recarregar (persistiu)')
  await n.clicar('[role=tab]', 'Origem')
  conferir(
    (await inspetor()).includes('Informado manualmente'),
    'a espessura editada aparece como manual',
  )
  await n.capturar(captura('10-origem-apos-recarregar'))

  etapa('Restaurar os valores do IFC e salvar (deixa tudo como estava)')
  await n.clicar('[role=tab]', 'Alterações')
  await n.clicar('button', 'Restaurar tudo ao IFC')
  await n.clicar('button', 'Salvar parâmetros')
  await n.clicar('[role=tab]', 'Desempenho')
  conferir((await inspetor()).includes('2,842'), 'U voltou a 2,842')

  etapa('A simulação do exemplo do EnergyPlus continua funcionando (fase 1 preservada)')
  await n.clicar('[role=tab]', 'Simulação')
  await n.esperarTexto('EnergyPlus 26.2.0 pronto.')
  await n.clicar('button', 'Simular exemplo')
  await n.esperarTexto('Consumo anual total', 180_000)
  conferir(
    (await n.avaliar(`document.querySelector('.painel-inferior').innerText`)).includes(
      '207.043 kWh',
    ),
    'consumo anual do exemplo: 207.043 kWh',
  )
  await n.capturar(captura('10b-simulacao-energyplus'))

  etapa('Tema claro')
  await n.clicar('button', 'Mudar para o tema claro')
  await n.dormir(400)
  await n.capturar(captura('11-tema-claro'))
  await n.clicar('button', 'Mudar para o tema escuro')

  etapa('Tela de celular: sem rolagem horizontal')
  await n.tela(390, 800)
  const rolagem = await n.avaliar(
    'document.documentElement.scrollWidth > document.documentElement.clientWidth + 1',
  )
  conferir(!rolagem, 'sem rolagem horizontal em 390 px')
  await n.capturar(captura('12-celular'))

  conferir(
    n.erros.length === 0,
    `nenhum erro no console do navegador${n.erros.length ? `: ${n.erros.join(' | ')}` : ''}`,
  )
  console.log(`\nTUDO CERTO: ${passo} etapas conferidas em ${endereco}`)
} catch (erro) {
  console.error(`\n${erro.message}`)
  if (n.erros.length) console.error(`Erros no console: ${n.erros.join(' | ')}`)
  await n.capturar(captura('falha')).catch(() => {})
  process.exitCode = 1
} finally {
  await n.fechar()
}
