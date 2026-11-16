// Cena 3D (three.js): desenha os elementos do IFC, cuida da câmera, da
// seleção por clique, da visibilidade, do corte e das superfícies térmicas.
// Não conhece React nem a API: recebe dados e avisa eventos.
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { ElementoGeometrico } from './extrairGeometria'

export type Vista = 'iso' | 'topo' | 'frente' | 'lado'
export interface SuperficieDesenhada {
  id: string
  vertices: [number, number, number][] // coordenadas do IFC (Z para cima)
  cor: string
  destacada?: boolean
}
export interface Visibilidade {
  ocultos: Record<string, true>
  isolados: string[] | null
  categoriasOcultas: Record<string, true | undefined>
  transparentes: Record<string, true | undefined>
  mostrarAmbientes: boolean
  fantasma: boolean // elementos quase invisíveis (modo superfícies térmicas)
}
interface Item {
  grupo: THREE.Group
  ambiente: boolean
  materiais: { material: THREE.MeshLambertMaterial; opacidade: number }[]
  caixa: THREE.Box3
}

const DESTAQUE = 0xff8a1f
const paraTres = ([x, y, z]: [number, number, number]) => new THREE.Vector3(x, z, -y)

export class Cena {
  private renderizador: THREE.WebGLRenderer
  private cena = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(45, 1, 0.05, 2000)
  private controles: OrbitControls
  private itens = new Map<string, Item>()
  private categorias: Record<string, string> = {}
  private raiz = new THREE.Group()
  private superficies = new THREE.Group()
  private contorno = new THREE.Group()
  private grade: THREE.GridHelper | null = null
  private planoDeCorte = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)
  private alturaDoCorte: number | null = null
  private camadaDeRotulos: HTMLDivElement
  private rotulos: { el: HTMLElement; posicao: THREE.Vector3 }[] = []
  private observador: ResizeObserver
  private pedido = 0
  private selecionado: string | null = null
  private escuro = true
  private apertou: { x: number; y: number } | null = null

  constructor(
    private container: HTMLElement,
    private eventos: {
      aoSelecionar(id: string | null): void
      aoPassar?(id: string | null, x: number, y: number): void
    },
  ) {
    this.renderizador = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    this.renderizador.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderizador.localClippingEnabled = true
    container.appendChild(this.renderizador.domElement)
    this.camadaDeRotulos = document.createElement('div')
    this.camadaDeRotulos.className = 'rotulos-3d'
    container.appendChild(this.camadaDeRotulos)

    this.cena.add(new THREE.HemisphereLight(0xffffff, 0x555566, 1.9))
    const sol = new THREE.DirectionalLight(0xffffff, 1.6)
    sol.position.set(6, 12, 8)
    this.cena.add(sol)
    this.cena.add(this.raiz, this.superficies, this.contorno)

    this.controles = new OrbitControls(this.camera, this.renderizador.domElement)
    this.controles.enableDamping = false
    this.controles.addEventListener('change', () => this.desenhar())

    const tela = this.renderizador.domElement
    tela.addEventListener('pointerdown', (e) => (this.apertou = { x: e.clientX, y: e.clientY }))
    tela.addEventListener('pointerup', (e) => {
      // Só é clique se o ponteiro quase não se moveu (senão foi giro da câmera).
      const inicio = this.apertou
      this.apertou = null
      if (!inicio || Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) > 4) return
      if (e.button !== 0) return
      this.eventos.aoSelecionar(this.elementoEm(e.clientX, e.clientY))
    })
    tela.addEventListener('pointermove', (e) => {
      if (this.apertou || !this.eventos.aoPassar) return
      const id = this.elementoEm(e.clientX, e.clientY)
      tela.style.cursor = id ? 'pointer' : ''
      this.eventos.aoPassar(id, e.clientX, e.clientY)
    })
    tela.addEventListener('pointerleave', () => this.eventos.aoPassar?.(null, 0, 0))

    this.observador = new ResizeObserver(() => this.redimensionar())
    this.observador.observe(container)
    this.redimensionar()
    this.tema(true)
  }

  // ---- carga -----------------------------------------------------------------
  carregar(elementos: ElementoGeometrico[], categorias: Record<string, string>) {
    this.limpar()
    this.categorias = categorias
    for (const elemento of elementos) {
      const grupo = new THREE.Group()
      grupo.userData.id = elemento.globalId
      const materiais: Item['materiais'] = []
      for (const parte of elemento.partes) {
        const geometria = new THREE.BufferGeometry()
        geometria.setAttribute('position', new THREE.BufferAttribute(parte.posicoes, 3))
        geometria.setAttribute('normal', new THREE.BufferAttribute(parte.normais, 3))
        geometria.setIndex(new THREE.BufferAttribute(parte.indices, 1))
        const [r, g, b, a] = parte.cor
        const opacidade = elemento.ambiente ? 0.22 : a
        const material = new THREE.MeshLambertMaterial({
          color: elemento.ambiente
            ? new THREE.Color(0x3aa0ff)
            : new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace),
          transparent: opacidade < 1,
          opacity: opacidade,
          side: THREE.DoubleSide,
          depthWrite: opacidade >= 1,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1,
          clippingPlanes: [],
        })
        const malha = new THREE.Mesh(geometria, material)
        malha.userData.id = elemento.globalId
        grupo.add(malha)
        materiais.push({ material, opacidade })
        if (!elemento.ambiente) {
          const arestas = new THREE.LineSegments(
            new THREE.EdgesGeometry(geometria, 30),
            new THREE.LineBasicMaterial({ color: 0x1b2430, transparent: true, opacity: 0.35 }),
          )
          arestas.userData.aresta = true
          grupo.add(arestas)
        }
      }
      this.raiz.add(grupo)
      this.itens.set(elemento.globalId, {
        grupo,
        ambiente: elemento.ambiente,
        materiais,
        caixa: new THREE.Box3().setFromObject(grupo),
      })
    }
    const caixa = this.caixaDe()
    if (!caixa.isEmpty()) {
      const tamanho = Math.max(...caixa.getSize(new THREE.Vector3()).toArray())
      const passo = tamanho > 40 ? 5 : 1
      const lado = Math.ceil((tamanho * 2.5) / passo) * passo
      this.grade = new THREE.GridHelper(lado, lado / passo)
      const centro = caixa.getCenter(new THREE.Vector3())
      this.grade.position.set(
        Math.round(centro.x / passo) * passo,
        caixa.min.y - 0.01,
        Math.round(centro.z / passo) * passo,
      )
      this.cena.add(this.grade)
      this.tema(this.escuro)
    }
    this.aplicarCorte()
    this.vista('iso')
  }

  private limpar() {
    for (const grupo of [this.raiz, this.superficies, this.contorno]) {
      grupo.traverse((objeto) => {
        const malha = objeto as THREE.Mesh
        malha.geometry?.dispose()
        const material = malha.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(material)) material.forEach((m) => m.dispose())
        else material?.dispose()
      })
      grupo.clear()
    }
    if (this.grade) this.cena.remove(this.grade)
    this.grade = null
    this.itens.clear()
    this.definirRotulos([])
    this.selecionado = null
  }

  // ---- visibilidade e seleção --------------------------------------------------
  aplicarVisibilidade(v: Visibilidade) {
    for (const [id, item] of this.itens) {
      const categoria = this.categorias[id] ?? 'outro'
      const visivel = item.ambiente
        ? v.mostrarAmbientes && !v.ocultos[id]
        : !v.ocultos[id] &&
          !v.categoriasOcultas[categoria] &&
          (v.isolados === null || v.isolados.includes(id))
      item.grupo.visible = visivel
      for (const { material, opacidade } of item.materiais) {
        const alvo = item.ambiente
          ? opacidade
          : v.fantasma
            ? 0.07
            : v.transparentes[categoria]
              ? Math.min(opacidade, 0.25)
              : opacidade
        material.opacity = alvo
        material.transparent = alvo < 1
        material.depthWrite = alvo >= 1
        material.needsUpdate = true
      }
      item.grupo.traverse((o) => {
        if (o.userData.aresta) o.visible = !v.fantasma
      })
    }
    this.desenhar()
  }

  selecionar(id: string | null) {
    const pintar = (alvo: string | null, cor: number, intensidade: number) => {
      const item = alvo ? this.itens.get(alvo) : null
      item?.materiais.forEach(({ material }) => {
        material.emissive.setHex(cor)
        material.emissiveIntensity = intensidade
      })
    }
    pintar(this.selecionado, 0x000000, 0)
    this.selecionado = id && this.itens.has(id) ? id : null
    pintar(this.selecionado, DESTAQUE, 0.55)

    this.contorno.traverse((o) => (o as THREE.LineSegments).geometry?.dispose())
    this.contorno.clear()
    const item = this.selecionado ? this.itens.get(this.selecionado) : null
    item?.grupo.children.forEach((filho) => {
      if (filho.userData.aresta || !(filho as THREE.Mesh).isMesh) return
      this.contorno.add(
        new THREE.LineSegments(
          new THREE.EdgesGeometry((filho as THREE.Mesh).geometry, 30),
          new THREE.LineBasicMaterial({ color: DESTAQUE, depthTest: false }),
        ),
      )
    })
    this.desenhar()
  }

  /** Superfícies do modelo térmico (ou null para escondê-las). */
  definirSuperficies(lista: SuperficieDesenhada[] | null) {
    this.superficies.traverse((o) => {
      const malha = o as THREE.Mesh
      malha.geometry?.dispose()
      ;(malha.material as THREE.Material | undefined)?.dispose()
    })
    this.superficies.clear()
    for (const s of lista ?? []) {
      const pontos = s.vertices.map(paraTres)
      // Polígono plano: triangula na projeção 2D do próprio plano.
      const normal = new THREE.Vector3()
      for (let i = 0; i < pontos.length; i++) {
        normal.add(new THREE.Vector3().crossVectors(pontos[i]!, pontos[(i + 1) % pontos.length]!))
      }
      normal.normalize()
      const u = new THREE.Vector3().subVectors(pontos[1]!, pontos[0]!).normalize()
      const w = new THREE.Vector3().crossVectors(normal, u)
      const plano = pontos.map((p) => {
        const d = new THREE.Vector3().subVectors(p, pontos[0]!)
        return new THREE.Vector2(d.dot(u), d.dot(w))
      })
      const geometria = new THREE.BufferGeometry().setFromPoints(pontos)
      geometria.setIndex(THREE.ShapeUtils.triangulateShape(plano, []).flat())
      const malha = new THREE.Mesh(
        geometria,
        new THREE.MeshBasicMaterial({
          color: s.cor,
          transparent: true,
          opacity: s.destacada ? 0.85 : 0.5,
          side: THREE.DoubleSide,
          depthWrite: false,
          clippingPlanes: this.alturaDoCorte === null ? [] : [this.planoDeCorte],
        }),
      )
      this.superficies.add(malha)
      const borda = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(pontos),
        new THREE.LineBasicMaterial({ color: s.cor }),
      )
      this.superficies.add(borda)
    }
    this.desenhar()
  }

  /** Rótulos de texto presos ao centro de elementos (ex.: nomes dos ambientes). */
  definirRotulos(lista: { id: string; texto: string }[]) {
    this.camadaDeRotulos.replaceChildren()
    this.rotulos = []
    for (const { id, texto } of lista) {
      const item = this.itens.get(id)
      if (!item) continue
      const el = document.createElement('span')
      el.className = 'rotulo-3d'
      el.textContent = texto
      this.camadaDeRotulos.appendChild(el)
      this.rotulos.push({ el, posicao: item.caixa.getCenter(new THREE.Vector3()) })
    }
    this.desenhar()
  }

  // ---- câmera ------------------------------------------------------------------
  private caixaDe(ids?: string[]): THREE.Box3 {
    const caixa = new THREE.Box3()
    for (const [id, item] of this.itens) {
      if (ids ? ids.includes(id) : !item.ambiente) caixa.union(item.caixa)
    }
    return caixa
  }

  vista(vista: Vista) {
    const direcoes: Record<Vista, [number, number, number]> = {
      iso: [-1, 0.85, 1], // de sudoeste, olhando para nordeste
      topo: [0, 1, 0.0001],
      frente: [0, 0, 1], // fachada sul
      lado: [1, 0, 0], // fachada leste
    }
    this.enquadrar(undefined, new THREE.Vector3(...direcoes[vista]))
  }

  enquadrar(ids?: string[], direcao?: THREE.Vector3) {
    const caixa = this.caixaDe(ids)
    if (caixa.isEmpty()) return
    const esfera = caixa.getBoundingSphere(new THREE.Sphere())
    const olhar = (
      direcao ?? new THREE.Vector3().subVectors(this.camera.position, this.controles.target)
    ).normalize()
    const fov = THREE.MathUtils.degToRad(this.camera.fov)
    const menor = Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * this.camera.aspect))
    const distancia = (Math.max(esfera.radius, 0.5) / Math.sin(menor / 2)) * 1.08
    this.controles.target.copy(esfera.center)
    this.camera.position.copy(esfera.center).addScaledVector(olhar, distancia)
    this.camera.near = Math.max(distancia / 500, 0.02)
    this.camera.far = distancia * 50
    this.camera.updateProjectionMatrix()
    this.controles.update()
    this.desenhar()
  }

  /** Corte horizontal: esconde tudo acima da altura dada (null desliga). */
  corte(altura: number | null) {
    this.alturaDoCorte = altura
    this.aplicarCorte()
    this.desenhar()
  }

  private aplicarCorte() {
    const base = this.caixaDe().min.y
    this.planoDeCorte.constant = base + (this.alturaDoCorte ?? 0)
    const planos = this.alturaDoCorte === null ? [] : [this.planoDeCorte]
    for (const grupo of [this.raiz, this.superficies]) {
      grupo.traverse((o) => {
        const material = (o as THREE.Mesh).material as THREE.Material | undefined
        if (material) material.clippingPlanes = planos
      })
    }
  }

  alturaDoModelo(): number {
    const caixa = this.caixaDe()
    return caixa.isEmpty() ? 3 : caixa.max.y - caixa.min.y
  }

  tema(escuro: boolean) {
    this.escuro = escuro
    this.cena.background = new THREE.Color(escuro ? 0x12161c : 0xe9edf2)
    if (this.grade) {
      const material = this.grade.material as THREE.LineBasicMaterial
      material.color.setHex(escuro ? 0x2a3340 : 0xc5ccd6)
      material.vertexColors = false
      material.needsUpdate = true
    }
    this.desenhar()
  }

  // ---- clique ------------------------------------------------------------------
  private elementoEm(clientX: number, clientY: number): string | null {
    const area = this.renderizador.domElement.getBoundingClientRect()
    const ponto = new THREE.Vector2(
      ((clientX - area.left) / area.width) * 2 - 1,
      -((clientY - area.top) / area.height) * 2 + 1,
    )
    const raio = new THREE.Raycaster()
    raio.setFromCamera(ponto, this.camera)
    const alvos: THREE.Object3D[] = []
    for (const item of this.itens.values()) {
      if (!item.grupo.visible) continue
      item.grupo.children.forEach((filho) => {
        if ((filho as THREE.Mesh).isMesh) alvos.push(filho)
      })
    }
    for (const toque of raio.intersectObjects(alvos, false)) {
      // Ignora o que está escondido pelo corte.
      if (this.alturaDoCorte !== null && this.planoDeCorte.distanceToPoint(toque.point) < 0) {
        continue
      }
      return (toque.object.userData.id as string) ?? null
    }
    return null
  }

  /** Posição de um elemento na janela do navegador (usada nos testes de navegador). */
  posicaoNaTela(id: string): { x: number; y: number } | null {
    const item = this.itens.get(id)
    if (!item) return null
    const area = this.renderizador.domElement.getBoundingClientRect()
    const raio = new THREE.Raycaster()
    // Procura um ponto do elemento que esteja de fato visível para a câmera.
    const malhas = item.grupo.children.filter((f) => (f as THREE.Mesh).isMesh) as THREE.Mesh[]
    for (const malha of malhas) {
      const posicoes = malha.geometry.getAttribute('position')
      const indices = malha.geometry.getIndex()
      if (!indices) continue
      for (let t = 0; t < indices.count; t += 3) {
        const centro = new THREE.Vector3()
        for (let k = 0; k < 3; k++) {
          centro.add(new THREE.Vector3().fromBufferAttribute(posicoes, indices.getX(t + k)))
        }
        const tela = centro.divideScalar(3).project(this.camera)
        if (Math.abs(tela.x) > 0.98 || Math.abs(tela.y) > 0.98) continue
        const x = area.left + ((tela.x + 1) / 2) * area.width
        const y = area.top + ((1 - tela.y) / 2) * area.height
        raio.setFromCamera(new THREE.Vector2(tela.x, tela.y), this.camera)
        if (this.elementoEm(x, y) === id) return { x, y }
      }
    }
    return null
  }

  // ---- desenho -----------------------------------------------------------------
  private redimensionar() {
    const { clientWidth: largura, clientHeight: altura } = this.container
    if (!largura || !altura) return
    this.renderizador.setSize(largura, altura)
    this.camera.aspect = largura / altura
    this.camera.updateProjectionMatrix()
    this.desenhar()
  }

  /** Pede um novo desenho (no máximo um por quadro). */
  desenhar() {
    if (this.pedido) return
    this.pedido = requestAnimationFrame(() => {
      this.pedido = 0
      this.renderizador.render(this.cena, this.camera)
      const { clientWidth: largura, clientHeight: altura } = this.container
      for (const { el, posicao } of this.rotulos) {
        const p = posicao.clone().project(this.camera)
        const visivel = p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1
        el.style.display = visivel ? '' : 'none'
        el.style.transform = `translate(-50%, -50%) translate(${((p.x + 1) / 2) * largura}px, ${((1 - p.y) / 2) * altura}px)`
      }
    })
  }

  destruir() {
    cancelAnimationFrame(this.pedido)
    this.observador.disconnect()
    this.limpar()
    this.controles.dispose()
    this.renderizador.dispose()
    this.renderizador.domElement.remove()
    this.camadaDeRotulos.remove()
  }
}
