// Estado da área de trabalho: modelo aberto, seleção, visibilidade e ajustes.
import { create } from 'zustand'
import {
  ajustesVazios,
  apiModelos,
  type Ajustes,
  type ApiModelos,
  type Biblioteca,
  type MaterialDaBiblioteca,
  type ModeloAnalise,
  type Valor,
} from '../api/modelos'
import {
  camadasDe,
  LIMITE_ESPESSURA,
  LIMITE_RESISTENCIA,
  PROPRIEDADES,
  validar,
} from '../dominio/modeloEfetivo'
import { PARAMETROS_DE_USO, validarUso } from '../dominio/operacao'
import {
  aplicarEstimativas,
  desfazerEstimativas,
  type EscolhasEstimativas,
} from '../dominio/estimativas'

export type Selecao = { tipo: 'elemento' | 'ambiente' | 'material'; id: string } | null
export type Categoria = 'parede' | 'piso' | 'cobertura' | 'janela' | 'porta' | 'outro'
export type AbaInferior = 'diagnostico' | 'operacao' | 'termico' | 'simulacao' | 'alteracoes'
export const CATEGORIAS: { id: Categoria; rotulo: string; plural: string }[] = [
  { id: 'parede', rotulo: 'Parede', plural: 'Paredes' },
  { id: 'piso', rotulo: 'Piso', plural: 'Pisos' },
  { id: 'cobertura', rotulo: 'Cobertura', plural: 'Coberturas' },
  { id: 'janela', rotulo: 'Janela', plural: 'Janelas' },
  { id: 'porta', rotulo: 'Porta', plural: 'Portas' },
  { id: 'outro', rotulo: 'Outro', plural: 'Outros elementos' },
]

let api: ApiModelos = apiModelos
/** Só para testes: troca a fonte de dados. */
export const definirApi = (nova: ApiModelos) => {
  api = nova
}

interface Estado {
  fase: 'inicio' | 'carregando' | 'pronto' | 'erro'
  etapa: string
  erro: string | null
  analise: ModeloAnalise | null
  ifc: ArrayBuffer | null
  biblioteca: Biblioteca | null
  ajustes: Ajustes
  salvos: string // ajustes como estavam no último salvamento (JSON)
  salvando: boolean
  aviso: { tipo: 'ok' | 'erro'; texto: string } | null
  somenteNavegador: boolean
  selecao: Selecao
  ocultos: Record<string, true>
  isolados: string[] | null
  categoriasOcultas: Partial<Record<Categoria, true>>
  transparentes: Partial<Record<Categoria, true>>
  mostrarAmbientes: boolean
  mostrarRotulos: boolean
  mostrarSuperficies: boolean
  abaInferior: AbaInferior
  inferiorAberto: boolean

  abrirExemplo(): Promise<void>
  abrirArquivo(arquivo: File): Promise<void>
  fechar(): void
  selecionar(selecao: Selecao): void
  alternarOculto(id: string): void
  isolar(ids: string[] | null): void
  mostrarTudo(): void
  alternarCategoria(categoria: Categoria): void
  alternarTransparencia(categoria: Categoria): void
  /** Abre o painel inferior na aba pedida. */
  abrirAba(aba: AbaInferior): void
  definir(
    parcial: Partial<
      Pick<
        Estado,
        | 'mostrarAmbientes'
        | 'mostrarRotulos'
        | 'mostrarSuperficies'
        | 'abaInferior'
        | 'inferiorAberto'
        | 'aviso'
      >
    >,
  ): void

  editarMaterial(materialId: string, propriedade: string, valor: number | null): string | null
  aplicarBiblioteca(materialId: string, bibliotecaId: string): string | null
  editarEspessura(construcaoId: string, indice: number, valor: number): string | null
  trocarMaterialDaCamada(construcaoId: string, indice: number, bibliotecaId: string): string | null
  adicionarCamada(
    construcaoId: string,
    indice: number,
    bibliotecaId: string,
    espessura: number,
  ): string | null
  removerCamada(construcaoId: string, indice: number): string | null
  editarAbertura(construcaoId: string, parametro: string, valor: number | null): string | null
  editarResistencia(tipo: string, campo: 'rsi' | 'rse', valor: number | null): string | null
  editarUso(ambienteId: string, parametro: string, valor: number | null): string | null
  copiarUso(deAmbienteId: string): string | null
  limparUso(ambienteId: string): void
  restaurar(alvo?: { material?: string; construcao?: string }): void
  salvar(): Promise<void>
  importarAjustes(texto: string): string | null
  estimar(escolhas: EscolhasEstimativas): void
  desfazerEstimativa(id: string): void
}

const VISAO_INICIAL = {
  selecao: null,
  ocultos: {},
  isolados: null,
  categoriasOcultas: {},
  transparentes: {},
  mostrarAmbientes: false,
  mostrarRotulos: true,
  mostrarSuperficies: false,
} satisfies Partial<Estado>

export const temAlteracoes = (e: Pick<Estado, 'ajustes' | 'salvos'>) =>
  JSON.stringify(e.ajustes) !== e.salvos

export const useModelo = create<Estado>()((set, get) => {
  async function abrir(obter: () => Promise<ModeloAnalise>, ifcLocal?: ArrayBuffer) {
    set({ fase: 'carregando', etapa: 'Lendo o modelo IFC…', erro: null, ...VISAO_INICIAL })
    try {
      const analise = await obter()
      set({ etapa: 'Carregando a geometria e os parâmetros…' })
      const [ifc, ajustes, biblioteca] = await Promise.all([
        ifcLocal ?? api.baixarIfc(analise.id),
        api.obterAjustes(analise.id),
        get().biblioteca ?? api.obterBiblioteca(),
      ])
      set({
        fase: 'pronto',
        analise,
        ifc,
        ajustes,
        biblioteca,
        salvos: JSON.stringify(ajustes),
        somenteNavegador: api.somenteNavegador,
        abaInferior: 'diagnostico',
      })
    } catch (erro) {
      set({
        fase: 'erro',
        erro: erro instanceof Error ? erro.message : 'Erro desconhecido ao abrir o modelo.',
      })
    }
  }

  /** Aplica uma mudança nos ajustes e registra a alteração no histórico. */
  function alterar(
    mudar: (a: Ajustes) => void,
    registro: { alvo: string; campo: string; de?: Valor['valor']; para?: Valor['valor'] },
  ) {
    const ajustes = structuredClone(get().ajustes)
    mudar(ajustes)
    const texto = (v: Valor['valor'] | undefined) =>
      typeof v === 'boolean' ? String(v) : (v ?? null)
    ajustes.historico.push({
      quando: new Date().toISOString(),
      alvo: registro.alvo,
      campo: registro.campo,
      de: texto(registro.de),
      para: texto(registro.para),
    })
    set({ ajustes })
  }

  const bim = () => get().analise?.bim
  const daBiblioteca = (id: string) => get().biblioteca?.materiais.find((m) => m.id === id)
  const fonteDe = (m: MaterialDaBiblioteca) =>
    `Biblioteca: ${m.nome_na_fonte ?? m.nome} — ${get().biblioteca?.fontes[m.fonte ?? ''] ?? 'sem fonte'}${m.aprovado ? '' : ' (pendente de aprovação)'}`
  const valoresDaBiblioteca = (m: MaterialDaBiblioteca) => {
    const props: Record<string, Valor> = {}
    for (const [chave, def] of Object.entries(PROPRIEDADES)) {
      const bruto = (m as unknown as Record<string, unknown>)[chave]
      props[chave] =
        typeof bruto === 'number'
          ? { valor: bruto, unidade: def.unidade, origem: 'biblioteca', fonte: fonteDe(m) }
          : { valor: null, unidade: def.unidade, origem: 'ausente' }
    }
    return props
  }
  /** Garante que o material da biblioteca exista no modelo; devolve o id dele. */
  function materialNovo(ajustes: Ajustes, m: MaterialDaBiblioteca): string {
    const id = `biblioteca-${m.id}`
    if (!ajustes.materiais_novos.some((n) => n.id === id)) {
      ajustes.materiais_novos.push({
        id,
        nome: m.nome,
        categoria: m.categoria,
        descricao: m.descricao,
        propriedades: valoresDaBiblioteca(m),
      })
    }
    return id
  }
  function camadasEditaveis(ajustes: Ajustes, construcaoId: string) {
    const modelo = bim()
    const construcao = modelo?.construcoes.find((c) => c.id === construcaoId)
    if (!modelo || !construcao) return null
    ajustes.camadas[construcaoId] ??= structuredClone(camadasDe(modelo, ajustes, construcao))
    return { construcao, camadas: ajustes.camadas[construcaoId] }
  }
  const nomeDoMaterial = (id: string) =>
    bim()?.materiais.find((m) => m.id === id)?.nome ??
    get().ajustes.materiais_novos.find((m) => m.id === id)?.nome ??
    id

  return {
    fase: 'inicio',
    etapa: '',
    erro: null,
    analise: null,
    ifc: null,
    biblioteca: null,
    ajustes: ajustesVazios(),
    salvos: JSON.stringify(ajustesVazios()),
    salvando: false,
    aviso: null,
    somenteNavegador: api.somenteNavegador,
    abaInferior: 'diagnostico',
    inferiorAberto: true,
    ...VISAO_INICIAL,

    abrirExemplo: () => abrir(() => api.abrirExemplo()),
    abrirArquivo: async (arquivo) => {
      const conteudo = await arquivo.arrayBuffer()
      await abrir(() => api.enviarIfc(arquivo), conteudo)
    },
    fechar: () => set({ fase: 'inicio', analise: null, ifc: null, erro: null, ...VISAO_INICIAL }),

    selecionar: (selecao) => set({ selecao }),
    alternarOculto: (id) =>
      set((e) => {
        const ocultos = { ...e.ocultos }
        if (ocultos[id]) delete ocultos[id]
        else ocultos[id] = true
        return { ocultos, selecao: e.selecao?.id === id && ocultos[id] ? null : e.selecao }
      }),
    isolar: (ids) => set({ isolados: ids }),
    mostrarTudo: () => set({ ocultos: {}, isolados: null, categoriasOcultas: {} }),
    alternarCategoria: (categoria) =>
      set((e) => {
        const mapa = { ...e.categoriasOcultas }
        if (mapa[categoria]) delete mapa[categoria]
        else mapa[categoria] = true
        return { categoriasOcultas: mapa }
      }),
    alternarTransparencia: (categoria) =>
      set((e) => {
        const mapa = { ...e.transparentes }
        if (mapa[categoria]) delete mapa[categoria]
        else mapa[categoria] = true
        return { transparentes: mapa }
      }),
    abrirAba: (aba) => set({ abaInferior: aba, inferiorAberto: true }),
    definir: (parcial) => set(parcial),

    editarMaterial(materialId, propriedade, valor) {
      const def = PROPRIEDADES[propriedade]
      const modelo = bim()
      if (!def || !modelo) return 'Propriedade desconhecida.'
      if (valor !== null) {
        const erro = validar(valor, def, def.rotulo)
        if (erro) return erro
      }
      const original =
        modelo.materiais.find((m) => m.id === materialId) ??
        get().ajustes.materiais_novos.find((m) => m.id === materialId)
      const anterior =
        get().ajustes.materiais[materialId]?.[propriedade] ?? original?.propriedades[propriedade]
      if ((anterior?.valor ?? null) === valor) return null
      alterar(
        (a) => {
          a.materiais[materialId] ??= {}
          a.materiais[materialId][propriedade] =
            valor === null
              ? { valor: null, unidade: def.unidade, origem: 'ausente' }
              : {
                  valor,
                  unidade: def.unidade,
                  origem: 'manual',
                  fonte: 'Informado manualmente no inspetor',
                }
        },
        {
          alvo: `Material: ${nomeDoMaterial(materialId)}`,
          campo: def.rotulo,
          de: anterior?.valor,
          para: valor,
        },
      )
      return null
    },

    aplicarBiblioteca(materialId, bibliotecaId) {
      const m = daBiblioteca(bibliotecaId)
      if (!m) return 'Material não encontrado na biblioteca.'
      const valores = Object.fromEntries(
        Object.entries(valoresDaBiblioteca(m)).filter(([, v]) => v.valor !== null),
      )
      if (Object.keys(valores).length === 0) {
        return `“${m.nome}” não tem propriedades na biblioteca.`
      }
      alterar(
        (a) => {
          a.materiais[materialId] = { ...(a.materiais[materialId] ?? {}), ...valores }
        },
        {
          alvo: `Material: ${nomeDoMaterial(materialId)}`,
          campo: 'Propriedades da biblioteca',
          para: m.nome,
        },
      )
      return null
    },

    editarEspessura(construcaoId, indice, valor) {
      const erro = validar(valor, LIMITE_ESPESSURA, 'Espessura (m)')
      if (erro) return erro
      const atual = structuredClone(get().ajustes)
      const alvo = camadasEditaveis(atual, construcaoId)
      const camada = alvo?.camadas[indice]
      if (!alvo || !camada) return 'Camada não encontrada.'
      if (camada.espessura.valor === valor) return null
      alterar(
        (a) => {
          const c = camadasEditaveis(a, construcaoId)?.camadas[indice]
          if (c) {
            c.espessura = {
              valor,
              unidade: 'm',
              origem: 'manual',
              fonte: 'Informado manualmente no inspetor',
            }
          }
        },
        {
          alvo: `Composição: ${alvo.construcao.nome}`,
          campo: `Espessura da camada ${indice + 1} (${camada.nome ?? ''})`,
          de: camada.espessura.valor,
          para: valor,
        },
      )
      return null
    },

    trocarMaterialDaCamada(construcaoId, indice, bibliotecaId) {
      const m = daBiblioteca(bibliotecaId)
      const alvo = camadasEditaveis(structuredClone(get().ajustes), construcaoId)
      const camada = alvo?.camadas[indice]
      if (!m || !alvo || !camada) return 'Camada ou material não encontrado.'
      if (typeof m.condutividade !== 'number') {
        return `“${m.nome}” não tem condutividade na biblioteca e não pode ser usado em camadas.`
      }
      alterar(
        (a) => {
          const c = camadasEditaveis(a, construcaoId)?.camadas[indice]
          if (c) {
            c.material_id = materialNovo(a, m)
            c.nome = m.nome
          }
        },
        {
          alvo: `Composição: ${alvo.construcao.nome}`,
          campo: `Material da camada ${indice + 1}`,
          de: camada.nome,
          para: m.nome,
        },
      )
      return null
    },

    adicionarCamada(construcaoId, indice, bibliotecaId, espessura) {
      const m = daBiblioteca(bibliotecaId)
      const alvo = camadasEditaveis(structuredClone(get().ajustes), construcaoId)
      if (!m || !alvo) return 'Composição ou material não encontrado.'
      if (typeof m.condutividade !== 'number') {
        return `“${m.nome}” não tem condutividade na biblioteca e não pode ser usado em camadas.`
      }
      const erro = validar(espessura, LIMITE_ESPESSURA, 'Espessura (m)')
      if (erro) return erro
      alterar(
        (a) => {
          camadasEditaveis(a, construcaoId)?.camadas.splice(indice, 0, {
            material_id: materialNovo(a, m),
            nome: m.nome,
            espessura: {
              valor: espessura,
              unidade: 'm',
              origem: 'manual',
              fonte: 'Camada acrescentada no inspetor',
            },
          })
        },
        {
          alvo: `Composição: ${alvo.construcao.nome}`,
          campo: `Nova camada na posição ${indice + 1}`,
          para: `${m.nome}, ${espessura} m`,
        },
      )
      return null
    },

    removerCamada(construcaoId, indice) {
      const alvo = camadasEditaveis(structuredClone(get().ajustes), construcaoId)
      const camada = alvo?.camadas[indice]
      if (!alvo || !camada) return 'Camada não encontrada.'
      if (alvo.camadas.length <= 1) return 'A composição precisa ter pelo menos uma camada.'
      alterar((a) => void camadasEditaveis(a, construcaoId)?.camadas.splice(indice, 1), {
        alvo: `Composição: ${alvo.construcao.nome}`,
        campo: `Camada ${indice + 1} removida`,
        de: camada.nome,
      })
      return null
    },

    editarAbertura(construcaoId, parametro, valor) {
      const limites: Record<
        string,
        { rotulo: string; unidade: string | null; min: number; max: number }
      > = {
        fator_solar: { rotulo: 'Fator solar (SHGC)', unidade: null, min: 0, max: 1 },
        transmitancia_termica_verao: {
          rotulo: 'Transmitância térmica da janela',
          unidade: 'W/(m²·K)',
          min: 0.1,
          max: 10,
        },
      }
      const def = limites[parametro]
      if (!def) return 'Parâmetro desconhecido.'
      if (valor !== null) {
        const erro = validar(valor, def, def.rotulo)
        if (erro) return erro
      }
      const anterior = get().ajustes.aberturas[construcaoId]?.[parametro]
      if ((anterior?.valor ?? null) === valor) return null
      const nome = bim()?.construcoes.find((c) => c.id === construcaoId)?.nome ?? construcaoId
      alterar(
        (a) => {
          a.aberturas[construcaoId] ??= {}
          if (valor === null) delete a.aberturas[construcaoId][parametro]
          else {
            a.aberturas[construcaoId][parametro] = {
              valor,
              unidade: def.unidade,
              origem: 'manual',
              fonte: 'Informado manualmente no inspetor',
            }
          }
        },
        { alvo: `Abertura: ${nome}`, campo: def.rotulo, de: anterior?.valor, para: valor },
      )
      return null
    },

    editarResistencia(tipo, campo, valor) {
      if (valor !== null) {
        const erro = validar(valor, LIMITE_RESISTENCIA, 'Resistência superficial (m²·K/W)')
        if (erro) return erro
      }
      const padrao = get().biblioteca?.resistencias_superficiais[tipo]
      const anterior = get().ajustes.resistencias_superficiais[tipo]?.[campo] ?? padrao?.[campo]
      if ((anterior ?? null) === valor) return null
      alterar(
        (a) => {
          a.resistencias_superficiais[tipo] = {
            rsi: padrao?.rsi ?? null,
            rse: padrao?.rse ?? null,
            ...(a.resistencias_superficiais[tipo] ?? {}),
            [campo]: valor,
          }
        },
        {
          alvo: `Convenção de cálculo: ${padrao?.nome ?? tipo}`,
          campo: campo === 'rsi' ? 'R_si' : 'R_se',
          de: anterior,
          para: valor,
        },
      )
      return null
    },

    estimar(escolhas) {
      const modelo = bim()
      if (!modelo) return
      set({
        ajustes: aplicarEstimativas(modelo, get().ajustes, escolhas, {
          id: crypto.randomUUID(),
          quando: new Date().toISOString(),
        }),
      })
    },

    desfazerEstimativa(id) {
      set({ ajustes: desfazerEstimativas(get().ajustes, id) })
    },

    editarUso(ambienteId, parametro, valor) {
      const def = PARAMETROS_DE_USO[parametro]
      const ambiente = bim()?.ambientes.find((a) => a.global_id === ambienteId)
      if (!def || !ambiente) return 'Ambiente ou parâmetro desconhecido.'
      const atual = get().ajustes.operacao[ambienteId]
      if (valor !== null) {
        const erro = validarUso(atual, parametro, valor)
        if (erro) return erro
      }
      const anterior = atual?.[parametro]?.valor ?? null
      if (anterior === valor) return null
      alterar(
        (a) => {
          a.operacao[ambienteId] ??= {}
          if (valor === null) delete a.operacao[ambienteId][parametro]
          else {
            a.operacao[ambienteId][parametro] = {
              valor,
              unidade: def.unidade,
              origem: 'manual',
              fonte: 'Informado manualmente no formulário de uso e operação',
            }
          }
        },
        {
          alvo: `Uso do ambiente: ${ambiente.nome ?? ambienteId}`,
          campo: def.rotulo,
          de: anterior,
          para: valor,
        },
      )
      return null
    },

    copiarUso(deAmbienteId) {
      const modelo = bim()
      const origem = modelo?.ambientes.find((a) => a.global_id === deAmbienteId)
      const uso = get().ajustes.operacao[deAmbienteId]
      if (!modelo || !origem) return 'Ambiente não encontrado.'
      if (!uso || Object.keys(uso).length === 0) {
        return 'Este ambiente ainda não tem dados de uso para copiar.'
      }
      alterar(
        (a) => {
          for (const outro of modelo.ambientes) {
            if (outro.global_id !== deAmbienteId) a.operacao[outro.global_id] = structuredClone(uso)
          }
        },
        {
          alvo: 'Uso dos ambientes',
          campo: 'Dados de uso copiados para os outros ambientes',
          de: null,
          para: origem.nome ?? deAmbienteId,
        },
      )
      return null
    },

    limparUso(ambienteId) {
      if (!get().ajustes.operacao[ambienteId]) return
      alterar((a) => void delete a.operacao[ambienteId], {
        alvo: `Uso do ambiente: ${bim()?.ambientes.find((a) => a.global_id === ambienteId)?.nome ?? ambienteId}`,
        campo: 'Dados de uso apagados',
      })
    },

    restaurar(alvo) {
      if (!alvo) {
        if (get().ajustes.historico.length === 0 && !temAlteracoes(get())) return
        alterar(
          (a) => {
            a.materiais = {}
            a.materiais_novos = []
            a.camadas = {}
            a.aberturas = {}
            a.resistencias_superficiais = {}
          },
          { alvo: 'Modelo', campo: 'Todos os parâmetros restaurados aos valores do IFC' },
        )
        return
      }
      alterar(
        (a) => {
          if (alvo.material) delete a.materiais[alvo.material]
          if (alvo.construcao) {
            delete a.camadas[alvo.construcao]
            delete a.aberturas[alvo.construcao]
          }
        },
        {
          alvo: alvo.material
            ? `Material: ${nomeDoMaterial(alvo.material)}`
            : `Composição: ${bim()?.construcoes.find((c) => c.id === alvo.construcao)?.nome ?? ''}`,
          campo: 'Restaurado aos valores do IFC',
        },
      )
    },

    async salvar() {
      const analise = get().analise
      if (!analise) return
      set({ salvando: true })
      try {
        const salvo = await api.salvarAjustes(analise.id, get().ajustes)
        set({
          ajustes: salvo,
          salvos: JSON.stringify(salvo),
          aviso: {
            tipo: 'ok',
            texto: api.somenteNavegador
              ? 'Parâmetros guardados neste navegador (não são enviados a nenhum servidor).'
              : 'Parâmetros salvos neste computador.',
          },
        })
      } catch (erro) {
        set({
          aviso: {
            tipo: 'erro',
            texto: erro instanceof Error ? erro.message : 'Não foi possível salvar.',
          },
        })
      } finally {
        set({ salvando: false })
      }
    },

    importarAjustes(texto) {
      try {
        const lido = JSON.parse(texto) as Partial<Ajustes>
        if (lido.versao !== 1 || typeof lido.materiais !== 'object') throw new Error('formato')
        set({ ajustes: { ...ajustesVazios(), ...lido } })
        return null
      } catch {
        return 'O arquivo não é um conjunto de parâmetros do ifc-energy (versão 1).'
      }
    },
  }
})
