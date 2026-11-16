// Controle do Microsoft Edge (que já vem no Windows) para testes e capturas
// de tela, sem instalar nada: fala com o navegador pelo protocolo de
// depuração (CDP). Usado por scripts/e2e.mjs.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

export async function abrirNavegador({ porta = 9333 } = {}) {
  const edge = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ].find(existsSync)
  if (!edge) throw new Error('Microsoft Edge não encontrado.')
  const perfil = mkdtempSync(join(tmpdir(), 'ifc-energy-navegador-'))
  const processo = spawn(edge, [
    '--headless=new',
    `--remote-debugging-port=${porta}`,
    `--user-data-dir=${perfil}`,
    '--no-first-run',
    '--hide-scrollbars',
    // Gráficos 3D por software, para funcionar sem placa de vídeo.
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    'about:blank',
  ])

  let ws
  for (let i = 0; i < 60 && !ws; i++) {
    try {
      const abas = await (await fetch(`http://127.0.0.1:${porta}/json`)).json()
      const aba = abas.find((a) => a.type === 'page')
      if (aba) ws = new WebSocket(aba.webSocketDebuggerUrl)
    } catch {
      await dormir(200)
    }
  }
  if (!ws) throw new Error('O Edge não abriu a porta de controle.')
  await new Promise((ok, falha) => {
    ws.onopen = ok
    ws.onerror = falha
  })

  let proximoId = 0
  const pendentes = new Map()
  const erros = []
  ws.onmessage = (evento) => {
    const msg = JSON.parse(evento.data)
    if (msg.id && pendentes.has(msg.id)) {
      pendentes.get(msg.id)(msg)
      pendentes.delete(msg.id)
    } else if (msg.method === 'Runtime.exceptionThrown') {
      erros.push(msg.params.exceptionDetails.exception?.description ?? 'erro de script')
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      erros.push(msg.params.args.map((a) => a.value ?? a.description).join(' '))
    }
  }
  const enviar = (method, params = {}) =>
    new Promise((ok, falha) => {
      const id = ++proximoId
      pendentes.set(id, (msg) =>
        msg.error ? falha(new Error(`${method}: ${msg.error.message}`)) : ok(msg.result),
      )
      ws.send(JSON.stringify({ id, method, params }))
    })
  await enviar('Page.enable')
  await enviar('Runtime.enable')

  const n = {
    erros,
    enviar,
    dormir,
    async avaliar(expressao) {
      const r = await enviar('Runtime.evaluate', {
        expression: expressao,
        returnByValue: true,
        awaitPromise: true,
      })
      if (r.exceptionDetails) {
        throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
      }
      return r.result.value
    },
    async ir(url) {
      await enviar('Page.navigate', { url })
      await dormir(300)
    },
    async recarregar() {
      await enviar('Page.reload')
      await dormir(500)
    },
    async tela(largura, altura = 900, escuro = true) {
      await enviar('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-color-scheme', value: escuro ? 'dark' : 'light' }],
      })
      await enviar('Emulation.setDeviceMetricsOverride', {
        width: largura,
        height: altura,
        deviceScaleFactor: 1,
        mobile: largura < 600,
      })
      await dormir(400)
    },
    /** Espera uma expressão JavaScript ficar verdadeira. */
    async esperar(expressao, descricao, limiteMs = 60_000) {
      const fim = Date.now() + limiteMs
      while (Date.now() < fim) {
        if (await n.avaliar(`Boolean(${expressao})`)) return
        await dormir(150)
      }
      throw new Error(
        `Esperei "${descricao}" e não aconteceu.\nTexto da página:\n${(await n.avaliar('document.body.innerText')).slice(0, 1500)}`,
      )
    },
    esperarTexto: (texto, limiteMs) =>
      n.esperar(`document.body.innerText.includes(${JSON.stringify(texto)})`, texto, limiteMs),
    /** Clica (como um usuário) no primeiro elemento do seletor cujo texto contém ``texto``. */
    async clicar(seletor, texto) {
      const achou = await n.avaliar(`(() => {
        const alvo = [...document.querySelectorAll(${JSON.stringify(seletor)})]
          .find((e) => (e.innerText || e.getAttribute('aria-label') || '').includes(${JSON.stringify(texto)}))
        if (!alvo) return false
        alvo.scrollIntoView({ block: 'center' })
        alvo.click()
        return true
      })()`)
      if (!achou) throw new Error(`Não encontrei ${seletor} com o texto "${texto}".`)
      await dormir(200)
    },
    /** Clique de mouse de verdade em um ponto da janela. */
    async clicarEm(x, y) {
      const base = { x, y, button: 'left', clickCount: 1, pointerType: 'mouse' }
      await enviar('Input.dispatchMouseEvent', { ...base, type: 'mouseMoved', button: 'none' })
      await enviar('Input.dispatchMouseEvent', { ...base, type: 'mousePressed' })
      await enviar('Input.dispatchMouseEvent', { ...base, type: 'mouseReleased' })
      await dormir(250)
    },
    /** Digita em um campo (achado pelo rótulo) e confirma com Enter. */
    async preencher(rotulo, valor) {
      const achou = await n.avaliar(`(() => {
        const rotulos = [...document.querySelectorAll('label')]
          .filter((l) => l.innerText.includes(${JSON.stringify(rotulo)}))
        const campo = rotulos.map((l) => document.getElementById(l.htmlFor)).find(Boolean)
        if (!campo) return false
        campo.scrollIntoView({ block: 'center' })
        campo.focus()
        campo.select()
        return true
      })()`)
      if (!achou) throw new Error(`Não encontrei o campo "${rotulo}".`)
      await enviar('Input.insertText', { text: valor })
      for (const type of ['keyDown', 'keyUp']) {
        await enviar('Input.dispatchKeyEvent', {
          type,
          key: 'Enter',
          code: 'Enter',
          windowsVirtualKeyCode: 13,
        })
      }
      await dormir(250)
    },
    async capturar(arquivo) {
      mkdirSync(dirname(arquivo), { recursive: true })
      const { data } = await enviar('Page.captureScreenshot', { format: 'png' })
      writeFileSync(arquivo, Buffer.from(data, 'base64'))
      console.log(`  captura: ${arquivo}`)
    },
    async fechar() {
      ws.close()
      processo.kill()
      await dormir(1500)
      try {
        rmSync(perfil, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
      } catch {
        // O Edge ainda segurava a pasta temporária; o Windows a limpa depois.
      }
    },
  }
  return n
}
