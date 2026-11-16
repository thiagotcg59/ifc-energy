// Cálculos térmicos de composições em camadas homogêneas.
// É o MESMO cálculo de backend/app/dominio/termica.py; os dois são
// conferidos pelos casos de exemplos/testes/vetores_termicos.json.
//
//   R_i = e_i / λ_i            resistência de cada camada        [m²·K/W]
//   R_t = Σ R_i                de superfície a superfície
//   R_T = R_si + R_t + R_se    de ambiente a ambiente
//   U   = 1 / R_T              transmitância térmica             [W/(m²·K)]
//   C_T = Σ e_i · ρ_i · c_i    capacidade térmica por área       [J/(m²·K)]
//
// R_si e R_se são convenções de cálculo, não propriedades das camadas.

export interface CamadaTermica {
  espessura: number | null
  condutividade: number | null
  densidade?: number | null
  calor_especifico?: number | null
}

export interface DesempenhoTermico {
  resistencias: (number | null)[]
  resistencia_camadas: number | null
  resistencia_total: number | null
  transmitancia: number | null
  capacidade_termica: number | null
  pendencias: string[]
}

const positivo = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0

export function calcularDesempenho(
  camadas: CamadaTermica[],
  rsi: number | null,
  rse: number | null,
): DesempenhoTermico {
  const pendencias: string[] = []
  const resistencias = camadas.map((c, i) => {
    if (positivo(c.espessura) && positivo(c.condutividade)) return c.espessura / c.condutividade
    pendencias.push(`Camada ${i + 1}: falta espessura ou condutividade térmica.`)
    return null
  })
  if (camadas.length === 0) pendencias.push('A composição não tem camadas.')
  const completo = camadas.length > 0 && resistencias.every((r) => r !== null)
  const rCamadas = completo ? resistencias.reduce<number>((s, r) => s + (r ?? 0), 0) : null

  let rTotal: number | null = null
  if (rCamadas !== null) {
    if (rsi === null || rse === null) {
      pendencias.push('Faltam as resistências superficiais (R_si e R_se).')
    } else {
      rTotal = rsi + rCamadas + rse
    }
  }

  let capacidade: number | null = null
  if (
    camadas.length > 0 &&
    camadas.every(
      (c) => positivo(c.espessura) && positivo(c.densidade) && positivo(c.calor_especifico),
    )
  ) {
    capacidade = camadas.reduce(
      (s, c) => s + (c.espessura ?? 0) * (c.densidade ?? 0) * (c.calor_especifico ?? 0),
      0,
    )
  } else if (camadas.length > 0) {
    pendencias.push('Capacidade térmica: falta densidade ou calor específico.')
  }

  return {
    resistencias,
    resistencia_camadas: rCamadas,
    resistencia_total: rTotal,
    transmitancia: rTotal ? 1 / rTotal : null,
    capacidade_termica: capacidade,
    pendencias,
  }
}
