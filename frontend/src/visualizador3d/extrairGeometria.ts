// Extrai do IFC a geometria REAL de cada elemento, usando o web-ifc.
// Nenhuma forma é desenhada "à mão": tudo vem das representações do arquivo.
// O web-ifc entrega as coordenadas com Y para cima: (x, y, z) = (x_ifc, z_ifc, −y_ifc).
import type { IfcAPI } from 'web-ifc'

export interface ParteGeometrica {
  posicoes: Float32Array
  normais: Float32Array
  indices: Uint32Array
  cor: [number, number, number, number] // r, g, b, opacidade
}

export interface ElementoGeometrico {
  globalId: string
  classe: string
  nome: string | null
  ambiente: boolean
  partes: ParteGeometrica[]
}

interface MalhaPlana {
  expressID: number
  geometries: {
    size(): number
    get(i: number): {
      geometryExpressID: number
      color: { x: number; y: number; z: number; w: number }
      flatTransformation: number[]
    }
  }
}

export function extrairGeometria(
  api: IfcAPI,
  modelo: number,
  tipoDoAmbiente: number,
): ElementoGeometrico[] {
  const saida: ElementoGeometrico[] = []

  const converter = (ambiente: boolean) => (malha: MalhaPlana) => {
    const linha = api.GetLine(modelo, malha.expressID) as {
      GlobalId?: { value: string }
      Name?: { value: string } | null
      LongName?: { value: string } | null
    }
    if (!linha?.GlobalId?.value) return
    const partes: ParteGeometrica[] = []
    for (let i = 0; i < malha.geometries.size(); i++) {
      const colocada = malha.geometries.get(i)
      const geometria = api.GetGeometry(modelo, colocada.geometryExpressID)
      // Vértices intercalados: posição (3) + normal (3).
      const vertices = api.GetVertexArray(geometria.GetVertexData(), geometria.GetVertexDataSize())
      const indices = api.GetIndexArray(geometria.GetIndexData(), geometria.GetIndexDataSize())
      const m = colocada.flatTransformation
      const n = vertices.length / 6
      const posicoes = new Float32Array(n * 3)
      const normais = new Float32Array(n * 3)
      for (let v = 0; v < n; v++) {
        const [x, y, z, nx, ny, nz] = vertices.subarray(v * 6, v * 6 + 6) as unknown as number[]
        posicoes[v * 3] = m[0]! * x! + m[4]! * y! + m[8]! * z! + m[12]!
        posicoes[v * 3 + 1] = m[1]! * x! + m[5]! * y! + m[9]! * z! + m[13]!
        posicoes[v * 3 + 2] = m[2]! * x! + m[6]! * y! + m[10]! * z! + m[14]!
        const a = m[0]! * nx! + m[4]! * ny! + m[8]! * nz!
        const b = m[1]! * nx! + m[5]! * ny! + m[9]! * nz!
        const c = m[2]! * nx! + m[6]! * ny! + m[10]! * nz!
        const tamanho = Math.hypot(a, b, c) || 1
        normais[v * 3] = a / tamanho
        normais[v * 3 + 1] = b / tamanho
        normais[v * 3 + 2] = c / tamanho
      }
      partes.push({
        posicoes,
        normais,
        indices: new Uint32Array(indices),
        cor: [colocada.color.x, colocada.color.y, colocada.color.z, colocada.color.w],
      })
      geometria.delete()
    }
    if (partes.length === 0) return
    saida.push({
      globalId: linha.GlobalId.value,
      classe: api.GetNameFromTypeCode(api.GetLineType(modelo, malha.expressID)),
      nome: linha.LongName?.value ?? linha.Name?.value ?? null,
      ambiente,
      partes,
    })
  }

  api.StreamAllMeshes(modelo, converter(false) as never)
  api.StreamAllMeshesWithTypes(modelo, [tipoDoAmbiente], converter(true) as never)
  return saida
}
