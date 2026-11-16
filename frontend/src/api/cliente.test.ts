import { expect, test, vi } from 'vitest'
import { clienteHttp, criarClienteDemo } from './cliente'

const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })

test('cliente real chama /api/v1 e devolve o corpo', async () => {
  const busca = vi.spyOn(globalThis, 'fetch').mockResolvedValue(resposta({ estado: 'ok' }))

  await expect(clienteHttp.obterSaude()).resolves.toEqual({ estado: 'ok' })
  expect(busca).toHaveBeenCalledWith('/api/v1/saude', { method: 'GET' })
})

test('erro do backend usa a mensagem que ele mandou', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    resposta({ detail: 'Simulação não encontrada. Inicie uma nova.' }, 404),
  )

  await expect(clienteHttp.obterSimulacao('x')).rejects.toThrow('Inicie uma nova.')
})

test('sem conexão: a mensagem diz o que fazer', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

  await expect(clienteHttp.simularExemplo()).rejects.toThrow('iniciar.ps1')
})

test('modo demonstração reproduz as etapas e termina em "concluida"', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
    resposta({ id: 'demonstracao', estado: 'concluida', mensagem: 'fim', detalhes: [] }),
  )
  const demo = criarClienteDemo('./')

  const estados = [(await demo.simularExemplo()).estado]
  for (let i = 0; i < 4; i++) estados.push((await demo.obterSimulacao('demonstracao')).estado)

  expect(estados).toEqual(['na_fila', 'validando', 'dias_de_projeto', 'anual', 'concluida'])
})

test('modo demonstração lê os arquivos da pasta demo', async () => {
  const busca = vi.spyOn(globalThis, 'fetch').mockResolvedValue(resposta({ total_kwh: 1 }))

  await criarClienteDemo('/ifc-energy/').obterResultados('demonstracao')

  expect(busca).toHaveBeenCalledWith('/ifc-energy/demo/resultados.json')
})
