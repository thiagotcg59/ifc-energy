// Dados de uso de cada ambiente (ocupação, iluminação, equipamentos,
// temperaturas de configuração e infiltração).
//
// O IFC não traz esses dados e a plataforma NÃO sugere valores: tudo o que
// aparece aqui foi informado pelo usuário (origem "manual"). Os limites abaixo
// servem só para barrar erros de digitação; não são valores recomendados.
import type { Ajustes, Valor } from '../api/modelos'

export interface ParametroDeUso {
  id: string
  rotulo: string
  unidade: string
  min: number
  max: number
  dica?: string
}
export interface GrupoDeUso {
  id: string
  titulo: string
  /** Objeto do EnergyPlus que receberá estes dados na conversão futura. */
  destino: string
  /** Parâmetro principal: se for zero, os demais do grupo não são exigidos. */
  principal: string
  parametros: ParametroDeUso[]
}

const hora = (id: string, rotulo: string): ParametroDeUso => ({
  id,
  rotulo,
  unidade: 'h',
  min: 0,
  max: 24,
})

export const GRUPOS_DE_USO: GrupoDeUso[] = [
  {
    id: 'ocupacao',
    titulo: 'Ocupação',
    destino: 'People',
    principal: 'pessoas',
    parametros: [
      { id: 'pessoas', rotulo: 'Número de pessoas', unidade: 'pessoas', min: 0, max: 50 },
      {
        id: 'calor_por_pessoa',
        rotulo: 'Calor liberado por pessoa',
        unidade: 'W/pessoa',
        min: 0,
        max: 1000,
        dica: 'Calor total (sensível + latente) da atividade.',
      },
      hora('ocupacao_inicio', 'Ocupação: início'),
      hora('ocupacao_fim', 'Ocupação: fim'),
    ],
  },
  {
    id: 'iluminacao',
    titulo: 'Iluminação',
    destino: 'Lights',
    principal: 'iluminacao_potencia',
    parametros: [
      {
        id: 'iluminacao_potencia',
        rotulo: 'Potência de iluminação',
        unidade: 'W/m²',
        min: 0,
        max: 100,
        dica: 'Potência instalada dividida pela área do piso.',
      },
      hora('iluminacao_inicio', 'Iluminação: início'),
      hora('iluminacao_fim', 'Iluminação: fim'),
    ],
  },
  {
    id: 'equipamentos',
    titulo: 'Equipamentos',
    destino: 'ElectricEquipment',
    principal: 'equipamentos_potencia',
    parametros: [
      {
        id: 'equipamentos_potencia',
        rotulo: 'Potência de equipamentos',
        unidade: 'W/m²',
        min: 0,
        max: 200,
        dica: 'Potência em uso dividida pela área do piso.',
      },
      hora('equipamentos_inicio', 'Equipamentos: início'),
      hora('equipamentos_fim', 'Equipamentos: fim'),
    ],
  },
  {
    id: 'climatizacao',
    titulo: 'Temperaturas de configuração (setpoints)',
    destino: 'ThermostatSetpoint:DualSetpoint',
    principal: '',
    parametros: [
      {
        id: 'setpoint_aquecimento',
        rotulo: 'Setpoint de aquecimento',
        unidade: '°C',
        min: 5,
        max: 30,
        dica: 'Abaixo desta temperatura o ambiente é aquecido.',
      },
      {
        id: 'setpoint_resfriamento',
        rotulo: 'Setpoint de resfriamento',
        unidade: '°C',
        min: 15,
        max: 40,
        dica: 'Acima desta temperatura o ambiente é resfriado.',
      },
    ],
  },
  {
    id: 'infiltracao',
    titulo: 'Infiltração de ar',
    destino: 'ZoneInfiltration:DesignFlowRate',
    principal: '',
    parametros: [
      {
        id: 'infiltracao',
        rotulo: 'Infiltração',
        unidade: 'trocas/h',
        min: 0,
        max: 20,
        dica: 'Renovações do volume de ar do ambiente por hora, pelas frestas.',
      },
    ],
  },
]

export const PARAMETROS_DE_USO: Record<string, ParametroDeUso> = Object.fromEntries(
  GRUPOS_DE_USO.flatMap((g) => g.parametros.map((p) => [p.id, p])),
)

export const SUPOSICOES_DE_USO = [
  'Os horários valem para todos os dias da semana.',
  'De 0 a 24 significa o dia inteiro. Início maior que o fim atravessa a meia-noite (por exemplo, de 22 a 7).',
  'As temperaturas de configuração valem o dia inteiro.',
]

export type UsoDoAmbiente = Record<string, Valor>
const numero = (uso: UsoDoAmbiente | undefined, id: string): number | null => {
  const valor = uso?.[id]?.valor
  return typeof valor === 'number' ? valor : null
}

/** Parâmetros que ainda faltam informar para o ambiente. */
export function faltantes(uso: UsoDoAmbiente | undefined): ParametroDeUso[] {
  return GRUPOS_DE_USO.flatMap((grupo) => {
    // Sem pessoas (ou potência zero), não há horário nem calor a informar.
    if (grupo.principal && numero(uso, grupo.principal) === 0) return []
    return grupo.parametros.filter((p) => numero(uso, p.id) === null)
  })
}

export const usoCompleto = (uso: UsoDoAmbiente | undefined) => faltantes(uso).length === 0

/** Quantos ambientes têm todos os dados de uso informados. */
export function ambientesCompletos(ajustes: Ajustes, ambientes: { global_id: string }[]): number {
  return ambientes.filter((a) => usoCompleto(ajustes.operacao[a.global_id])).length
}

/** Confere um valor contra os limites e contra os outros campos; devolve o erro ou null. */
export function validarUso(uso: UsoDoAmbiente | undefined, id: string, valor: number) {
  const def = PARAMETROS_DE_USO[id]
  if (!def) return 'Parâmetro desconhecido.'
  if (!Number.isFinite(valor)) return `${def.rotulo}: informe um número.`
  if (valor < def.min || valor > def.max) {
    return `${def.rotulo}: o valor precisa ficar entre ${def.min} e ${def.max} ${def.unidade}.`
  }
  const aquecimento = id === 'setpoint_aquecimento' ? valor : numero(uso, 'setpoint_aquecimento')
  const resfriamento = id === 'setpoint_resfriamento' ? valor : numero(uso, 'setpoint_resfriamento')
  if (id.startsWith('setpoint_') && aquecimento !== null && resfriamento !== null) {
    if (resfriamento <= aquecimento) {
      return 'O setpoint de resfriamento precisa ser maior que o de aquecimento.'
    }
  }
  const par = id.endsWith('_inicio')
    ? id.replace('_inicio', '_fim')
    : id.endsWith('_fim')
      ? id.replace('_fim', '_inicio')
      : null
  if (par && numero(uso, par) === valor) {
    return 'O início e o fim do horário não podem ser iguais. Para o dia inteiro, use de 0 a 24.'
  }
  return null
}
