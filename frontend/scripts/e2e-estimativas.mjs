// Navegador real: prévia, preservação, origem, persistência, desfazer e layout.
// Usa apenas a residência sintética. Para backend, use dados de teste isolados.
import { resolve } from 'node:path'
import { abrirNavegador } from './navegador.mjs'

const endereco = process.argv[2] ?? 'http://127.0.0.1:5173/'
const prefixo = process.argv[3] ?? 'estimativas-demo'
if (!/^[a-z0-9-]+$/.test(prefixo)) throw new Error('Prefixo de captura inválido.')
const n = await abrirNavegador()
const estado = (expressao) =>
  n.avaliar(`(() => { const e = window.__ifcEnergy.estado(); return ${expressao} })()`)
const conferir = (ok, mensagem) => {
  if (!ok) throw new Error(mensagem)
  console.log(`ok: ${mensagem}`)
}
const capturar = (nome) => n.capturar(resolve('../docs/capturas', `${prefixo}-${nome}.png`))
async function abrir() {
  await n.clicar('button', 'Explorar residência de exemplo')
  await n.esperarTexto('Enquadrar tudo')
}
async function teclado(key, modifiers = 0) {
  for (const type of ['keyDown', 'keyUp'])
    await n.enviar('Input.dispatchKeyEvent', {
      type,
      key,
      code: key,
      modifiers,
      windowsVirtualKeyCode: key === 'Tab' ? 9 : 27,
    })
  await n.dormir(150)
}
try {
  await n.tela(1500, 920)
  await n.ir(endereco)
  await n.esperarTexto('Explorar residência de exemplo')
  await abrir()
  const original = await estado('JSON.stringify(e.analise.bim)')
  await n.clicar('[role=tab]', 'Uso e operação')
  await n.clicar('.uso__ambiente', 'Sala e cozinha')
  await n.preencher('Infiltração', '0')
  const antes = await estado('JSON.stringify(e.ajustes)')
  await n.clicar('button', 'Estimar dados faltantes')
  conferir(
    (await estado('JSON.stringify(e.ajustes)')) === antes,
    'abrir a prévia não modifica ajustes',
  )
  await capturar('previa')
  await teclado('Tab', 8)
  conferir(
    await n.avaliar("document.activeElement?.textContent === 'Aplicar estimativas'"),
    'Shift+Tab mantém o foco no diálogo',
  )
  await teclado('Tab')
  conferir(
    await n.avaliar("document.activeElement?.getAttribute('aria-label') === 'Fechar estimativas'"),
    'Tab circula dentro do diálogo',
  )
  await teclado('Escape')
  conferir(
    await n.avaliar("document.activeElement?.innerText.includes('Estimar dados faltantes')"),
    'Escape devolve foco ao botão',
  )
  await n.clicar('button', 'Mudar para o tema claro')
  await n.clicar('button', 'Estimar dados faltantes')
  await capturar('claro')
  await n.tela(390, 844)
  conferir(
    await n.avaliar('document.documentElement.scrollWidth <= innerWidth + 1'),
    'celular sem rolagem horizontal',
  )
  conferir(
    await n.avaliar(
      "(() => { const r = document.querySelector('.estimativas .tutorial__rodape').getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0 })()",
    ),
    'ações acessíveis na tela de celular',
  )
  await capturar('celular')
  await n.tela(1500, 920)
  await n.clicar('[role=dialog] button', 'Aplicar estimativas')
  conferir((await estado('e.ajustes.estimativas.length')) === 1, 'uma aplicação registrada')
  conferir(
    await estado(
      "e.ajustes.operacao[e.analise.bim.ambientes.find(a => a.nome === 'Sala e cozinha').global_id].infiltracao.valor === 0",
    ),
    'zero manual preservado',
  )
  conferir(
    await estado(
      "Object.values(e.ajustes.operacao).flatMap(Object.values).some(v => v.origem === 'estimado' && v.fonte.includes('https://'))",
    ),
    'estimativas possuem fonte e origem',
  )
  conferir(
    await n.avaliar(
      "[...document.querySelectorAll('[role=dialog] button')].find(b => b.innerText === 'Aplicar estimativas').disabled",
    ),
    'segunda aplicação sem lacunas fica desabilitada',
  )
  await n.clicar('[role=dialog] button', 'Salvar parâmetros')
  await n.esperarTexto('Parâmetros ')
  await n.esperar(
    "[...document.querySelectorAll('[role=dialog] button')].find(b => b.innerText === 'Salvar parâmetros')?.disabled",
    'salvamento concluído',
  )
  await teclado('Escape')
  await n.clicar('.uso__ambiente', 'Quarto')
  conferir(
    await n.avaliar("document.querySelector('.uso').innerText.includes('Estimado')"),
    'formulário mostra o selo Estimado',
  )
  await capturar('aplicadas')
  await n.recarregar()
  await abrir()
  conferir(
    (await estado('e.ajustes.estimativas.length')) === 1,
    'origem e registro persistem após recarregar',
  )
  await n.clicar('[role=tab]', 'Uso e operação')
  await n.clicar('.uso__ambiente', 'Quarto')
  await n.preencher('Número de pessoas', '3')
  await n.clicar('button', 'Estimar dados faltantes')
  await n.clicar('[role=dialog] button', 'Desfazer estimativas')
  conferir(
    await estado(
      "e.ajustes.operacao[e.analise.bim.ambientes.find(a => a.nome === 'Quarto').global_id].pessoas.valor === 3",
    ),
    'desfazer preserva edição manual posterior',
  )
  conferir(
    await estado(
      "Object.values(e.ajustes.operacao).flatMap(Object.values).every(v => v.origem !== 'estimado')",
    ),
    'desfazer remove somente as estimativas',
  )
  conferir(
    (await estado('JSON.stringify(e.analise.bim)')) === original,
    'IFC e análise originais intactos',
  )
  await capturar('desfeitas')
  await teclado('Escape')
  conferir(
    await n.avaliar(
      "[...document.querySelectorAll('button')].find(b => b.innerText.includes('Executar simulação')).disabled",
    ),
    'conversão do IFC continua exigida',
  )
  conferir(n.erros.length === 0, `nenhum erro no navegador: ${n.erros.join('; ')}`)
  console.log('TUDO CERTO: estimativas verificadas em ' + endereco)
} catch (erro) {
  console.error(erro)
  await capturar('falha').catch(() => {})
  process.exitCode = 1
} finally {
  await n.fechar()
}
