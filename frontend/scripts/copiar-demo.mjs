// Copia para public/ o que o navegador precisa buscar em tempo de execução:
//  - exemplos/demo (dados do modo demonstração) e o IFC de exemplo;
//  - os arquivos .wasm do web-ifc (leitor de geometria IFC).
// As cópias não vão para o git.
import { copyFileSync, cpSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const demo = resolve(aqui, '../public/demo')
const wasm = resolve(aqui, '../public/wasm')

rmSync(demo, { recursive: true, force: true })
mkdirSync(demo, { recursive: true })
cpSync(resolve(aqui, '../../exemplos/demo'), demo, { recursive: true })
copyFileSync(
  resolve(aqui, '../../exemplos/ifc/residencia_exemplo.ifc'),
  resolve(demo, 'residencia_exemplo.ifc'),
)

rmSync(wasm, { recursive: true, force: true })
mkdirSync(wasm, { recursive: true })
for (const arquivo of ['web-ifc.wasm', 'web-ifc-mt.wasm']) {
  copyFileSync(resolve(aqui, '../node_modules/web-ifc', arquivo), resolve(wasm, arquivo))
}
