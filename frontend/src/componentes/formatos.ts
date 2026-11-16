import type { Valor } from '../api/modelos'

const curto = new Intl.NumberFormat('pt-BR', { maximumSignificantDigits: 4 })
const longo = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

/** 0.181804 -> "0,1818" ; 229632 -> "229.632" ; 39.195 -> "39,2" */
export function formatarNumero(valor: number): string {
  return Math.abs(valor) >= 1000 ? longo.format(valor) : curto.format(valor)
}

export function formatarValor(valor: Valor | undefined | null): string {
  const v = valor?.valor
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não'
  if (typeof v === 'string') return v
  return valor?.unidade ? `${formatarNumero(v)} ${valor.unidade}` : formatarNumero(v)
}

/** Aceita "0,89" ou "0.89"; devolve null para vazio e NaN para texto inválido. */
export function lerNumero(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, '').replace(',', '.')
  if (limpo === '') return null
  return /^-?\d*\.?\d+(e-?\d+)?$/i.test(limpo) ? Number(limpo) : Number.NaN
}

export const CORES_DA_CONDICAO: Record<string, { cor: string; rotulo: string }> = {
  exterior: { cor: '#eb6834', rotulo: 'Exterior (ar)' },
  solo: { cor: '#c98500', rotulo: 'Solo' },
  zona: { cor: '#3987e5', rotulo: 'Outra zona' },
  adiabatica: { cor: '#8f8d86', rotulo: 'Adiabática' },
  abertura: { cor: '#1baf7a', rotulo: 'Abertura' },
}

export const ROTULOS_CONDICAO: Record<string, string> = {
  exterior: 'Exterior (ar externo)',
  solo: 'Em contato com o solo',
  interior: 'Interior (entre ambientes)',
  indefinida: 'Não determinada',
  zona: 'Outra zona térmica',
  adiabatica: 'Adiabática (suposição)',
}
/** Condição de contorno correspondente no EnergyPlus (nomes conferidos no esquema 26.2). */
export const CONDICAO_ENERGYPLUS: Record<string, string> = {
  exterior: 'Outdoors',
  solo: 'Ground',
  zona: 'Surface',
  adiabatica: 'Adiabatic',
}
