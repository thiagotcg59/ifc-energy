// Dados reais da residência de exemplo, lidos dos arquivos versionados em
// exemplos/demo (gerados pelo backend). Usados pelos testes do front-end.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  ajustesVazios,
  type Ajustes,
  type ApiModelos,
  type Biblioteca,
  type ModeloAnalise,
} from '../api/modelos'

const ler = (nome: string) =>
  JSON.parse(readFileSync(resolve(process.cwd(), '../exemplos/demo', nome), 'utf-8'))

export const ANALISE = ler('modelo.json') as ModeloAnalise
export const BIBLIOTECA = ler('biblioteca.json') as Biblioteca

export const elemento = (etiqueta: string) =>
  ANALISE.bim.elementos.find((e) => e.etiqueta === etiqueta)!

/** API falsa em memória; guarda o que foi salvo para os testes conferirem. */
export function apiFalsa(parcial: Partial<ApiModelos> = {}) {
  const salvos = new Map<string, Ajustes>()
  const api: ApiModelos = {
    somenteNavegador: false,
    abrirExemplo: async () => structuredClone(ANALISE),
    enviarIfc: async () => structuredClone(ANALISE),
    baixarIfc: async () => new ArrayBuffer(8),
    obterAjustes: async (id) => structuredClone(salvos.get(id) ?? ajustesVazios()),
    salvarAjustes: async (id, ajustes) => {
      salvos.set(id, structuredClone(ajustes))
      return ajustes
    },
    obterBiblioteca: async () => structuredClone(BIBLIOTECA),
    ...parcial,
  }
  return { api, salvos }
}
