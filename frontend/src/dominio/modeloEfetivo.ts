// "Modelo efetivo" = o que veio do IFC + os ajustes do usuário.
// O IFC nunca é alterado: os ajustes ficam em uma estrutura separada e cada
// valor guarda a sua origem (ifc, calculado, manual, biblioteca, ausente).
import type {
  Ajustes,
  Biblioteca,
  Construcao,
  Elemento,
  Material,
  ModeloBim,
  Valor,
} from '../api/modelos'
import { calcularDesempenho, type DesempenhoTermico } from './termica'

export const AUSENTE: Valor = { valor: null, origem: 'ausente' }

/** Propriedades de material que o usuário pode editar, com rótulo e limites físicos. */
export const PROPRIEDADES: Record<
  string,
  { rotulo: string; unidade: string | null; min: number; max: number; simbolo?: string }
> = {
  condutividade: {
    rotulo: 'Condutividade térmica',
    unidade: 'W/(m·K)',
    min: 0.005,
    max: 500,
    simbolo: 'λ',
  },
  densidade: { rotulo: 'Densidade', unidade: 'kg/m³', min: 1, max: 25000, simbolo: 'ρ' },
  calor_especifico: {
    rotulo: 'Calor específico',
    unidade: 'J/(kg·K)',
    min: 50,
    max: 10000,
    simbolo: 'c',
  },
  absortancia_solar: { rotulo: 'Absortância solar', unidade: null, min: 0, max: 1, simbolo: 'α' },
  emissividade: { rotulo: 'Emissividade térmica', unidade: null, min: 0, max: 1, simbolo: 'ε' },
  transmitancia_solar: { rotulo: 'Transmitância solar', unidade: null, min: 0, max: 1 },
  refletancia_solar: { rotulo: 'Refletância solar', unidade: null, min: 0, max: 1 },
  transmitancia_visivel: { rotulo: 'Transmitância luminosa', unidade: null, min: 0, max: 1 },
  refletancia_visivel: { rotulo: 'Refletância luminosa', unidade: null, min: 0, max: 1 },
}
export const LIMITE_ESPESSURA = { min: 0.001, max: 2 }
export const LIMITE_RESISTENCIA = { min: 0, max: 2 }

/** Devolve a mensagem de erro, ou null se o valor é aceitável. */
export function validar(
  valor: number,
  limite: { min: number; max: number },
  rotulo: string,
): string | null {
  if (!Number.isFinite(valor)) return `${rotulo}: informe um número.`
  if (valor < limite.min || valor > limite.max) {
    return `${rotulo}: o valor precisa ficar entre ${limite.min} e ${limite.max}.`
  }
  return null
}

export function materialEfetivo(bim: ModeloBim, ajustes: Ajustes, id: string): Material | null {
  const base =
    bim.materiais.find((m) => m.id === id) ?? ajustes.materiais_novos.find((m) => m.id === id)
  if (!base) return null
  return { ...base, propriedades: { ...base.propriedades, ...(ajustes.materiais[id] ?? {}) } }
}

export interface CamadaEfetiva {
  material: Material | null
  nome: string
  espessura: Valor
  resistencia: number | null
}

export interface DesempenhoDaConstrucao extends DesempenhoTermico {
  camadas: CamadaEfetiva[]
  rsi: number | null
  rse: number | null
  convencao: string | null
  origemDaConvencao: 'biblioteca' | 'manual' | null
  fonteDaConvencao: string | null
  espessura_total: number | null
  alterada: boolean
}

export function camadasDe(_bim: ModeloBim, ajustes: Ajustes, construcao: Construcao) {
  return ajustes.camadas[construcao.id] ?? construcao.camadas ?? []
}

/** Qual convenção de resistências superficiais vale para um elemento. */
export function convencaoDe(elemento: Elemento | null): 'parede' | 'cobertura' | 'piso' | null {
  if (!elemento) return null
  if (elemento.categoria === 'cobertura') return 'cobertura'
  if (elemento.categoria === 'piso') return 'piso'
  if (elemento.categoria === 'parede' || elemento.categoria === 'porta') return 'parede'
  return null
}

export function desempenhoDaConstrucao(
  bim: ModeloBim,
  ajustes: Ajustes,
  biblioteca: Biblioteca | null,
  construcao: Construcao,
  elemento: Elemento | null,
): DesempenhoDaConstrucao {
  const camadas = camadasDe(bim, ajustes, construcao).map((c) => {
    const material = c.material_id ? materialEfetivo(bim, ajustes, c.material_id) : null
    return { material, nome: c.nome ?? material?.nome ?? '(sem material)', espessura: c.espessura }
  })
  const numero = (v: Valor | undefined) => (typeof v?.valor === 'number' ? v.valor : null)

  const tipo = convencaoDe(elemento)
  const manual = tipo ? ajustes.resistencias_superficiais[tipo] : undefined
  const padrao = tipo ? biblioteca?.resistencias_superficiais[tipo] : undefined
  let rsi = manual?.rsi ?? padrao?.rsi ?? null
  let rse = manual?.rse ?? padrao?.rse ?? null
  // Elemento entre dois ambientes internos: ar interno dos dois lados.
  if (elemento?.condicao === 'interior' && rsi !== null) rse = rsi
  if (elemento?.condicao === 'solo') rsi = rse = null

  const calculo = calcularDesempenho(
    camadas.map((c) => ({
      espessura: numero(c.espessura),
      condutividade: numero(c.material?.propriedades.condutividade),
      densidade: numero(c.material?.propriedades.densidade),
      calor_especifico: numero(c.material?.propriedades.calor_especifico),
    })),
    rsi,
    rse,
  )
  if (elemento?.condicao === 'solo') {
    calculo.pendencias = calculo.pendencias.filter((p) => !p.includes('R_si'))
    calculo.pendencias.push(
      'Piso em contato com o solo: a transmitância depende de um modelo de solo, ainda não implementado. É mostrada só a resistência das camadas.',
    )
  }
  const espessuras = camadas.map((c) => numero(c.espessura))
  return {
    ...calculo,
    camadas: camadas.map((c, i) => ({ ...c, resistencia: calculo.resistencias[i] ?? null })),
    rsi,
    rse,
    convencao: padrao?.nome ?? null,
    origemDaConvencao: manual ? 'manual' : padrao ? 'biblioteca' : null,
    fonteDaConvencao: manual ? 'Informado manualmente' : (padrao?.fonte ?? null),
    espessura_total: espessuras.every((e) => e !== null)
      ? espessuras.reduce<number>((s, e) => s + (e ?? 0), 0)
      : null,
    alterada:
      construcao.id in ajustes.camadas ||
      camadas.some((c) => c.material && c.material.id in ajustes.materiais),
  }
}

/** Conta os valores de um elemento por origem (para a aba "Origem"). */
export function listarValores(
  bim: ModeloBim,
  ajustes: Ajustes,
  elemento: Elemento,
): { grupo: string; nome: string; valor: Valor }[] {
  const saida: { grupo: string; nome: string; valor: Valor }[] = []
  for (const [nome, valor] of Object.entries(elemento.dimensoes ?? {})) {
    saida.push({ grupo: 'Geometria', nome: ROTULOS_DIMENSAO[nome] ?? nome, valor })
  }
  saida.push({ grupo: 'Identificação', nome: 'Elemento externo', valor: elemento.externo })
  for (const [nome, valor] of Object.entries(elemento.envidracamento ?? {})) {
    saida.push({
      grupo: 'Envidraçamento',
      nome: ROTULOS_VIDRO[nome] ?? nome,
      valor: ajustes.aberturas[elemento.construcao_id ?? '']?.[nome] ?? valor,
    })
  }
  const construcao = bim.construcoes.find((c) => c.id === elemento.construcao_id)
  if (construcao) {
    const materiais = new Set<string>()
    camadasDe(bim, ajustes, construcao).forEach((c, i) => {
      saida.push({ grupo: 'Camadas', nome: `Camada ${i + 1}: espessura`, valor: c.espessura })
      if (c.material_id) materiais.add(c.material_id)
    })
    for (const c of construcao.constituintes ?? []) if (c.material_id) materiais.add(c.material_id)
    for (const id of materiais) {
      const material = materialEfetivo(bim, ajustes, id)
      if (!material) continue
      const opaco = material.propriedades.transmitancia_solar?.valor == null
      for (const [chave, valor] of Object.entries(material.propriedades)) {
        const soVidro = chave.startsWith('transmitancia_') || chave.startsWith('refletancia_')
        if (opaco && soVidro) continue
        saida.push({
          grupo: `Material: ${material.nome}`,
          nome: PROPRIEDADES[chave]?.rotulo ?? chave,
          valor,
        })
      }
    }
  }
  return saida
}

export const ROTULOS_DIMENSAO: Record<string, string> = {
  comprimento: 'Comprimento',
  largura: 'Largura',
  altura: 'Altura',
  espessura: 'Espessura',
  area_bruta: 'Área bruta',
  area_liquida: 'Área líquida',
  area_de_piso: 'Área de piso',
  volume: 'Volume',
}
export const ROTULOS_VIDRO: Record<string, string> = {
  camadas_de_vidro: 'Número de camadas de vidro',
  espessura_vidro_1: 'Espessura do vidro',
  transmitancia_solar: 'Transmitância solar do vidro',
  refletancia_solar: 'Refletância solar do vidro',
  transmitancia_visivel: 'Transmitância luminosa do vidro',
  refletancia_visivel: 'Refletância luminosa do vidro',
  fator_solar: 'Fator solar (SHGC) da janela',
  transmitancia_termica_verao: 'Transmitância térmica da janela (verão)',
  transmitancia_termica_inverno: 'Transmitância térmica da janela (inverno)',
}
export const ROTULOS_ORIGEM: Record<string, string> = {
  estimado: 'Estimado',
  ifc: 'Extraído do IFC',
  calculado: 'Calculado',
  manual: 'Informado manualmente',
  biblioteca: 'Biblioteca técnica',
  ausente: 'Não informado',
}
