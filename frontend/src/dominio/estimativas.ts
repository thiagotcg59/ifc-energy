import type { Ajustes, ModeloBim, Valor } from '../api/modelos'
import { materialEfetivo, PROPRIEDADES, validar, camadasDe } from './modeloEfetivo'
import { faltantes, GRUPOS_DE_USO, PARAMETROS_DE_USO, validarUso } from './operacao'
import { FONTES_ESTIMATIVAS, MATERIAIS_ESTIMATIVAS, PERFIL_ESTIMATIVAS } from './perfilEstimativas'

export type TipoAmbiente = '' | 'quarto' | 'sala'
export interface EscolhasEstimativas {
  ambientes: Record<string, TipoAmbiente>
  materiais: Record<string, string>
  municipio?: string
}
export interface CampoPrevisto {
  grupo: 'operacao' | 'materiais'
  alvo_id: string
  alvo: string
  parametro: string
  rotulo: string
  valor: Valor
}
export interface PreviaEstimativas {
  campos: CampoPrevisto[]
  pendencias: string[]
  bloqueado: boolean
}
const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
const vazio = (v: Valor | undefined) => v?.valor === null || v?.valor === undefined

/** Associações conservadoras. A prévia permite corrigir o tipo antes de aplicar. */
export function sugerirEscolhas(bim: ModeloBim): EscolhasEstimativas {
  const ambientes: EscolhasEstimativas['ambientes'] = {}
  for (const a of bim.ambientes) {
    const nome = normalizar(a.nome ?? '')
    const quarto = /\b(quarto|dormitorio|suite)\b/.test(nome)
    const sala = /\bsala\b/.test(nome)
    const outro =
      /\b(banheiro|lavabo|servico|circulacao|corredor|garagem|closet|escritorio)\b/.test(nome)
    ambientes[a.global_id] =
      outro || (quarto && (sala || /\bcozinha\b/.test(nome)))
        ? ''
        : quarto
          ? 'quarto'
          : sala
            ? 'sala'
            : ''
  }
  const materiais: Record<string, string> = {}
  for (const m of bim.materiais) {
    const nome = normalizar(m.nome).trim()
    materiais[m.id] = /^(argamassa|reboco)( de reboco)?$/.test(nome)
      ? 'argamassa'
      : /^concreto( de densidade normal)?$/.test(nome)
        ? 'concreto'
        : /^madeira$/.test(nome)
          ? 'madeira'
          : /^revestimento ceramico$/.test(nome)
            ? 'ceramica'
            : /^tijolo( ceramico)? macico$/.test(nome)
              ? 'tijolo'
              : /^vidro( simples)? incolor( de)? 3\s*mm$/.test(nome)
                ? 'vidro_3mm'
                : ''
  }
  return { ambientes, materiais }
}

function valorDeUso(
  parametro: string,
  valor: number,
  fonte: keyof typeof FONTES_ESTIMATIVAS,
): Valor {
  const f = FONTES_ESTIMATIVAS[fonte]
  const soma =
    parametro === 'pessoas' ? ' Sala: soma dos ocupantes dos dormitórios (adaptação).' : ''
  return {
    valor,
    unidade: PARAMETROS_DE_USO[parametro]!.unidade,
    origem: 'estimado',
    fonte: `${PERFIL_ESTIMATIVAS} — ${f.nome}. ${f.url} — ${f.hipotese}${soma}`,
  }
}

/** Função pura: nenhuma prévia altera o IFC nem os ajustes. */
export function gerarPrevia(
  bim: ModeloBim,
  ajustes: Ajustes,
  escolhas: EscolhasEstimativas,
): PreviaEstimativas {
  const campos: CampoPrevisto[] = []
  const pendencias: string[] = []
  if (bim.ambientes.length === 0) {
    return {
      campos,
      pendencias: ['Sem IfcSpace: exporte os ambientes e consulte o Diagnóstico.'],
      bloqueado: true,
    }
  }
  const quartos = bim.ambientes.filter((a) => escolhas.ambientes[a.global_id] === 'quarto')
  const salas = bim.ambientes.filter((a) => escolhas.ambientes[a.global_id] === 'sala')
  const ocupacoes = new Map<string, number>()
  for (const a of quartos) {
    const atual = ajustes.operacao[a.global_id]?.pessoas
    const valor = atual?.valor
    if (typeof valor === 'number' && Number.isInteger(valor) && valor >= 0 && valor <= 50) {
      ocupacoes.set(a.global_id, valor)
    }
  }
  // A sala só usa estimativas de ocupação que já passaram pela validação do quarto.
  const ambientes = [...bim.ambientes].sort(
    (a, b) =>
      Number(escolhas.ambientes[b.global_id] === 'quarto') -
      Number(escolhas.ambientes[a.global_id] === 'quarto'),
  )
  for (const a of ambientes) {
    const alvo = a.nome ?? a.global_id
    const tipo = escolhas.ambientes[a.global_id]
    const atual = ajustes.operacao[a.global_id] ?? {}
    if (!faltantes(atual).length) continue
    if (tipo !== 'quarto' && tipo !== 'sala') {
      pendencias.push(
        `${alvo}: sem perfil de uso compatível; revise o tipo do ambiente ou informe os dados.`,
      )
      continue
    }
    const q = tipo === 'quarto'
    const total =
      quartos.length > 0 && ocupacoes.size === quartos.length
        ? [...ocupacoes.values()].reduce((s, n) => s + n, 0)
        : null
    const numeros: Record<string, [number | null, keyof typeof FONTES_ESTIMATIVAS]> = {
      pessoas: [q ? 2 : salas.length === 1 ? total : null, 'A'],
      calor_por_pessoa: [q ? 80 : 110, 'B'],
      ocupacao_inicio: [q ? 21 : 14, 'A'],
      ocupacao_fim: [q ? 8 : 21, 'A'],
      iluminacao_potencia: [q ? 5 : 6, 'A'],
      iluminacao_inicio: [q ? 21 : 17, 'A'],
      iluminacao_fim: [q ? 22 : 21, 'A'],
      equipamentos_potencia: [q ? 0 : 1.5, 'A'],
      equipamentos_inicio: [0, 'A'],
      equipamentos_fim: [24, 'A'],
      setpoint_aquecimento: [20, 'C'],
      setpoint_resfriamento: [26, 'C'],
      infiltracao: [1, 'D'],
    }
    for (const grupo of GRUPOS_DE_USO) {
      if (grupo.principal && atual[grupo.principal]?.valor === 0) continue
      const propostos: Record<string, Valor> = {}
      for (const p of grupo.parametros) {
        const [numero, fonte] = numeros[p.id]!
        if (vazio(atual[p.id]) && numero !== null) propostos[p.id] = valorDeUso(p.id, numero, fonte)
      }
      const mesclado = { ...atual, ...propostos }
      if (grupo.principal && mesclado[grupo.principal]?.valor === 0) {
        for (const p of grupo.parametros) if (p.id !== grupo.principal) delete propostos[p.id]
      }
      if (grupo.principal && vazio(mesclado[grupo.principal])) {
        pendencias.push(
          `${alvo}: informe ${PARAMETROS_DE_USO[grupo.principal]!.rotulo.toLowerCase()}; não foi possível determinar o total sem duplicar ocupantes.`,
        )
        continue
      }
      const erros = grupo.parametros.flatMap((p) => {
        const v = mesclado[p.id]?.valor
        if (grupo.principal && mesclado[grupo.principal]?.valor === 0 && p.id !== grupo.principal)
          return []
        if (v === undefined || v === null) return []
        const erro =
          typeof v === 'number'
            ? validarUso(mesclado, p.id, v)
            : `${p.rotulo}: valor existente não é numérico.`
        return erro ? [erro] : []
      })
      if (erros.length) {
        pendencias.push(`${alvo}: ${[...new Set(erros)].join(' ')}`)
        continue
      }
      if (q && grupo.id === 'ocupacao' && typeof mesclado.pessoas?.valor === 'number') {
        ocupacoes.set(a.global_id, mesclado.pessoas.valor)
      }
      for (const [parametro, valor] of Object.entries(propostos)) {
        campos.push({
          grupo: 'operacao',
          alvo_id: a.global_id,
          alvo,
          parametro,
          rotulo: PARAMETROS_DE_USO[parametro]!.rotulo,
          valor,
        })
      }
    }
  }
  for (const base of [...bim.materiais, ...ajustes.materiais_novos]) {
    const m = materialEfetivo(bim, ajustes, base.id)!
    const ref = MATERIAIS_ESTIMATIVAS.find((r) => r.id === escolhas.materiais[m.id])
    const chaves = ref
      ? Object.keys(ref.propriedades)
      : ['condutividade', 'densidade', 'calor_especifico']
    const faltam = chaves.filter((p) => vazio(m.propriedades[p]))
    if (faltam.length && !ref) {
      pendencias.push(
        `${m.nome}: propriedades sem referência compatível. Escolha um material somente se a composição corresponder.`,
      )
      continue
    }
    if (!ref) continue
    if (
      ref.espessura !== undefined &&
      bim.construcoes.some((c) =>
        camadasDe(bim, ajustes, c).some(
          (l) =>
            l.material_id === m.id &&
            typeof l.espessura.valor === 'number' &&
            Math.abs(l.espessura.valor - ref.espessura!) > 1e-6,
        ),
      )
    ) {
      pendencias.push(
        `${m.nome}: a espessura conhecida difere da referência de ${ref.espessura * 1000} mm.`,
      )
      continue
    }
    // A seleção não autoriza preencher bloco furado como se fosse material maciço.
    if (ref.id === 'tijolo' && /\b(furado|vazado|alveolar)\b/.test(normalizar(m.nome))) {
      pendencias.push(
        `${m.nome}: tijolo maciço não representa bloco furado; informe propriedades compatíveis.`,
      )
      continue
    }
    const conflitos = new Set<string>()
    for (const banda of ['solar', 'visivel']) {
      const t = `transmitancia_${banda}`
      const r = `refletancia_${banda}`
      const tv = vazio(m.propriedades[t]) ? ref.propriedades[t] : m.propriedades[t]?.valor
      const rv = vazio(m.propriedades[r]) ? ref.propriedades[r] : m.propriedades[r]?.valor
      if (typeof tv === 'number' && typeof rv === 'number' && tv + rv > 1) {
        conflitos.add(t)
        conflitos.add(r)
        pendencias.push(
          `${m.nome}: a soma de transmitância e refletância (${banda}) supera 1 com os valores existentes; revise os dados ópticos.`,
        )
      }
    }
    for (const parametro of faltam) {
      if (conflitos.has(parametro)) continue
      const def = PROPRIEDADES[parametro]!
      const valor = ref.propriedades[parametro]!
      if (validar(valor, def, def.rotulo)) continue
      campos.push({
        grupo: 'materiais',
        alvo_id: m.id,
        alvo: m.nome,
        parametro,
        rotulo: def.rotulo,
        valor: {
          valor,
          unidade: def.unidade,
          origem: 'estimado',
          fonte: `${PERFIL_ESTIMATIVAS} — ${ref.arquivo}, entrada ${ref.entrada}. Aproximação aprovada em 16/11/2026; confirmar correspondência com o material real.`,
        },
      })
    }
    const semFonte = Object.keys(m.propriedades).filter(
      (p) => vazio(m.propriedades[p]) && !(p in ref.propriedades),
    )
    if (semFonte.length)
      pendencias.push(
        `${m.nome}: sem estimativa para ${semFonte.map((p) => PROPRIEDADES[p]?.rotulo ?? p).join(', ')}.`,
      )
  }
  for (const c of bim.construcoes) {
    if (camadasDe(bim, ajustes, c).some((l) => vazio(l.espessura))) {
      pendencias.push(
        `${c.nome}: espessura ausente; a referência do material não define a espessura real.`,
      )
    }
  }
  for (const e of bim.elementos.filter((e) => e.categoria === 'janela')) {
    const vidro = { ...e.envidracamento, ...ajustes.aberturas[e.construcao_id ?? ''] }
    if (vazio(vidro.fator_solar) || vazio(vidro.transmitancia_termica_verao)) {
      pendencias.push(
        `${e.nome ?? e.global_id}: U/SHGC da janela inteira dependem da composição e do caixilho; os dados de vidro não os substituem.`,
      )
    }
  }
  pendencias.push(
    'Clima, geometria, fronteiras e resistências superficiais sem fonte aprovada continuam exigindo definição própria. Consulte Preparar simulação.',
  )
  return { campos, pendencias: [...new Set(pendencias)], bloqueado: false }
}

export function aplicarEstimativas(
  bim: ModeloBim,
  ajustes: Ajustes,
  escolhas: EscolhasEstimativas,
  lote: { id: string; quando: string },
): Ajustes {
  const previa = gerarPrevia(bim, ajustes, escolhas)
  if (previa.bloqueado || previa.campos.length === 0) return ajustes
  const novo = structuredClone(ajustes)
  const campos = previa.campos.map((c) => {
    novo[c.grupo][c.alvo_id] ??= {}
    const anterior = novo[c.grupo][c.alvo_id]![c.parametro] ?? null
    const aplicado = { ...c.valor, estimativa_id: lote.id }
    novo[c.grupo][c.alvo_id]![c.parametro] = aplicado
    return { grupo: c.grupo, alvo_id: c.alvo_id, parametro: c.parametro, anterior, aplicado }
  })
  novo.estimativas.push({
    ...lote,
    perfil: PERFIL_ESTIMATIVAS,
    municipio: escolhas.municipio?.trim() ?? '',
    campos,
  })
  novo.historico.push({
    quando: lote.quando,
    alvo: 'Modelo',
    campo: 'Estimativas aplicadas',
    para: `${campos.length} valores — ${PERFIL_ESTIMATIVAS}`,
  })
  return novo
}

export function desfazerEstimativas(ajustes: Ajustes, id: string): Ajustes {
  const lote = ajustes.estimativas.find((l) => l.id === id)
  if (!lote) return ajustes
  const novo = structuredClone(ajustes)
  let removidos = 0
  for (const c of lote.campos) {
    const atual = novo[c.grupo][c.alvo_id]?.[c.parametro]
    const aplicado = c.aplicado
    if (
      !atual ||
      atual.origem !== 'estimado' ||
      atual.estimativa_id !== id ||
      atual.valor !== aplicado.valor ||
      atual.fonte !== aplicado.fonte ||
      atual.unidade !== aplicado.unidade
    )
      continue
    if (c.anterior) novo[c.grupo][c.alvo_id]![c.parametro] = structuredClone(c.anterior)
    else delete novo[c.grupo][c.alvo_id]![c.parametro]
    if (Object.keys(novo[c.grupo][c.alvo_id]!).length === 0) delete novo[c.grupo][c.alvo_id]
    removidos++
  }
  novo.estimativas = novo.estimativas.filter((l) => l.id !== id)
  novo.historico.push({
    quando: new Date().toISOString(),
    alvo: 'Modelo',
    campo: 'Estimativas desfeitas',
    para: `${removidos} valores restaurados; edições posteriores preservadas`,
  })
  return novo
}
