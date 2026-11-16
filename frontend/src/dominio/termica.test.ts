// @vitest-environment node
import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { calcularDesempenho, type CamadaTermica } from './termica'

// Os MESMOS casos conferem o cálculo em Python (backend/tests/test_termica.py).
const vetores = JSON.parse(
  readFileSync(new URL('../../../exemplos/testes/vetores_termicos.json', import.meta.url), 'utf-8'),
) as {
  casos: {
    nome: string
    camadas: CamadaTermica[]
    rsi: number | null
    rse: number | null
    esperado: Record<string, number | null | (number | null)[]>
  }[]
}

test.each(vetores.casos)('$nome', (caso) => {
  const r = calcularDesempenho(caso.camadas, caso.rsi, caso.rse) as unknown as Record<
    string,
    unknown
  >

  for (const [campo, esperado] of Object.entries(caso.esperado)) {
    const obtido = r[campo]
    if (Array.isArray(esperado)) {
      const lista = obtido as (number | null)[]
      expect(lista).toHaveLength(esperado.length)
      esperado.forEach((e, i) =>
        e === null ? expect(lista[i]).toBeNull() : expect(lista[i]).toBeCloseTo(e, 9),
      )
    } else if (esperado === null) {
      expect(obtido, campo).toBeNull()
    } else {
      expect(Math.abs((obtido as number) / esperado - 1), campo).toBeLessThan(1e-6)
    }
  }
})

test('mais isolante aumenta a resistência e reduz a transmitância', () => {
  const base = [{ espessura: 0.1, condutividade: 1.95 }]
  const antes = calcularDesempenho(base, 0.13, 0.04)
  const depois = calcularDesempenho([...base, { espessura: 0.05, condutividade: 0.03 }], 0.13, 0.04)

  expect(depois.resistencia_camadas).toBeCloseTo((antes.resistencia_camadas ?? 0) + 0.05 / 0.03)
  expect(depois.transmitancia).toBeLessThan(antes.transmitancia ?? 0)
})
