// Única porta de acesso aos dados. Tem duas implementações:
//  - clienteHttp: fala com o backend em /api/v1 (uso normal, em localhost);
//  - clienteDemo: lê arquivos de exemplo (modo demonstração do GitHub Pages).
// Os tipos vêm de tipos.gerado.ts, gerado a partir do OpenAPI do backend
// com "npm run gerar-tipos" — nunca escritos à mão.
import type { components } from './tipos.gerado'

export type Saude = components['schemas']['Saude']
export type Simulacao = components['schemas']['Simulacao']
export type ConsumoAnual = components['schemas']['ConsumoAnual']
export type ItemConsumo = components['schemas']['ItemConsumo']
export type EstadoSimulacao = Simulacao['estado']

export class ErroApi extends Error {}

export interface ClienteApi {
  obterSaude(): Promise<Saude>
  simularExemplo(): Promise<Simulacao>
  obterSimulacao(id: string): Promise<Simulacao>
  obterResultados(id: string): Promise<ConsumoAnual>
}

const SEM_BACKEND =
  'Não foi possível falar com o backend. Confira se a janela do iniciar.ps1 continua aberta e tente de novo.'

async function pedir<T>(caminho: string, metodo: 'GET' | 'POST' = 'GET'): Promise<T> {
  let resposta: Response
  try {
    resposta = await fetch(`/api/v1${caminho}`, { method: metodo })
  } catch {
    throw new ErroApi(SEM_BACKEND)
  }
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => null)
    const detalhe = typeof corpo?.detail === 'string' ? corpo.detail : null
    // 502/504 sem detalhe: o repasse do Vite não achou o backend.
    throw new ErroApi(
      detalhe ??
        (resposta.status >= 500
          ? SEM_BACKEND
          : `O backend respondeu com o erro ${resposta.status}.`),
    )
  }
  return (await resposta.json()) as T
}

export const clienteHttp: ClienteApi = {
  obterSaude: () => pedir('/saude'),
  simularExemplo: () => pedir('/simulacoes/exemplo', 'POST'),
  obterSimulacao: (id) => pedir(`/simulacoes/${encodeURIComponent(id)}`),
  obterResultados: (id) => pedir(`/simulacoes/${encodeURIComponent(id)}/resultados`),
}

const ETAPAS_DEMO: { estado: EstadoSimulacao; mensagem: string }[] = [
  { estado: 'validando', mensagem: 'Validando o arquivo de entrada.' },
  { estado: 'dias_de_projeto', mensagem: 'Simulando os dias de projeto.' },
  { estado: 'anual', mensagem: 'Simulando o ano inteiro.' },
]

/** Lê os dados gravados em exemplos/demo e reproduz os estados da simulação. */
export function criarClienteDemo(base: string): ClienteApi {
  let consultas = 0
  async function ler<T>(arquivo: string): Promise<T> {
    const resposta = await fetch(`${base}demo/${arquivo}`).catch(() => null)
    if (!resposta?.ok) {
      throw new ErroApi(
        `Não foi possível carregar os dados de demonstração (${arquivo}). Recarregue a página.`,
      )
    }
    return (await resposta.json()) as T
  }
  return {
    obterSaude: () => ler('saude.json'),
    async simularExemplo() {
      consultas = 0
      const final = await ler<Simulacao>('simulacao.json')
      return { ...final, estado: 'na_fila', mensagem: 'Aguardando na fila.' }
    },
    async obterSimulacao() {
      const final = await ler<Simulacao>('simulacao.json')
      const etapa = ETAPAS_DEMO[consultas++]
      return etapa ? { ...final, ...etapa } : final
    },
    obterResultados: () => ler('resultados.json'),
  }
}

export const modoDemo = import.meta.env.MODE === 'demo'
export const api: ClienteApi = modoDemo ? criarClienteDemo(import.meta.env.BASE_URL) : clienteHttp
