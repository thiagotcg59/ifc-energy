const inteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const umaCasa = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** 53403.86 -> "53.404 kWh" */
export const formatarKwh = (kwh: number) => `${inteiro.format(kwh)} kWh`

/** 185.83 -> "185,8 m²" ; null -> "—" */
export const formatarArea = (m2: number | null | undefined) =>
  m2 == null ? '—' : `${umaCasa.format(m2)} m²`

/** 1114.13 -> "1.114,1 kWh/m²" ; null -> "—" */
export const formatarIntensidade = (valor: number | null | undefined) =>
  valor == null ? '—' : `${umaCasa.format(valor)} kWh/m²`

/** 0.108 -> "10,8%" */
export const formatarParcela = (fracao: number) => `${umaCasa.format(fracao * 100)}%`
