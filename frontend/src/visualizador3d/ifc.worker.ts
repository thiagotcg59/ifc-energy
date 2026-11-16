// Roda em segundo plano (Web Worker): abre o IFC com o web-ifc e devolve a
// geometria pronta, para a interface não travar com modelos grandes.
import { IfcAPI, IFCSPACE } from 'web-ifc'
import { extrairGeometria } from './extrairGeometria'

self.onmessage = async (evento: MessageEvent<{ ifc: ArrayBuffer; pastaWasm: string }>) => {
  try {
    const api = new IfcAPI()
    api.SetWasmPath(evento.data.pastaWasm, true)
    await api.Init()
    const modelo = api.OpenModel(new Uint8Array(evento.data.ifc))
    if (modelo < 0) throw new Error('O web-ifc não conseguiu abrir o arquivo.')
    const elementos = extrairGeometria(api, modelo, IFCSPACE)
    api.CloseModel(modelo)
    const transferir = elementos.flatMap((e) =>
      e.partes.flatMap((p) => [p.posicoes.buffer, p.normais.buffer, p.indices.buffer]),
    )
    self.postMessage({ elementos }, { transfer: transferir })
  } catch (erro) {
    self.postMessage({ erro: erro instanceof Error ? erro.message : String(erro) })
  }
}
