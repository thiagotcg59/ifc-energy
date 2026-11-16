// Acesso aos modelos IFC: análise, arquivo, ajustes e biblioteca.
// Como em cliente.ts, há uma implementação real (backend local) e uma de
// demonstração (arquivos versionados + armazenamento do navegador).
import { ErroApi } from './cliente'
import type { components } from './tipos.gerado'

type S = components['schemas']
export type ModeloAnalise = S['ModeloAnalise']
export type ModeloBim = S['ModeloBim']
export type ModeloTermico = S['ModeloTermico']
export type Elemento = S['Elemento']
export type Ambiente = S['Ambiente']
export type Fronteira = S['Fronteira']
export type Construcao = S['Construcao']
export type Material = S['Material']
export type Valor = S['Valor']
export type Diagnostico = S['Diagnostico']
export type Superficie = S['Superficie']
export type Origem = NonNullable<Valor['origem']>
export type Ajustes = Required<S['Ajustes']>

export interface MaterialDaBiblioteca {
  id: string
  nome: string
  descricao: string
  categoria: string
  nome_na_fonte: string | null
  fonte: string | null
  aprovado: boolean
  condutividade?: number
  densidade?: number
  calor_especifico?: number
  espessura?: number
  transmitancia_solar?: number
  refletancia_solar?: number
  transmitancia_visivel?: number
  refletancia_visivel?: number
  emissividade?: number
}
export interface ConvencaoSuperficial {
  nome: string
  rsi: number | null
  rse: number | null
  unidade: string
  fonte: string
  aprovado: boolean
}
export interface Biblioteca {
  aviso: string
  fontes: Record<string, string>
  materiais: MaterialDaBiblioteca[]
  resistencias_superficiais: Record<string, ConvencaoSuperficial>
}

export const ajustesVazios = (): Ajustes => ({
  versao: 1,
  materiais: {},
  materiais_novos: [],
  camadas: {},
  aberturas: {},
  resistencias_superficiais: {},
  historico: [],
})
const completar = (a: Partial<Ajustes> | null | undefined): Ajustes => ({
  ...ajustesVazios(),
  ...(a ?? {}),
})

export interface ApiModelos {
  /** true quando os ajustes são guardados só neste navegador. */
  readonly somenteNavegador: boolean
  abrirExemplo(): Promise<ModeloAnalise>
  enviarIfc(arquivo: File): Promise<ModeloAnalise>
  baixarIfc(id: string): Promise<ArrayBuffer>
  obterAjustes(id: string): Promise<Ajustes>
  salvarAjustes(id: string, ajustes: Ajustes): Promise<Ajustes>
  obterBiblioteca(): Promise<Biblioteca>
}

const SEM_BACKEND =
  'Não foi possível falar com o backend. Confira se a janela do iniciar.ps1 continua aberta e tente de novo.'

async function pedir(caminho: string, opcoes?: RequestInit): Promise<Response> {
  let resposta: Response
  try {
    resposta = await fetch(`/api/v1${caminho}`, opcoes)
  } catch {
    throw new ErroApi(SEM_BACKEND)
  }
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => null)
    throw new ErroApi(
      typeof corpo?.detail === 'string'
        ? corpo.detail
        : resposta.status >= 500
          ? SEM_BACKEND
          : `O backend respondeu com o erro ${resposta.status}.`,
    )
  }
  return resposta
}
const json = async <T>(caminho: string, opcoes?: RequestInit) =>
  (await (await pedir(caminho, opcoes)).json()) as T

export const modelosHttp: ApiModelos = {
  somenteNavegador: false,
  abrirExemplo: () => json('/modelos/exemplo', { method: 'POST' }),
  enviarIfc(arquivo) {
    const corpo = new FormData()
    corpo.append('arquivo', arquivo)
    return json('/modelos', { method: 'POST', body: corpo })
  },
  baixarIfc: async (id) => (await pedir(`/modelos/${id}/ifc`)).arrayBuffer(),
  obterAjustes: async (id) => completar(await json(`/modelos/${id}/ajustes`)),
  salvarAjustes: async (id, ajustes) =>
    completar(
      await json(`/modelos/${id}/ajustes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ajustes),
      }),
    ),
  obterBiblioteca: () => json('/biblioteca'),
}

/** Demonstração: lê exemplos versionados; os ajustes ficam no navegador. */
export function criarModelosDemo(base: string, armazenamento: Storage | null): ApiModelos {
  const chave = (id: string) => `ifc-energy:ajustes:${id}`
  async function ler(arquivo: string): Promise<Response> {
    const resposta = await fetch(`${base}demo/${arquivo}`).catch(() => null)
    if (!resposta?.ok) {
      throw new ErroApi(
        `Não foi possível carregar os dados de demonstração (${arquivo}). Recarregue a página.`,
      )
    }
    return resposta
  }
  return {
    somenteNavegador: true,
    abrirExemplo: async () => (await (await ler('modelo.json')).json()) as ModeloAnalise,
    enviarIfc: () =>
      Promise.reject(
        new ErroApi(
          'Na demonstração só a residência de exemplo pode ser analisada. Para abrir o seu IFC, rode a plataforma no seu computador com o iniciar.ps1 — o arquivo nunca sai da sua máquina.',
        ),
      ),
    baixarIfc: async () => (await ler('residencia_exemplo.ifc')).arrayBuffer(),
    async obterAjustes(id) {
      try {
        return completar(JSON.parse(armazenamento?.getItem(chave(id)) ?? 'null'))
      } catch {
        return ajustesVazios()
      }
    },
    async salvarAjustes(id, ajustes) {
      try {
        armazenamento?.setItem(chave(id), JSON.stringify(ajustes))
      } catch {
        throw new ErroApi(
          'O navegador não permitiu guardar os parâmetros. Use “Exportar” para salvar em arquivo.',
        )
      }
      return ajustes
    },
    obterBiblioteca: async () => (await (await ler('biblioteca.json')).json()) as Biblioteca,
  }
}

function armazenamentoLocal(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export const apiModelos: ApiModelos =
  import.meta.env.MODE === 'demo'
    ? criarModelosDemo(import.meta.env.BASE_URL, armazenamentoLocal())
    : modelosHttp
