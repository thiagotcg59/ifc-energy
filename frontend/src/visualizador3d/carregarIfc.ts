import type { ElementoGeometrico } from './extrairGeometria'

/** Lê a geometria do IFC em segundo plano. O arquivo não sai do navegador. */
export function carregarIfc(ifc: ArrayBuffer): Promise<ElementoGeometrico[]> {
  return new Promise((resolver, rejeitar) => {
    const trabalhador = new Worker(new URL('./ifc.worker.ts', import.meta.url), { type: 'module' })
    trabalhador.onmessage = (
      evento: MessageEvent<{ elementos?: ElementoGeometrico[]; erro?: string }>,
    ) => {
      trabalhador.terminate()
      if (evento.data.elementos) resolver(evento.data.elementos)
      else rejeitar(new Error(evento.data.erro ?? 'Falha ao ler a geometria do IFC.'))
    }
    trabalhador.onerror = (evento) => {
      trabalhador.terminate()
      rejeitar(new Error(evento.message || 'Falha ao iniciar o leitor de geometria.'))
    }
    // Cópia: o original continua disponível para reabrir o modelo.
    const copia = ifc.slice(0)
    trabalhador.postMessage({ ifc: copia, pastaWasm: new URL('wasm/', document.baseURI).href }, [
      copia,
    ])
  })
}
