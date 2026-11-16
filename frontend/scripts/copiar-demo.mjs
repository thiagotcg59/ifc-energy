// Copia os dados de exemplo versionados (exemplos/demo) para public/demo,
// de onde o modo demonstração os lê. A cópia não vai para o git.
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const origem = resolve(aqui, '../../exemplos/demo')
const destino = resolve(aqui, '../public/demo')

rmSync(destino, { recursive: true, force: true })
mkdirSync(destino, { recursive: true })
cpSync(origem, destino, { recursive: true })
