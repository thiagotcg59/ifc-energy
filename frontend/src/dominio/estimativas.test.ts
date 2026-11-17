import { beforeEach, expect, test } from 'vitest'
import { ajustesVazios, type Ajustes, type ModeloBim } from '../api/modelos'
import { ANALISE } from '../testes/exemplo'
import {
  aplicarEstimativas,
  desfazerEstimativas,
  gerarPrevia,
  sugerirEscolhas,
} from './estimativas'

let bim: ModeloBim
let ajustes: Ajustes
const quarto = () => bim.ambientes.find((a) => a.nome === 'Quarto')!.global_id
const sala = () => bim.ambientes.find((a) => a.nome === 'Sala e cozinha')!.global_id
const lote = { id: 'ensaio-1', quando: '2026-11-16T20:00:00Z' }
const aplicar = () => aplicarEstimativas(bim, ajustes, sugerirEscolhas(bim), lote)

beforeEach(() => {
  bim = structuredClone(ANALISE.bim)
  ajustes = ajustesVazios()
})

test('perfil aprovado preenche quarto e sala com fonte e deixa banheiro pendente', () => {
  const antes = structuredClone(bim)
  const resultado = aplicar()
  expect(resultado.operacao[quarto()]!.pessoas).toMatchObject({ valor: 2, origem: 'estimado' })
  expect(resultado.operacao[quarto()]!.calor_por_pessoa?.valor).toBe(80)
  expect(resultado.operacao[quarto()]!.ocupacao_inicio?.valor).toBe(21)
  expect(resultado.operacao[quarto()]!.ocupacao_fim?.valor).toBe(8)
  expect(resultado.operacao[quarto()]!.equipamentos_potencia?.valor).toBe(0)
  expect(resultado.operacao[quarto()]!.equipamentos_inicio).toBeUndefined()
  expect(resultado.operacao[sala()]!.pessoas?.valor).toBe(2) // um dormitório neste IFC
  expect(resultado.operacao[sala()]!.calor_por_pessoa?.valor).toBe(110)
  expect(resultado.operacao[sala()]!.iluminacao_potencia?.valor).toBe(6)
  expect(resultado.operacao[sala()]!.equipamentos_potencia?.valor).toBe(1.5)
  expect(resultado.operacao[sala()]!.setpoint_aquecimento?.valor).toBe(20)
  expect(resultado.operacao[sala()]!.setpoint_resfriamento?.valor).toBe(26)
  expect(resultado.operacao[sala()]!.infiltracao?.valor).toBe(1)
  for (const valor of Object.values(resultado.operacao[sala()]!)) {
    expect(valor.fonte).toContain('https://')
    expect(valor.estimativa_id).toBe('ensaio-1')
  }
  const banheiro = bim.ambientes.find((a) => a.nome === 'Banheiro')!
  expect(resultado.operacao[banheiro.global_id]).toBeUndefined()
  expect(gerarPrevia(bim, ajustes, sugerirEscolhas(bim)).pendencias.join(' ')).toContain('Banheiro')
  expect(bim).toEqual(antes)
  expect(ajustes.operacao).toEqual({})
})

test('preserva dados e zeros; não preenche horários dispensados por potência zero', () => {
  ajustes.operacao[quarto()] = {
    pessoas: { valor: 3, origem: 'manual' },
    iluminacao_potencia: { valor: 0, origem: 'manual' },
    infiltracao: { valor: 0, origem: 'ifc' },
  }
  const resultado = aplicar()
  expect(resultado.operacao[quarto()]!.pessoas).toEqual({ valor: 3, origem: 'manual' })
  expect(resultado.operacao[quarto()]!.iluminacao_inicio).toBeUndefined()
  expect(resultado.operacao[quarto()]!.infiltracao).toEqual({ valor: 0, origem: 'ifc' })
  expect(resultado.operacao[sala()]!.pessoas?.valor).toBe(3)
})

test('conflitos com setpoint ou horário existente ficam pendentes', () => {
  ajustes.operacao[quarto()] = {
    setpoint_aquecimento: { valor: 28, origem: 'manual' },
    ocupacao_inicio: { valor: 8, origem: 'manual' },
  }
  const resultado = aplicar()
  expect(resultado.operacao[quarto()]!.setpoint_resfriamento).toBeUndefined()
  expect(resultado.operacao[quarto()]!.ocupacao_fim).toBeUndefined()
  const pendencias = gerarPrevia(bim, ajustes, sugerirEscolhas(bim)).pendencias.join(' ')
  expect(pendencias).toContain('resfriamento precisa ser maior')
  expect(pendencias).toContain('início e o fim')
})

test('materiais: preenche só lacunas e exige associação compatível, sem inventar SHGC', () => {
  bim.materiais = [
    {
      id: 'concreto',
      nome: 'Concreto',
      propriedades: { densidade: { valor: 2300, origem: 'ifc' } },
    },
    { id: 'bloco', nome: 'Bloco cerâmico furado', propriedades: {} },
    { id: 'aluminio', nome: 'Alumínio', propriedades: {} },
    { id: 'vidro', nome: 'Vidro incolor 3 mm', propriedades: {} },
  ]
  const escolhas = sugerirEscolhas(bim)
  expect(escolhas.materiais.bloco).toBe('')
  expect(escolhas.materiais.aluminio).toBe('')
  const resultado = aplicarEstimativas(bim, ajustes, escolhas, lote)
  expect(resultado.materiais.concreto!.condutividade?.valor).toBe(1.95)
  expect(resultado.materiais.concreto!.densidade).toBeUndefined()
  expect(resultado.materiais.bloco).toBeUndefined()
  expect(resultado.materiais.vidro!.transmitancia_solar?.valor).toBe(0.837)
  expect(resultado.materiais.vidro!.fator_solar).toBeUndefined()
  expect(resultado.aberturas).toEqual({})
  expect(resultado.camadas).toEqual({})
})

test('reaplicar não altera valores nem duplica o histórico', () => {
  const primeiro = aplicar()
  const segundo = aplicarEstimativas(bim, primeiro, sugerirEscolhas(bim), {
    ...lote,
    id: 'ensaio-2',
  })
  expect(segundo).toEqual(primeiro)
})

test('desfazer depois de salvar restaura lacunas e preserva edição manual posterior', () => {
  ajustes.operacao[quarto()] = {
    infiltracao: { valor: null, origem: 'ausente', unidade: 'trocas/h' },
  }
  const resultado = JSON.parse(JSON.stringify(aplicar())) as Ajustes
  resultado.operacao[quarto()]!.pessoas = { valor: 5, origem: 'manual' }
  const desfeito = desfazerEstimativas(resultado, lote.id)
  expect(desfeito.operacao[quarto()]!.pessoas).toEqual({ valor: 5, origem: 'manual' })
  expect(desfeito.operacao[quarto()]!.infiltracao).toEqual(ajustes.operacao[quarto()]!.infiltracao)
  expect(desfeito.operacao[sala()]).toBeUndefined()
  expect(desfeito.estimativas).toEqual([])
  expect(desfazerEstimativas(desfeito, lote.id)).toEqual(desfeito)
})

test('sem IfcSpace nenhuma estimativa é aplicada, nem em materiais', () => {
  bim.ambientes = []
  expect(gerarPrevia(bim, ajustes, sugerirEscolhas(bim)).bloqueado).toBe(true)
  expect(aplicar()).toEqual(ajustes)
})

test('nomes ambíguos e múltiplas salas não geram ocupação duplicada', () => {
  const modelo = structuredClone(bim.ambientes[0]!)
  bim.ambientes.push({ ...modelo, global_id: 'sala-2', nome: 'Sala de estar' })
  const resultado = aplicar()
  expect(resultado.operacao[sala()]?.pessoas).toBeUndefined()
  expect(resultado.operacao['sala-2']?.pessoas).toBeUndefined()
  bim.ambientes = [{ ...modelo, global_id: 'misto', nome: 'Quarto / cozinha' }]
  expect(sugerirEscolhas(bim).ambientes.misto).toBe('')
})

test('a soma da sala não usa ocupação de dormitório recusada por conflito', () => {
  ajustes.operacao[quarto()] = { ocupacao_inicio: { valor: 8, origem: 'manual' } }
  const resultado = aplicar()
  expect(resultado.operacao[quarto()]?.pessoas).toBeUndefined()
  expect(resultado.operacao[sala()]?.pessoas).toBeUndefined()
})

test('vidro: não mistura referência de 3 mm com camada de espessura conhecida diferente', () => {
  bim.materiais = [{ id: 'vidro', nome: 'Vidro incolor 3 mm', propriedades: {} }]
  bim.construcoes = [
    {
      id: 'vidro6',
      nome: 'Vidro',
      tipo: 'camadas',
      camadas: [{ material_id: 'vidro', espessura: { valor: 0.006, unidade: 'm', origem: 'ifc' } }],
      constituintes: [],
      elementos_ids: [],
    },
  ]
  expect(aplicar().materiais.vidro).toBeUndefined()
})

test('vidro: combinação de transmitância e refletância não pode superar um', () => {
  bim.materiais = [
    {
      id: 'vidro',
      nome: 'Vidro incolor 3 mm',
      propriedades: {
        refletancia_solar: { valor: 0.4, origem: 'manual' },
      },
    },
  ]
  const resultado = aplicar()
  expect(resultado.materiais.vidro?.transmitancia_solar).toBeUndefined()
  expect(gerarPrevia(bim, ajustes, sugerirEscolhas(bim)).pendencias.join(' ')).toContain('soma')
})
