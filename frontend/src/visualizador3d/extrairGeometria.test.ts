// @vitest-environment node
// O web-ifc é um leitor IFC independente do IfcOpenShell (que gerou o arquivo):
// se os dois concordam, o IFC de exemplo é um IFC de verdade.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { IfcAPI, IFCSPACE } from 'web-ifc'
import { beforeAll, expect, test } from 'vitest'
import { ANALISE } from '../testes/exemplo'
import { extrairGeometria, type ElementoGeometrico } from './extrairGeometria'

let elementos: ElementoGeometrico[]

beforeAll(async () => {
  const api = new IfcAPI()
  await api.Init()
  const modelo = api.OpenModel(
    new Uint8Array(readFileSync(resolve(process.cwd(), '../exemplos/ifc/residencia_exemplo.ifc'))),
  )
  elementos = extrairGeometria(api, modelo, IFCSPACE)
  api.CloseModel(modelo)
})

function caixa(e: ElementoGeometrico) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const parte of e.partes) {
    for (let i = 0; i < parte.posicoes.length; i++) {
      min[i % 3] = Math.min(min[i % 3]!, parte.posicoes[i]!)
      max[i % 3] = Math.max(max[i % 3]!, parte.posicoes[i]!)
    }
  }
  return { min, max, tamanho: max.map((v, i) => v - min[i]!) }
}

test('o web-ifc lê os 16 elementos e os 3 ambientes do IFC de exemplo', () => {
  const contagem: Record<string, number> = {}
  elementos.forEach((e) => (contagem[e.classe] = (contagem[e.classe] ?? 0) + 1))

  expect(contagem).toEqual({ IfcWall: 6, IfcSlab: 2, IfcWindow: 5, IfcDoor: 3, IfcSpace: 3 })
  expect(elementos.filter((e) => e.ambiente)).toHaveLength(3)
})

test('cada geometria corresponde, pelo GlobalId, a um elemento lido pelo backend', () => {
  const doBackend = new Set([
    ...ANALISE.bim.elementos.map((e) => e.global_id),
    ...ANALISE.bim.ambientes.map((a) => a.global_id),
  ])

  expect(new Set(elementos.map((e) => e.globalId))).toEqual(doBackend)
})

test('dimensões da geometria conferem com o projeto (10 m × 7 m, pé-direito 2,80 m)', () => {
  const sul = elementos.find((e) => e.nome === 'Parede externa sul')!
  const sala = elementos.find((e) => e.nome === 'Sala e cozinha')!

  // Eixos do web-ifc: x = leste, y = para cima, z = −norte.
  expect(caixa(sul).tamanho.map((v) => +v.toFixed(3))).toEqual([10, 2.8, 0.15])
  expect(caixa(sala).tamanho.map((v) => +v.toFixed(3))).toEqual([5.85, 2.8, 6.7])
})

test('a janela tem caixilho opaco e vidro transparente', () => {
  const janela = elementos.find((e) => e.nome === 'Janela da sala (norte)')!
  const opacidades = janela.partes.map((p) => +p.cor[3].toFixed(2))

  expect(opacidades).toEqual([1, 1, 1, 1, 0.4])
})

test('normais e índices coerentes com os vértices', () => {
  for (const e of elementos) {
    for (const parte of e.partes) {
      expect(parte.normais).toHaveLength(parte.posicoes.length)
      expect(Math.max(...parte.indices)).toBeLessThan(parte.posicoes.length / 3)
    }
  }
})
