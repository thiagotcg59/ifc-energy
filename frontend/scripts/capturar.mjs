// Tira capturas de tela da interface para docs/capturas/, usando o
// Microsoft Edge que já vem no Windows (sem instalar nada).
//
// Uso (com o iniciar.ps1 rodando em outra janela):
//   node scripts/capturar.mjs                 -> http://localhost:5173
//   node scripts/capturar.mjs <endereco> <prefixo-do-arquivo>
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const endereco = process.argv[2] ?? 'http://localhost:5173/'
const prefixo = process.argv[3] ?? 'fase1'
const destino = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/capturas')
const edge = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)
if (!edge) throw new Error('Microsoft Edge não encontrado.')

const porta = 9333
const perfil = mkdtempSync(join(tmpdir(), 'ifc-energy-capturas-'))
const navegador = spawn(edge, [
  '--headless=new',
  `--remote-debugging-port=${porta}`,
  `--user-data-dir=${perfil}`,
  '--no-first-run',
  '--hide-scrollbars',
  'about:blank',
])

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

async function conectar() {
  for (let i = 0; i < 50; i++) {
    try {
      const abas = await (await fetch(`http://127.0.0.1:${porta}/json`)).json()
      const aba = abas.find((a) => a.type === 'page')
      if (aba) return new WebSocket(aba.webSocketDebuggerUrl)
    } catch {
      /* o navegador ainda está abrindo */
    }
    await dormir(200)
  }
  throw new Error('O Edge não abriu a porta de controle.')
}

const ws = await conectar()
await new Promise((ok, falha) => {
  ws.onopen = ok
  ws.onerror = falha
})
let proximoId = 0
const pendentes = new Map()
ws.onmessage = (evento) => {
  const msg = JSON.parse(evento.data)
  if (msg.id && pendentes.has(msg.id)) {
    pendentes.get(msg.id)(msg)
    pendentes.delete(msg.id)
  }
}
const enviar = (method, params = {}) =>
  new Promise((ok, falha) => {
    const id = ++proximoId
    pendentes.set(id, (msg) => (msg.error ? falha(new Error(msg.error.message)) : ok(msg.result)))
    ws.send(JSON.stringify({ id, method, params }))
  })
const avaliar = async (expressao) =>
  (await enviar('Runtime.evaluate', { expression: expressao, returnByValue: true })).result.value

async function esperarTexto(texto, limiteMs = 120_000) {
  const fim = Date.now() + limiteMs
  while (Date.now() < fim) {
    if (await avaliar(`document.body.innerText.includes(${JSON.stringify(texto)})`)) return
    await dormir(250)
  }
  throw new Error(
    `Esperei "${texto}" e não apareceu. Texto da página:\n${await avaliar('document.body.innerText')}`,
  )
}

async function capturar(nome, { largura, escuro = false }) {
  await enviar('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: escuro ? 'dark' : 'light' }],
  })
  await enviar('Emulation.setDeviceMetricsOverride', {
    width: largura,
    height: 800,
    deviceScaleFactor: 1,
    mobile: largura < 600,
  })
  await dormir(300)
  const { data } = await enviar('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  })
  const arquivo = join(destino, `${prefixo}-${nome}.png`)
  writeFileSync(arquivo, Buffer.from(data, 'base64'))
  console.log(`Gravado: ${arquivo}`)
}

try {
  mkdirSync(destino, { recursive: true })
  await enviar('Page.enable')
  await enviar('Page.navigate', { url: endereco })
  await esperarTexto('Nenhuma simulação ainda')
  await esperarTexto('Plataforma 0.') // estado do sistema carregado: botão liberado
  await capturar('1-inicio', { largura: 1100 })

  await avaliar(`[...document.querySelectorAll('button')]
    .find((b) => b.textContent.includes('Simular exemplo')).click()`)
  await esperarTexto('Dias de projeto')
  await capturar('2-simulando', { largura: 1100 })

  await esperarTexto('Consumo anual total')
  await capturar('3-resultados', { largura: 1100 })
  await capturar('4-resultados-escuro', { largura: 1100, escuro: true })
  await capturar('5-resultados-celular', { largura: 390 })
  const rolagem = await avaliar(
    'document.documentElement.scrollWidth > document.documentElement.clientWidth',
  )
  console.log(`Rolagem horizontal no celular: ${rolagem ? 'SIM (corrigir!)' : 'não'}`)
} finally {
  ws.close()
  navegador.kill()
  await dormir(500)
  rmSync(perfil, { recursive: true, force: true, maxRetries: 5 })
}
