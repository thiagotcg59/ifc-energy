import { beforeEach, expect, test } from 'vitest'
import { ErroApi } from '../api/cliente'
import { desempenhoDaConstrucao, materialEfetivo } from '../dominio/modeloEfetivo'
import { ANALISE, apiFalsa, BIBLIOTECA, elemento } from '../testes/exemplo'
import { definirApi, temAlteracoes, useModelo } from './useModelo'
import { sugerirEscolhas } from '../dominio/estimativas'

const TIJOLO = 'alvenaria-de-tijolo-ceramico'
const PAREDE_EXTERNA = elemento('PE-S').construcao_id!
const loja = () => useModelo.getState()
let falsa: ReturnType<typeof apiFalsa>

function desempenhoDaParede() {
  const { analise, ajustes, biblioteca } = loja()
  const construcao = analise!.bim.construcoes.find((c) => c.id === PAREDE_EXTERNA)!
  return desempenhoDaConstrucao(analise!.bim, ajustes, biblioteca, construcao, elemento('PE-S'))
}

beforeEach(async () => {
  falsa = apiFalsa()
  definirApi(falsa.api)
  loja().fechar()
  await loja().abrirExemplo()
})

test('abrir o exemplo carrega análise, biblioteca e ajustes vazios', () => {
  expect(loja().fase).toBe('pronto')
  expect(loja().analise?.bim.ambientes).toHaveLength(3)
  expect(loja().biblioteca?.materiais.length).toBeGreaterThan(0)
  expect(temAlteracoes(loja())).toBe(false)
})

test('erro ao abrir mostra a mensagem que diz o que fazer', async () => {
  definirApi(
    apiFalsa({ abrirExemplo: () => Promise.reject(new ErroApi('Confira o iniciar.ps1')) }).api,
  )

  await loja().abrirExemplo()

  expect(loja().fase).toBe('erro')
  expect(loja().erro).toBe('Confira o iniciar.ps1')
})

test('desempenho da parede externa confere com a conta feita à mão', () => {
  const d = desempenhoDaParede()

  // R = 0,025/0,72 + 0,10/0,89 + 0,025/0,72 ; U = 1/(0,13 + R + 0,04)
  expect(d.resistencia_camadas).toBeCloseTo(0.181804, 6)
  expect(d.transmitancia).toBeCloseTo(2.842492, 5)
  expect(d.capacidade_termica).toBeCloseTo(229632, 6)
  expect(d.espessura_total).toBeCloseTo(0.15, 9)
  expect(d.origemDaConvencao).toBe('biblioteca')
  expect(d.alterada).toBe(false)
})

test('parede interna usa a resistência superficial interna dos dois lados', () => {
  const { analise, ajustes, biblioteca } = loja()
  const interna = elemento('PI-1')
  const construcao = analise!.bim.construcoes.find((c) => c.id === interna.construcao_id)!

  const d = desempenhoDaConstrucao(analise!.bim, ajustes, biblioteca, construcao, interna)

  expect([d.rsi, d.rse]).toEqual([0.13, 0.13])
})

test('piso sobre o solo: mostra a resistência das camadas, mas não inventa U', () => {
  const { analise, ajustes, biblioteca } = loja()
  const piso = elemento('PISO')
  const construcao = analise!.bim.construcoes.find((c) => c.id === piso.construcao_id)!

  const d = desempenhoDaConstrucao(analise!.bim, ajustes, biblioteca, construcao, piso)

  expect(d.resistencia_camadas).toBeCloseTo(0.1 / 1.95 + 0.01 / 1.59, 9)
  expect(d.transmitancia).toBeNull()
  expect(d.pendencias.join(' ')).toContain('modelo de solo')
})

test('editar a condutividade recalcula R e U e marca a origem como manual', () => {
  const antes = desempenhoDaParede()

  expect(loja().editarMaterial(TIJOLO, 'condutividade', 0.5)).toBeNull()

  const depois = desempenhoDaParede()
  expect(depois.resistencia_camadas).toBeCloseTo(0.025 / 0.72 + 0.1 / 0.5 + 0.025 / 0.72, 9)
  expect(depois.transmitancia!).toBeLessThan(antes.transmitancia!)
  const material = materialEfetivo(loja().analise!.bim, loja().ajustes, TIJOLO)!
  expect(material.propriedades.condutividade).toMatchObject({ valor: 0.5, origem: 'manual' })
  // O que veio do IFC continua intacto.
  expect(
    loja().analise!.bim.materiais.find((m) => m.id === TIJOLO)!.propriedades.condutividade,
  ).toMatchObject({ valor: 0.89, origem: 'ifc' })
  expect(loja().ajustes.historico.at(-1)).toMatchObject({ de: 0.89, para: 0.5 })
  expect(temAlteracoes(loja())).toBe(true)
})

test('valores fora dos limites físicos são recusados com explicação', () => {
  expect(loja().editarMaterial(TIJOLO, 'condutividade', -1)).toContain('entre')
  expect(loja().editarMaterial(TIJOLO, 'absortancia_solar', 1.5)).toContain('entre 0 e 1')
  expect(loja().editarEspessura(PAREDE_EXTERNA, 1, 5)).toContain('entre')
  expect(loja().ajustes.historico).toHaveLength(0)
})

test('aumentar a espessura de uma camada aumenta a resistência', () => {
  const antes = desempenhoDaParede()

  expect(loja().editarEspessura(PAREDE_EXTERNA, 1, 0.2)).toBeNull()

  const depois = desempenhoDaParede()
  expect(depois.resistencia_camadas).toBeCloseTo(antes.resistencia_camadas! + 0.1 / 0.89, 9)
  expect(depois.espessura_total).toBeCloseTo(0.25, 9)
  expect(depois.camadas[1]!.espessura).toMatchObject({ valor: 0.2, origem: 'manual' })
})

test('acrescentar isolante da biblioteca: nova camada com origem e fonte', () => {
  const antes = desempenhoDaParede()

  expect(loja().adicionarCamada(PAREDE_EXTERNA, 1, 'isolante', 0.05)).toBeNull()

  const depois = desempenhoDaParede()
  expect(depois.camadas.map((c) => c.nome)).toEqual([
    'Argamassa de reboco',
    'Placa isolante',
    'Alvenaria de tijolo cerâmico',
    'Argamassa de reboco',
  ])
  expect(depois.resistencia_camadas).toBeCloseTo(antes.resistencia_camadas! + 0.05 / 0.03, 9)
  const isolante = depois.camadas[1]!.material!
  expect(isolante.propriedades.condutividade).toMatchObject({ valor: 0.03, origem: 'biblioteca' })
  expect(isolante.propriedades.condutividade!.fonte).toContain('pendente de aprovação')
})

test('remover camada funciona, mas a última não pode ser removida', () => {
  expect(loja().removerCamada(PAREDE_EXTERNA, 0)).toBeNull()
  expect(loja().removerCamada(PAREDE_EXTERNA, 0)).toBeNull()
  expect(loja().removerCamada(PAREDE_EXTERNA, 0)).toContain('pelo menos uma camada')
  expect(desempenhoDaParede().camadas).toHaveLength(1)
})

test('material sem dados na biblioteca não vira camada', () => {
  expect(loja().adicionarCamada(PAREDE_EXTERNA, 0, 'aluminio', 0.01)).toContain('condutividade')
})

test('parâmetros da janela informados à mão ficam marcados como manuais', () => {
  const janela = elemento('J1').construcao_id!

  expect(loja().editarAbertura(janela, 'fator_solar', 1.2)).toContain('entre 0 e 1')
  expect(loja().editarAbertura(janela, 'fator_solar', 0.87)).toBeNull()

  expect(loja().ajustes.aberturas[janela]!.fator_solar).toMatchObject({
    valor: 0.87,
    origem: 'manual',
  })
})

test('resistências superficiais são uma convenção editável', () => {
  expect(loja().editarResistencia('parede', 'rse', 0.08)).toBeNull()

  const d = desempenhoDaParede()
  expect([d.rsi, d.rse, d.origemDaConvencao]).toEqual([0.13, 0.08, 'manual'])
  expect(d.transmitancia).toBeCloseTo(1 / (0.13 + d.resistencia_camadas! + 0.08), 9)
})

test('restaurar devolve os valores do IFC', () => {
  loja().editarMaterial(TIJOLO, 'condutividade', 0.5)
  loja().editarEspessura(PAREDE_EXTERNA, 1, 0.2)

  loja().restaurar({ material: TIJOLO })
  expect(desempenhoDaParede().camadas[1]!.material!.propriedades.condutividade!.valor).toBe(0.89)
  expect(desempenhoDaParede().espessura_total).toBeCloseTo(0.25, 9)

  loja().restaurar()
  expect(desempenhoDaParede().transmitancia).toBeCloseTo(2.842492, 5)
})

test('salvar persiste e reabrir o modelo traz os ajustes de volta', async () => {
  loja().editarMaterial(TIJOLO, 'condutividade', 0.5)

  await loja().salvar()

  expect(temAlteracoes(loja())).toBe(false)
  expect(falsa.salvos.get(ANALISE.id)!.materiais[TIJOLO]!.condutividade!.valor).toBe(0.5)
  loja().fechar()
  await loja().abrirExemplo()
  expect(desempenhoDaParede().camadas[1]!.material!.propriedades.condutividade!.valor).toBe(0.5)
})

test('falha ao salvar avisa e mantém as alterações', async () => {
  definirApi(apiFalsa({ salvarAjustes: () => Promise.reject(new ErroApi('Sem backend')) }).api)
  loja().editarMaterial(TIJOLO, 'condutividade', 0.5)

  await loja().salvar()

  expect(loja().aviso).toEqual({ tipo: 'erro', texto: 'Sem backend' })
  expect(temAlteracoes(loja())).toBe(true)
})

test('seleção, ocultar, isolar e mostrar tudo', () => {
  const id = elemento('PE-S').global_id
  loja().selecionar({ tipo: 'elemento', id })
  expect(loja().selecao).toEqual({ tipo: 'elemento', id })

  loja().alternarOculto(id)
  expect(loja().ocultos[id]).toBe(true)
  expect(loja().selecao).toBeNull() // elemento oculto deixa de estar selecionado

  loja().isolar([id])
  loja().alternarCategoria('janela')
  loja().mostrarTudo()
  expect([loja().ocultos, loja().isolados, loja().categoriasOcultas]).toEqual([{}, null, {}])
})

test('a biblioteca do exemplo está marcada como pendente de aprovação', () => {
  expect(BIBLIOTECA.materiais.every((m) => m.aprovado === false)).toBe(true)
})

test('estimativas: salvar, reabrir e desfazer mantém edição manual posterior', async () => {
  const quarto = ANALISE.bim.ambientes.find((a) => a.nome === 'Quarto')!.global_id
  loja().estimar(sugerirEscolhas(ANALISE.bim))
  expect(loja().ajustes.operacao[quarto]!.pessoas?.origem).toBe('estimado')
  await loja().salvar()
  loja().fechar()
  await loja().abrirExemplo()
  expect(loja().ajustes.operacao[quarto]!.pessoas?.origem).toBe('estimado')
  const id = loja().ajustes.estimativas[0]!.id
  loja().editarUso(quarto, 'pessoas', 3)
  loja().desfazerEstimativa(id)
  expect(loja().ajustes.operacao[quarto]!.pessoas).toMatchObject({ valor: 3, origem: 'manual' })
  expect(loja().ajustes.operacao[quarto]!.calor_por_pessoa).toBeUndefined()
})
