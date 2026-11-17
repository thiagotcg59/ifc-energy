// Valores e adaptações aprovados pelo dono em 16/11/2026.
// Escopo do aceite: docs/spec/estimativas-centro-oeste.md. Nenhuma norma é implementada.
export const PERFIL_ESTIMATIVAS = 'centro-oeste-v1'
export const NOME_PERFIL = 'Residência — Centro-Oeste (referência: Cuiabá)'

export const FONTES_ESTIMATIVAS = {
  A: {
    nome: 'Guarda, Durante e Callejas (2020), p. 8, Tabela 4',
    url: 'https://periodicos.sbu.unicamp.br/ojs/index.php/parc/article/download/8657188/25757/89638',
    hipotese:
      'Cenário de habitação em Cuiabá. Rotina de dias úteis repetida todos os dias; equipamentos somente na sala.',
  },
  B: {
    nome: 'LabEEE/UFSC — Manual Ground Domain, p. 11–12',
    url: 'https://labeee.ufsc.br/sites/default/files/disciplinas/Manual_Ground_Domain.pdf',
    hipotese:
      'Calor por pessoa adaptado de exemplo de habitação em Florianópolis; não é medição regional.',
  },
  C: {
    nome: 'Martins e Schmid (2019), p. 132',
    url: 'https://periodicos.utfpr.edu.br/revistagi/article/download/9288/6630',
    hipotese:
      'Faixa de controle térmico de um estudo, adaptada aos ambientes. Não comprova aquecimento instalado.',
  },
  D: {
    nome: 'IFBQ/PBQP-H — DATec 012-E (2020), p. 15',
    url: 'https://pbqp-h.mdr.gov.br/wp-content/uploads/2021/09/DATec-12.pdf',
    hipotese:
      '1 troca/h por frestas, adaptada de outro sistema e habitação multifamiliar. Sem calibração regional; não é ventilação natural. Documento histórico com validade encerrada em 2023.',
  },
}

export interface ReferenciaMaterial {
  id: string
  nome: string
  entrada: string
  arquivo: string
  propriedades: Record<string, number>
  espessura?: number
}
const arquivo = 'EnergyPlus 26.2.0, DataSets/ASHRAE_2005_HOF_Materials.idf'
export const MATERIAIS_ESTIMATIVAS: ReferenciaMaterial[] = [
  {
    id: 'argamassa',
    nome: 'Argamassa de reboco (aproximação)',
    entrada: 'F07 25mm stucco',
    arquivo,
    propriedades: { condutividade: 0.72, densidade: 1856, calor_especifico: 840 },
  },
  {
    id: 'tijolo',
    nome: 'Tijolo maciço (não usar para bloco furado)',
    entrada: 'M01 100mm brick',
    arquivo,
    propriedades: { condutividade: 0.89, densidade: 1920, calor_especifico: 790 },
  },
  {
    id: 'concreto',
    nome: 'Concreto de densidade normal',
    entrada: 'M14a 100mm heavyweight concrete',
    arquivo,
    propriedades: { condutividade: 1.95, densidade: 2240, calor_especifico: 900 },
  },
  {
    id: 'ceramica',
    nome: 'Revestimento cerâmico (aproximação)',
    entrada: 'F14 Slate or tile',
    arquivo,
    propriedades: { condutividade: 1.59, densidade: 1920, calor_especifico: 1260 },
  },
  {
    id: 'madeira',
    nome: 'Madeira (aproximação)',
    entrada: 'G05 25mm wood',
    arquivo,
    propriedades: { condutividade: 0.15, densidade: 608, calor_especifico: 1630 },
  },
  {
    id: 'isolante',
    nome: 'Placa isolante do dataset (confirmar composição)',
    entrada: 'I02 50mm insulation board',
    arquivo,
    propriedades: { condutividade: 0.03, densidade: 43, calor_especifico: 1210 },
  },
  {
    id: 'vidro_3mm',
    espessura: 0.003,
    nome: 'Vidro simples incolor de 3 mm',
    entrada: 'CLEAR 3MM',
    arquivo: 'EnergyPlus 26.2.0, DataSets/WindowGlassMaterials.idf',
    propriedades: {
      condutividade: 0.9,
      transmitancia_solar: 0.837,
      refletancia_solar: 0.075,
      transmitancia_visivel: 0.898,
      refletancia_visivel: 0.081,
      emissividade: 0.84,
    },
  },
]
