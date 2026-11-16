import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { ClienteApi, ConsumoAnual, Saude, Simulacao } from '../api/cliente'
import { ErroApi } from '../api/cliente'
import { PaginaInicial } from './PaginaInicial'

const SAUDE: Saude = {
  estado: 'ok',
  versao: '0.1.0',
  energyplus: {
    encontrado: true,
    versao: '26.2.0',
    versao_esperada: '26.2.0',
    pasta: 'C:\\EnergyPlusV26-2-0',
    mensagem: 'EnergyPlus 26.2.0 pronto.',
  },
}

const simulacao = (estado: Simulacao['estado'], extra: Partial<Simulacao> = {}): Simulacao => ({
  id: 'abc',
  tipo: 'exemplo',
  estado,
  mensagem: '',
  detalhes: [],
  criado_em: '2026-11-15T00:00:00+00:00',
  atualizado_em: '2026-11-15T00:00:00+00:00',
  ...extra,
})

// Mesma conta fácil dos testes do backend: 180 + 20 = 200 kWh; 200 / 50 m² = 4.
const CONSUMO: ConsumoAnual = {
  itens: [
    {
      uso_final: 'Aquecimento',
      uso_final_chave: 'Heating',
      fonte: 'Eletricidade',
      fonte_chave: 'Electricity',
      kwh: 180,
    },
    {
      uso_final: 'Aquecimento',
      uso_final_chave: 'Heating',
      fonte: 'Gás natural',
      fonte_chave: 'Natural Gas',
      kwh: 20,
    },
  ],
  total_por_fonte: [
    { fonte: 'Eletricidade', fonte_chave: 'Electricity', kwh: 180 },
    { fonte: 'Gás natural', fonte_chave: 'Natural Gas', kwh: 20 },
  ],
  total_kwh: 200,
  area_condicionada_m2: 50,
  area_total_m2: 80,
  intensidade_kwh_m2: 4,
}

function apiFalsa(parcial: Partial<ClienteApi> = {}): ClienteApi {
  return {
    obterSaude: vi.fn().mockResolvedValue(SAUDE),
    simularExemplo: vi.fn().mockResolvedValue(simulacao('na_fila')),
    obterSimulacao: vi
      .fn()
      .mockResolvedValueOnce(simulacao('anual', { mensagem: 'Simulando o ano inteiro.' }))
      .mockResolvedValue(simulacao('concluida', { mensagem: 'Simulação concluída.' })),
    obterResultados: vi.fn().mockResolvedValue(CONSUMO),
    ...parcial,
  }
}

const montar = (api: ClienteApi, modoDemo = false) =>
  render(<PaginaInicial api={api} modoDemo={modoDemo} intervaloMs={1} />)

test('mostra "carregando" e depois o estado do EnergyPlus', async () => {
  montar(apiFalsa())

  expect(screen.getByText('Verificando o sistema…')).toBeInTheDocument()
  expect(await screen.findByText('EnergyPlus 26.2.0 pronto.')).toBeInTheDocument()
})

test('estado vazio antes da primeira simulação', async () => {
  montar(apiFalsa())

  expect(await screen.findByText(/Nenhuma simulação ainda/)).toBeInTheDocument()
})

test('backend fora do ar: mostra o que fazer e mantém o botão desabilitado', async () => {
  const api = apiFalsa({
    obterSaude: vi.fn().mockRejectedValue(new ErroApi('Confira se a janela do iniciar.ps1…')),
  })
  montar(api)

  expect(await screen.findByRole('alert')).toHaveTextContent('iniciar.ps1')
  expect(screen.getByRole('button', { name: 'Simular exemplo' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeEnabled()
})

test('sem EnergyPlus: botão de simular fica desabilitado', async () => {
  const semEnergyPlus: Saude = {
    ...SAUDE,
    energyplus: {
      ...SAUDE.energyplus,
      encontrado: false,
      versao: null,
      mensagem: 'EnergyPlus não encontrado em C:\\X. Instale…',
    },
  }
  montar(apiFalsa({ obterSaude: vi.fn().mockResolvedValue(semEnergyPlus) }))

  expect(await screen.findByText(/EnergyPlus não encontrado/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Simular exemplo' })).toBeDisabled()
})

test('simular: acompanha as etapas e mostra o consumo por uso final', async () => {
  const api = apiFalsa()
  montar(api)
  await screen.findByText('EnergyPlus 26.2.0 pronto.')

  await userEvent.click(screen.getByRole('button', { name: 'Simular exemplo' }))

  expect(await screen.findByText('Simulação concluída.')).toBeInTheDocument()
  expect(api.obterSimulacao).toHaveBeenCalledTimes(2)
  const resumo = screen.getByText('Consumo anual total').closest('div')!
  expect(within(resumo).getByText('200 kWh')).toBeInTheDocument()
  expect(screen.getByText('4,0 kWh/m²')).toBeInTheDocument()
  // Com duas fontes de energia, a legenda aparece.
  const legenda = screen.getByRole('list', { name: 'Fontes de energia' })
  expect(within(legenda).getByText(/Gás natural · 20 kWh/)).toBeInTheDocument()
  // Tabela alternativa ao gráfico, com o total.
  expect(screen.getByRole('table')).toHaveTextContent('Total200100,0%')
  expect(screen.getByRole('button', { name: 'Simular de novo' })).toBeEnabled()
})

test('simulação que falha mostra a mensagem e os erros do EnergyPlus', async () => {
  const api = apiFalsa({
    obterSimulacao: vi.fn().mockResolvedValue(
      simulacao('falhou', {
        mensagem: 'O EnergyPlus encontrou erros nos dias de projeto.',
        detalhes: ['** Severe  ** Zona sem superfícies'],
      }),
    ),
  })
  montar(api)
  await screen.findByText('EnergyPlus 26.2.0 pronto.')

  await userEvent.click(screen.getByRole('button', { name: 'Simular exemplo' }))

  const alerta = await screen.findByRole('alert')
  expect(alerta).toHaveTextContent('A simulação falhou')
  expect(alerta).toHaveTextContent('Zona sem superfícies')
  expect(api.obterResultados).not.toHaveBeenCalled()
})

test('erro de comunicação ao simular vira mensagem com orientação', async () => {
  const api = apiFalsa({
    simularExemplo: vi.fn().mockRejectedValue(new ErroApi('Confira se a janela do iniciar.ps1…')),
  })
  montar(api)
  await screen.findByText('EnergyPlus 26.2.0 pronto.')

  await userEvent.click(screen.getByRole('button', { name: 'Simular exemplo' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('iniciar.ps1')
})

test('faixa de demonstração só aparece no modo demonstração', async () => {
  const { unmount } = montar(apiFalsa(), true)
  expect(await screen.findByText('Modo demonstração.')).toBeInTheDocument()
  unmount()

  montar(apiFalsa(), false)
  await screen.findByText('EnergyPlus 26.2.0 pronto.')
  expect(screen.queryByText('Modo demonstração.')).not.toBeInTheDocument()
})
