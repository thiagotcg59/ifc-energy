import { expect, test } from 'vitest'
import { formatarArea, formatarIntensidade, formatarKwh, formatarParcela } from './formatos'

// O Intl usa um tipo especial de espaço em alguns pontos; trocamos por espaço comum.
const limpo = (texto: string) => texto.replace(/\s/g, ' ')

test('kWh sem casas decimais e com ponto de milhar', () => {
  expect(limpo(formatarKwh(53403.86))).toBe('53.404 kWh')
  expect(limpo(formatarKwh(860.08))).toBe('860 kWh')
})

test('área e intensidade com uma casa decimal', () => {
  expect(limpo(formatarArea(185.83))).toBe('185,8 m²')
  expect(limpo(formatarIntensidade(1114.13))).toBe('1.114,1 kWh/m²')
})

test('valor ausente vira travessão', () => {
  expect(formatarArea(null)).toBe('—')
  expect(formatarIntensidade(null)).toBe('—')
})

test('parcela em porcentagem', () => {
  expect(limpo(formatarParcela(0.108))).toBe('10,8%')
})
