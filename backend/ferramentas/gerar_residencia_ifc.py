"""Gera o IFC4 sintético da residência de exemplo, de forma reproduzível.

Uso (na pasta backend):   uv run python -m ferramentas.gerar_residencia_ifc

Grava exemplos/ifc/residencia_exemplo.ifc e exemplos/ifc/RELATORIO.md.
Rodar duas vezes produz exatamente o mesmo arquivo (identificadores e datas
fixos). A geometria e os dados estão descritos em docs/spec/residencia-exemplo.md.

Convenções (todas em metros, origem no canto externo sudoeste, X = leste,
Y = norte, Z = para cima):
- cada parede tem o eixo X local ao longo do comprimento e o Y local apontando
  para DENTRO; as camadas do IfcMaterialLayerSet vão de fora para dentro;
- as fronteiras de espaço (IfcRelSpaceBoundary2ndLevel) ficam na face do
  ambiente, com vértices anti-horários vistos de fora do ambiente (a normal
  aponta para fora do ambiente).
"""

import json
import uuid
from dataclasses import dataclass, field
from pathlib import Path

import ifcopenshell
import ifcopenshell.guid

RAIZ = Path(__file__).resolve().parents[2]
DESTINO = RAIZ / "exemplos" / "ifc"
ARQUIVO_IFC = DESTINO / "residencia_exemplo.ifc"
BIBLIOTECA = RAIZ / "backend" / "app" / "dominio" / "dados" / "biblioteca_materiais.json"
_NS = uuid.UUID("6f1d3c52-0c0e-4a57-9a55-1fc0e11e0001")

# ----------------------------------------------------------------------------
# Dados da casa (usados também pelos testes)
# ----------------------------------------------------------------------------
LARGURA, PROFUNDIDADE = 10.0, 7.0  # dimensões externas (m)
PE_DIREITO = 2.80
E_EXT, E_INT = 0.15, 0.12  # espessura das paredes externas e internas
E_PISO, E_COB = 0.11, 0.125
X_W1 = 6.00  # face oeste da parede interna norte-sul (W1)
Y_W2 = 4.60  # face sul da parede interna leste-oeste (W2)

# Composições, de fora para dentro: (id do material na biblioteca, espessura em m)
COMPOSICOES = {
    "parede_externa": ("Parede externa de alvenaria rebocada 15 cm", [
        ("argamassa", 0.025), ("tijolo", 0.10), ("argamassa", 0.025)]),
    "parede_interna": ("Parede interna de alvenaria rebocada 12 cm", [
        ("argamassa", 0.015), ("tijolo", 0.09), ("argamassa", 0.015)]),
    "piso": ("Piso de concreto com revestimento cerâmico 11 cm", [
        ("concreto", 0.10), ("ceramica", 0.01)]),
    "cobertura": ("Laje de cobertura de concreto rebocada 12,5 cm", [
        ("concreto", 0.10), ("argamassa", 0.025)]),
}  # fmt: skip
CORES = {
    "parede_externa": (0.93, 0.90, 0.84),
    "parede_interna": (0.96, 0.95, 0.92),
    "piso": (0.70, 0.66, 0.60),
    "cobertura": (0.62, 0.36, 0.28),
    "madeira": (0.55, 0.36, 0.20),
    "caixilho": (0.85, 0.86, 0.88),
    "vidro": (0.55, 0.78, 0.92),
}


@dataclass
class Abertura:
    chave: str  # ex.: "J1"
    tipo: str  # "janela" ou "porta"
    nome: str
    a: float  # início e fim ao longo da parede, em coordenada do mundo
    b: float
    peitoril: float
    altura: float


@dataclass
class Parede:
    chave: str
    nome: str
    composicao: str
    inicio: tuple[float, float]
    direcao: tuple[int, int]  # eixo X local, no plano
    comprimento: float
    aberturas: list[Abertura] = field(default_factory=list)

    @property
    def espessura(self) -> float:
        return E_EXT if self.composicao == "parede_externa" else E_INT

    @property
    def para_dentro(self) -> tuple[int, int]:  # eixo Y local
        return (-self.direcao[1], self.direcao[0])

    def x_local(self, ab: Abertura) -> float:
        eixo = 0 if self.direcao[0] else 1
        sinal = self.direcao[eixo]
        return min(sinal * (ab.a - self.inicio[eixo]), sinal * (ab.b - self.inicio[eixo]))


PAREDES = [
    Parede("PE-S", "Parede externa sul", "parede_externa", (0.0, 0.0), (1, 0), LARGURA, [
        Abertura("P0", "porta", "Porta de entrada", 1.00, 1.90, 0.0, 2.10),
        Abertura("J5", "janela", "Janela da sala (sul)", 3.50, 5.00, 1.00, 1.20)]),
    Parede("PE-L", "Parede externa leste", "parede_externa", (LARGURA, E_EXT), (0, 1),
           PROFUNDIDADE - 2 * E_EXT, [
        Abertura("J3", "janela", "Janela do quarto (leste)", 1.50, 3.00, 1.00, 1.20)]),
    Parede("PE-N", "Parede externa norte", "parede_externa", (LARGURA, PROFUNDIDADE), (-1, 0),
           LARGURA, [
        Abertura("J1", "janela", "Janela da sala (norte)", 2.00, 4.00, 1.00, 1.20),
        Abertura("J4", "janela", "Janela do banheiro (norte)", 7.50, 8.10, 1.60, 0.60)]),
    Parede("PE-O", "Parede externa oeste", "parede_externa", (0.0, PROFUNDIDADE - E_EXT),
           (0, -1), PROFUNDIDADE - 2 * E_EXT, [
        Abertura("J2", "janela", "Janela da sala (oeste)", 2.50, 4.00, 1.00, 1.20)]),
    Parede("PI-1", "Parede interna sala / quarto e banheiro", "parede_interna",
           (X_W1 + E_INT, E_EXT), (0, 1), PROFUNDIDADE - 2 * E_EXT, [
        Abertura("P1", "porta", "Porta do quarto", 1.00, 1.80, 0.0, 2.10),
        Abertura("P2", "porta", "Porta do banheiro", 5.20, 5.90, 0.0, 2.10)]),
    Parede("PI-2", "Parede interna quarto / banheiro", "parede_interna",
           (X_W1 + E_INT, Y_W2), (1, 0), LARGURA - E_EXT - X_W1 - E_INT),
]  # fmt: skip

# Ambientes: chave -> (número, nome, x0, y0, x1, y1) — faces internas
AMBIENTES = {
    "sala": ("01", "Sala e cozinha", E_EXT, E_EXT, X_W1, PROFUNDIDADE - E_EXT),
    "quarto": ("02", "Quarto", X_W1 + E_INT, E_EXT, LARGURA - E_EXT, Y_W2),
    "banheiro": ("03", "Banheiro", X_W1 + E_INT, Y_W2 + E_INT, LARGURA - E_EXT,
                 PROFUNDIDADE - E_EXT),
}  # fmt: skip

# Faces verticais dos ambientes: (ambiente, parede, eixo fixo, valor, de, até,
# normal para fora, ambiente do outro lado ou None, aberturas na face)
FACES = [
    ("sala", "PE-S", "y", E_EXT, E_EXT, X_W1, (0, -1), None, ["P0", "J5"]),
    ("sala", "PE-O", "x", E_EXT, E_EXT, PROFUNDIDADE - E_EXT, (-1, 0), None, ["J2"]),
    ("sala", "PE-N", "y", PROFUNDIDADE - E_EXT, E_EXT, X_W1, (0, 1), None, ["J1"]),
    ("sala", "PI-1", "x", X_W1, E_EXT, Y_W2, (1, 0), "quarto", ["P1"]),
    ("sala", "PI-1", "x", X_W1, Y_W2, Y_W2 + E_INT, (1, 0), "2b", []),
    ("sala", "PI-1", "x", X_W1, Y_W2 + E_INT, PROFUNDIDADE - E_EXT, (1, 0), "banheiro", ["P2"]),
    ("quarto", "PE-S", "y", E_EXT, X_W1 + E_INT, LARGURA - E_EXT, (0, -1), None, []),
    ("quarto", "PE-L", "x", LARGURA - E_EXT, E_EXT, Y_W2, (1, 0), None, ["J3"]),
    ("quarto", "PI-2", "y", Y_W2, X_W1 + E_INT, LARGURA - E_EXT, (0, 1), "banheiro", []),
    ("quarto", "PI-1", "x", X_W1 + E_INT, E_EXT, Y_W2, (-1, 0), "sala", ["P1"]),
    ("banheiro", "PI-2", "y", Y_W2 + E_INT, X_W1 + E_INT, LARGURA - E_EXT, (0, -1), "quarto", []),
    ("banheiro", "PE-L", "x", LARGURA - E_EXT, Y_W2 + E_INT, PROFUNDIDADE - E_EXT, (1, 0), None,
     []),
    ("banheiro", "PE-N", "y", PROFUNDIDADE - E_EXT, X_W1 + E_INT, LARGURA - E_EXT, (0, 1), None,
     ["J4"]),
    ("banheiro", "PI-1", "x", X_W1 + E_INT, Y_W2 + E_INT, PROFUNDIDADE - E_EXT, (-1, 0), "sala",
     ["P2"]),
]  # fmt: skip


def gid(chave: str) -> str:
    """GlobalId estável: o mesmo nome gera sempre o mesmo identificador."""
    return ifcopenshell.guid.compress(uuid.uuid5(_NS, chave).hex)


class Gerador:
    def __init__(self):
        self.biblioteca = {
            m["id"]: m for m in json.loads(BIBLIOTECA.read_text("utf-8"))["materiais"]
        }
        self.f = ifcopenshell.file(schema="IFC4")
        cab = self.f.header
        cab.file_description.description = ("ViewDefinition [ReferenceView_V1.2]",)
        cab.file_name.name = "residencia_exemplo.ifc"
        cab.file_name.time_stamp = "2026-11-16T00:00:00"
        cab.file_name.author = ("ifc-energy",)
        cab.file_name.organization = ("ifc-energy",)
        cab.file_name.preprocessor_version = "IfcOpenShell"
        cab.file_name.originating_system = "ifc-energy gerar_residencia_ifc"
        cab.file_name.authorization = "Nenhuma"
        self.materiais: dict[str, object] = {}
        self.elementos: dict[str, object] = {}
        self.fronteiras: dict[str, object] = {}

    # -- geometria básica -----------------------------------------------------
    def ponto(self, *c):
        return self.f.createIfcCartesianPoint([float(v) for v in c])

    def direcao(self, *c):
        return self.f.createIfcDirection([float(v) for v in c])

    def eixos(self, origem=(0, 0, 0), z=(0, 0, 1), x=(1, 0, 0)):
        return self.f.createIfcAxis2Placement3D(
            self.ponto(*origem), self.direcao(*z), self.direcao(*x)
        )

    def posicao(self, relativa=None, origem=(0, 0, 0), z=(0, 0, 1), x=(1, 0, 0)):
        return self.f.createIfcLocalPlacement(relativa, self.eixos(origem, z, x))

    def caixa(self, x0, y0, z0, x1, y1, z1, cor=None, transparencia=0.0):
        """Sólido retangular por extrusão vertical de um perfil retangular."""
        perfil = self.f.createIfcRectangleProfileDef(
            "AREA", None,
            self.f.createIfcAxis2Placement2D(self.ponto((x0 + x1) / 2, (y0 + y1) / 2), None),
            float(x1 - x0), float(y1 - y0),
        )  # fmt: skip
        solido = self.f.createIfcExtrudedAreaSolid(
            perfil, self.eixos((0, 0, z0)), self.direcao(0, 0, 1), float(z1 - z0)
        )
        if cor:
            self.estilo(solido, cor, transparencia)
        return solido

    def estilo(self, item, cor, transparencia=0.0):
        nome = f"cor-{cor[0]:.2f}-{cor[1]:.2f}-{cor[2]:.2f}-{transparencia:.2f}"
        if nome not in self.materiais:
            aparencia = self.f.create_entity(
                "IfcSurfaceStyleRendering",
                SurfaceColour=self.f.createIfcColourRgb(None, *cor),
                Transparency=float(transparencia),
                ReflectanceMethod="NOTDEFINED",
            )
            self.materiais[nome] = self.f.createIfcSurfaceStyle(nome, "BOTH", [aparencia])
        self.f.createIfcStyledItem(item, [self.materiais[nome]], None)

    def forma(self, itens):
        rep = self.f.createIfcShapeRepresentation(self.corpo, "Body", "SweptSolid", itens)
        return self.f.createIfcProductDefinitionShape(None, None, [rep])

    # -- propriedades ---------------------------------------------------------
    def _propriedades(self, valores: dict):
        return [
            self.f.createIfcPropertySingleValue(nome, None, self.f.create_entity(tipo, valor), None)
            for nome, (tipo, valor) in valores.items()
        ]

    def pset(self, objetos, nome, valores: dict):
        conjunto = self.f.createIfcPropertySet(
            gid(f"pset/{nome}/{objetos[0].GlobalId}"), None, nome, None,
            self._propriedades(valores),
        )  # fmt: skip
        if objetos[0].is_a("IfcTypeObject"):
            # Em tipos, o IFC4 exige o uso do atributo HasPropertySets.
            objetos[0].HasPropertySets = [conjunto]
            return
        self.f.createIfcRelDefinesByProperties(
            gid(f"rel-pset/{nome}/{objetos[0].GlobalId}"), None, None, None, objetos, conjunto
        )

    def quantidades(self, objeto, nome, valores: dict):
        classes = {"m": "IfcQuantityLength", "m2": "IfcQuantityArea", "m3": "IfcQuantityVolume"}
        itens = [
            self.f.create_entity(classes[unidade], n, None, None, round(float(v), 6), None)
            for n, (unidade, v) in valores.items()
        ]
        conjunto = self.f.createIfcElementQuantity(
            gid(f"qto/{nome}/{objeto.GlobalId}"), None, nome, None, None, itens
        )
        self.f.createIfcRelDefinesByProperties(
            gid(f"rel-qto/{nome}/{objeto.GlobalId}"), None, None, None, [objeto], conjunto
        )

    # -- estrutura do projeto ---------------------------------------------------
    def projeto(self):
        f = self.f
        si = lambda tipo, nome, prefixo=None: f.createIfcSIUnit(None, tipo, prefixo, nome)  # noqa: E731
        metro, quilo = si("LENGTHUNIT", "METRE"), si("MASSUNIT", "GRAM", "KILO")
        kelvin = si("THERMODYNAMICTEMPERATUREUNIT", "KELVIN")
        watt, joule = si("POWERUNIT", "WATT"), si("ENERGYUNIT", "JOULE")

        def derivada(tipo, *partes):
            return f.createIfcDerivedUnit(
                [f.createIfcDerivedUnitElement(u, e) for u, e in partes], tipo, None
            )

        unidades = f.createIfcUnitAssignment([
            metro, si("AREAUNIT", "SQUARE_METRE"), si("VOLUMEUNIT", "CUBIC_METRE"),
            si("PLANEANGLEUNIT", "RADIAN"), quilo, si("TIMEUNIT", "SECOND"), kelvin, watt, joule,
            derivada("THERMALCONDUCTANCEUNIT", (watt, 1), (metro, -1), (kelvin, -1)),
            derivada("THERMALTRANSMITTANCEUNIT", (watt, 1), (metro, -2), (kelvin, -1)),
            derivada("SPECIFICHEATCAPACITYUNIT", (joule, 1), (quilo, -1), (kelvin, -1)),
            derivada("MASSDENSITYUNIT", (quilo, 1), (metro, -3)),
        ])  # fmt: skip
        contexto = f.createIfcGeometricRepresentationContext(
            None, "Model", 3, 1.0e-5, self.eixos(), self.direcao(0, 1)
        )
        self.corpo = f.createIfcGeometricRepresentationSubContext(
            "Body", "Model", None, None, None, None, contexto, None, "MODEL_VIEW", None
        )
        projeto = f.createIfcProject(
            gid("projeto"), None, "Residência de exemplo ifc-energy",
            "Modelo didático sintético para testar o ifc-energy. Não comprova atendimento a"
            " normas.", None, None, None, [contexto], unidades,
        )  # fmt: skip
        sitio = f.create_entity(
            "IfcSite", GlobalId=gid("sitio"), Name="Terreno", ObjectPlacement=self.posicao(),
            CompositionType="ELEMENT",
            # São Paulo, SP — localização didática, escolhida só para o exemplo.
            RefLatitude=(-23, -32, -51, 0), RefLongitude=(-46, -38, -10, 0), RefElevation=760.0,
        )  # fmt: skip
        edificio = f.create_entity(
            "IfcBuilding", GlobalId=gid("edificio"), Name="Residência térrea",
            ObjectPlacement=self.posicao(sitio.ObjectPlacement), CompositionType="ELEMENT",
        )  # fmt: skip
        self.pavimento = f.create_entity(
            "IfcBuildingStorey", GlobalId=gid("pavimento"), Name="Térreo",
            ObjectPlacement=self.posicao(edificio.ObjectPlacement), CompositionType="ELEMENT",
            Elevation=0.0,
        )  # fmt: skip
        for chave, pai, filhos in (
            ("proj", projeto, [sitio]), ("sitio", sitio, [edificio]),
            ("edif", edificio, [self.pavimento]),
        ):  # fmt: skip
            f.createIfcRelAggregates(gid(f"agrega/{chave}"), None, None, None, pai, filhos)

    # -- materiais e composições ----------------------------------------------
    def material(self, mid: str):
        if mid in self.materiais:
            return self.materiais[mid]
        dados = self.biblioteca[mid]
        mat = self.f.createIfcMaterial(dados["nome"], dados["descricao"], dados["categoria"])
        termicas, comuns, opticas = {}, {}, {}
        if dados.get("condutividade") is not None:
            termicas["ThermalConductivity"] = ("IfcThermalConductivityMeasure",
                                               dados["condutividade"])  # fmt: skip
        if dados.get("calor_especifico") is not None:
            termicas["SpecificHeatCapacity"] = ("IfcSpecificHeatCapacityMeasure",
                                                dados["calor_especifico"])  # fmt: skip
        if dados.get("densidade") is not None:
            comuns["MassDensity"] = ("IfcMassDensityMeasure", dados["densidade"])
        for origem, destino in (
            ("transmitancia_solar", "SolarTransmittance"),
            ("refletancia_solar", "SolarReflectanceFront"),
            ("transmitancia_visivel", "VisibleTransmittance"),
            ("refletancia_visivel", "VisibleReflectanceFront"),
            ("emissividade", "ThermalIrEmissivityFront"),
        ):
            if dados.get(origem) is not None:
                opticas[destino] = ("IfcPositiveRatioMeasure", dados[origem])
        for nome, valores in (
            ("Pset_MaterialThermal", termicas), ("Pset_MaterialCommon", comuns),
            ("Pset_MaterialOptical", opticas),
        ):  # fmt: skip
            if valores:
                self.f.createIfcMaterialProperties(nome, None, self._propriedades(valores), mat)
        self.materiais[mid] = mat
        return mat

    def composicao(self, chave: str):
        nome, camadas = COMPOSICOES[chave]
        itens = [
            self.f.create_entity(
                "IfcMaterialLayer",
                Material=self.material(mid),
                LayerThickness=float(esp),
                IsVentilated=False,
                Name=self.biblioteca[mid]["nome"],
            )  # fmt: skip
            for mid, esp in camadas
        ]
        return self.f.createIfcMaterialLayerSet(itens, nome, None)

    def associar(self, chave, objetos, material):
        self.f.createIfcRelAssociatesMaterial(
            gid(f"material/{chave}"), None, None, None, objetos, material
        )

    def tipo(self, classe, chave, nome, ocorrencias, **extra):
        tipo = self.f.create_entity(classe, GlobalId=gid(f"tipo/{chave}"), Name=nome, **extra)
        self.f.createIfcRelDefinesByType(
            gid(f"rel-tipo/{chave}"), None, None, None, ocorrencias, tipo
        )
        return tipo

    # -- elementos construtivos -------------------------------------------------
    def paredes(self):
        f = self.f
        por_composicao = {"parede_externa": [], "parede_interna": []}
        janelas, portas = [], []
        for p in PAREDES:
            local = self.posicao(
                self.pavimento.ObjectPlacement, (*p.inicio, 0.0), x=(*p.direcao, 0)
            )
            corpo = self.caixa(0, 0, 0, p.comprimento, p.espessura, PE_DIREITO, CORES[p.composicao])
            parede = f.create_entity(
                "IfcWall", GlobalId=gid(f"parede/{p.chave}"), Name=p.nome, Tag=p.chave,
                ObjectPlacement=local, Representation=self.forma([corpo]),
                PredefinedType="SOLIDWALL",
            )  # fmt: skip
            self.elementos[p.chave] = parede
            por_composicao[p.composicao].append(parede)
            externa = p.composicao == "parede_externa"
            self.pset([parede], "Pset_WallCommon", {
                "IsExternal": ("IfcBoolean", externa), "LoadBearing": ("IfcBoolean", False)})  # fmt: skip
            bruta = p.comprimento * PE_DIREITO
            vazios = sum(abs(a.b - a.a) * a.altura for a in p.aberturas)
            self.quantidades(parede, "Qto_WallBaseQuantities", {
                "Length": ("m", p.comprimento), "Width": ("m", p.espessura),
                "Height": ("m", PE_DIREITO), "GrossSideArea": ("m2", bruta),
                "NetSideArea": ("m2", bruta - vazios),
                "GrossVolume": ("m3", bruta * p.espessura),
                "NetVolume": ("m3", (bruta - vazios) * p.espessura)})  # fmt: skip
            for ab in p.aberturas:
                largura, x0 = abs(ab.b - ab.a), p.x_local(ab)
                pos_vao = self.posicao(local, (x0, 0.0, ab.peitoril))
                vao = f.create_entity(
                    "IfcOpeningElement", GlobalId=gid(f"vao/{ab.chave}"), Name=f"Vão {ab.chave}",
                    ObjectPlacement=pos_vao, PredefinedType="OPENING",
                    Representation=self.forma(
                        [self.caixa(0, -0.05, 0, largura, p.espessura + 0.05, ab.altura)]),
                )  # fmt: skip
                f.createIfcRelVoidsElement(gid(f"vazio/{ab.chave}"), None, None, None, parede, vao)
                meio = p.espessura / 2
                if ab.tipo == "janela":
                    m, c = 0.05, CORES["caixilho"]  # largura do montante do caixilho
                    itens = [
                        self.caixa(0, meio - 0.03, 0, largura, meio + 0.03, m, c),
                        self.caixa(0, meio - 0.03, ab.altura - m, largura, meio + 0.03, ab.altura, c),
                        self.caixa(0, meio - 0.03, m, m, meio + 0.03, ab.altura - m, c),
                        self.caixa(largura - m, meio - 0.03, m, largura, meio + 0.03, ab.altura - m, c),
                        self.caixa(m, meio - 0.0015, m, largura - m, meio + 0.0015, ab.altura - m,
                                   CORES["vidro"], 0.6),
                    ]  # fmt: skip
                    elemento = f.create_entity(
                        "IfcWindow", GlobalId=gid(f"janela/{ab.chave}"), Name=ab.nome, Tag=ab.chave,
                        ObjectPlacement=self.posicao(pos_vao), Representation=self.forma(itens),
                        OverallHeight=ab.altura, OverallWidth=largura, PredefinedType="WINDOW",
                        PartitioningType="SINGLE_PANEL",
                    )  # fmt: skip
                    janelas.append(elemento)
                    self.pset([elemento], "Pset_WindowCommon", {"IsExternal": ("IfcBoolean", True)})
                    self.quantidades(elemento, "Qto_WindowBaseQuantities", {
                        "Width": ("m", largura), "Height": ("m", ab.altura),
                        "Area": ("m2", largura * ab.altura)})  # fmt: skip
                else:
                    folha = self.caixa(0, meio - 0.0175, 0, largura, meio + 0.0175, ab.altura,
                                       CORES["madeira"])  # fmt: skip
                    elemento = f.create_entity(
                        "IfcDoor", GlobalId=gid(f"porta/{ab.chave}"), Name=ab.nome, Tag=ab.chave,
                        ObjectPlacement=self.posicao(pos_vao), Representation=self.forma([folha]),
                        OverallHeight=ab.altura, OverallWidth=largura, PredefinedType="DOOR",
                        OperationType="SINGLE_SWING_LEFT",
                    )  # fmt: skip
                    portas.append(elemento)
                    self.pset(
                        [elemento], "Pset_DoorCommon", {"IsExternal": ("IfcBoolean", externa)}
                    )
                    self.quantidades(elemento, "Qto_DoorBaseQuantities", {
                        "Width": ("m", largura), "Height": ("m", ab.altura),
                        "Area": ("m2", largura * ab.altura)})  # fmt: skip
                self.elementos[ab.chave] = elemento
                f.createIfcRelFillsElement(
                    gid(f"preenche/{ab.chave}"), None, None, None, vao, elemento
                )
        for chave, ocorrencias in por_composicao.items():
            conjunto = self.composicao(chave)
            tipo = self.tipo("IfcWallType", chave, COMPOSICOES[chave][0], ocorrencias,
                             PredefinedType="SOLIDWALL")  # fmt: skip
            self.associar(f"tipo/{chave}", [tipo], conjunto)
            for parede in ocorrencias:
                uso = f.createIfcMaterialLayerSetUsage(conjunto, "AXIS2", "POSITIVE", 0.0, None)
                self.associar(f"uso/{parede.GlobalId}", [parede], uso)

        # Janelas: vidro simples + caixilho (constituintes); portas: madeira maciça.
        vidro, caixilho = self.material("vidro_3mm"), self.material("aluminio")
        constituintes = f.createIfcMaterialConstituentSet(
            "Janela de alumínio com vidro simples 3 mm", None,
            [f.createIfcMaterialConstituent("Vidro", None, vidro, None, "Envidraçamento"),
             f.createIfcMaterialConstituent("Caixilho", None, caixilho, None, "Esquadria")],
        )  # fmt: skip
        tipo_janela = self.tipo(
            "IfcWindowType", "janela", "Janela de alumínio com vidro simples 3 mm", janelas,
            PredefinedType="WINDOW", PartitioningType="SINGLE_PANEL",
        )  # fmt: skip
        self.associar("janelas", [tipo_janela, *janelas], constituintes)
        v = self.biblioteca["vidro_3mm"]
        self.pset([tipo_janela], "Pset_DoorWindowGlazingType", {
            "GlassLayers": ("IfcCountMeasure", 1),
            "GlassThickness1": ("IfcPositiveLengthMeasure", v["espessura"]),
            "SolarTransmittance": ("IfcNormalisedRatioMeasure", v["transmitancia_solar"]),
            "SolarReflectance": ("IfcNormalisedRatioMeasure", v["refletancia_solar"]),
            "VisibleLightTransmittance": ("IfcNormalisedRatioMeasure", v["transmitancia_visivel"]),
            "VisibleLightReflectance": ("IfcNormalisedRatioMeasure", v["refletancia_visivel"]),
        })  # fmt: skip
        tipo_porta = self.tipo("IfcDoorType", "porta", "Porta de madeira 3,5 cm", portas,
                               PredefinedType="DOOR", OperationType="SINGLE_SWING_LEFT")  # fmt: skip
        madeira = f.createIfcMaterialLayerSet(
            [f.create_entity("IfcMaterialLayer", Material=self.material("madeira"),
                             LayerThickness=0.035, IsVentilated=False, Name="Madeira")],
            "Porta de madeira 3,5 cm", None,
        )  # fmt: skip
        self.associar("portas", [tipo_porta, *portas], madeira)
        return [*por_composicao["parede_externa"], *por_composicao["parede_interna"],
                *janelas, *portas]  # fmt: skip

    def lajes(self):
        f = self.f
        saida = []
        for chave, nome, z0, z1, tipo_ifc in (
            ("piso", "Piso térreo", -E_PISO, 0.0, "BASESLAB"),
            ("cobertura", "Laje de cobertura", PE_DIREITO, PE_DIREITO + E_COB, "ROOF"),
        ):
            laje = f.create_entity(
                "IfcSlab", GlobalId=gid(f"laje/{chave}"), Name=nome, Tag=chave.upper(),
                ObjectPlacement=self.posicao(self.pavimento.ObjectPlacement),
                Representation=self.forma(
                    [self.caixa(0, 0, z0, LARGURA, PROFUNDIDADE, z1, CORES[chave])]),
                PredefinedType=tipo_ifc,
            )  # fmt: skip
            self.elementos[chave] = laje
            conjunto = self.composicao(chave)
            tipo = self.tipo("IfcSlabType", chave, COMPOSICOES[chave][0], [laje],
                             PredefinedType=tipo_ifc)  # fmt: skip
            self.associar(f"tipo/{chave}", [tipo], conjunto)
            # No piso as camadas sobem (fora = solo); na cobertura descem (fora = céu).
            sentido = "POSITIVE" if chave == "piso" else "NEGATIVE"
            uso = f.createIfcMaterialLayerSetUsage(conjunto, "AXIS3", sentido, 0.0, None)
            self.associar(f"uso/{chave}", [laje], uso)
            self.pset([laje], "Pset_SlabCommon", {"IsExternal": ("IfcBoolean", True)})
            area = LARGURA * PROFUNDIDADE
            self.quantidades(laje, "Qto_SlabBaseQuantities", {
                "Depth": ("m", z1 - z0), "GrossArea": ("m2", area), "NetArea": ("m2", area),
                "GrossVolume": ("m3", area * (z1 - z0))})  # fmt: skip
            saida.append(laje)
        return saida

    # -- ambientes e fronteiras -------------------------------------------------
    def ambientes(self):
        f = self.f
        self.espacos = {}
        for chave, (numero, nome, x0, y0, x1, y1) in AMBIENTES.items():
            espaco = f.create_entity(
                "IfcSpace", GlobalId=gid(f"ambiente/{chave}"), Name=numero, LongName=nome,
                ObjectPlacement=self.posicao(self.pavimento.ObjectPlacement),
                Representation=self.forma([self.caixa(x0, y0, 0, x1, y1, PE_DIREITO)]),
                CompositionType="ELEMENT", PredefinedType="INTERNAL",
            )  # fmt: skip
            area = (x1 - x0) * (y1 - y0)
            self.quantidades(espaco, "Qto_SpaceBaseQuantities", {
                "Height": ("m", PE_DIREITO), "NetFloorArea": ("m2", area),
                "GrossFloorArea": ("m2", area), "NetVolume": ("m3", area * PE_DIREITO)})  # fmt: skip
            self.espacos[chave] = espaco
        f.createIfcRelAggregates(
            gid("agrega/pav"), None, None, None, self.pavimento, list(self.espacos.values())
        )

    def fronteira(self, chave, ambiente, elemento, vertices, normal, tipo, externa, pai=None):
        """Cria um IfcRelSpaceBoundary2ndLevel com geometria plana."""
        f = self.f
        if _normal(vertices) != tuple(float(n) for n in normal):
            vertices = vertices[::-1]
        origem, u = vertices[0], _unitario(_sub(vertices[1], vertices[0]))
        v = _vetorial(normal, u)
        plano = f.createIfcPlane(self.eixos(origem, normal, u))
        pontos2d = [(_escalar(_sub(p, origem), u), _escalar(_sub(p, origem), v)) for p in vertices]
        contorno = f.createIfcPolyline(
            [self.ponto(round(a, 6), round(b, 6)) for a, b in [*pontos2d, pontos2d[0]]]
        )
        geometria = f.createIfcConnectionSurfaceGeometry(
            f.createIfcCurveBoundedPlane(plano, contorno, []), None
        )
        rel = f.create_entity(
            "IfcRelSpaceBoundary2ndLevel", GlobalId=gid(f"fronteira/{chave}"), Name="2ndLevel",
            Description=tipo, RelatingSpace=self.espacos[ambiente],
            RelatedBuildingElement=elemento, ConnectionGeometry=geometria,
            PhysicalOrVirtualBoundary="PHYSICAL", InternalOrExternalBoundary=externa,
            ParentBoundary=pai,
        )  # fmt: skip
        self.fronteiras[chave] = rel
        return rel

    def fronteiras_dos_ambientes(self):
        aberturas = {a.chave: a for p in PAREDES for a in p.aberturas}
        for amb, parede, eixo, valor, de, ate, normal, outro, vaos in FACES:

            def retangulo(a, b, z0, z1, eixo=eixo, valor=valor):
                if eixo == "y":
                    return [(a, valor, z0), (b, valor, z0), (b, valor, z1), (a, valor, z1)]
                return [(valor, a, z0), (valor, b, z0), (valor, b, z1), (valor, a, z1)]

            n3 = (*normal, 0)
            chave = f"{amb}/{parede}/{de:.2f}"
            tipo = "2b" if outro == "2b" else "2a"
            externa = "EXTERNAL" if outro is None else "INTERNAL"
            mae = self.fronteira(chave, amb, self.elementos[parede],
                                 retangulo(de, ate, 0, PE_DIREITO), n3, tipo, externa)  # fmt: skip
            for nome in vaos:
                ab = aberturas[nome]
                self.fronteira(
                    f"{amb}/{nome}", amb, self.elementos[nome],
                    retangulo(ab.a, ab.b, ab.peitoril, ab.peitoril + ab.altura), n3, "2a", externa,
                    pai=mae,
                )  # fmt: skip
        for amb, (_, _, x0, y0, x1, y1) in AMBIENTES.items():
            base = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
            self.fronteira(f"{amb}/piso", amb, self.elementos["piso"],
                           [(x, y, 0.0) for x, y in base], (0, 0, -1), "2a", "EXTERNAL_EARTH")  # fmt: skip
            self.fronteira(f"{amb}/cobertura", amb, self.elementos["cobertura"],
                           [(x, y, PE_DIREITO) for x, y in base], (0, 0, 1), "2a", "EXTERNAL")  # fmt: skip
        # Pares: a mesma parede interna (ou porta) vista dos dois ambientes.
        for amb, parede, _eixo, _valor, de, _ate, _n, outro, vaos in FACES:
            if outro in (None, "2b"):
                continue
            par = next(
                f"{a}/{p}/{d:.2f}" for a, p, _e, _v, d, _t, _n2, o, _vs in FACES
                if a == outro and p == parede and o == amb
            )  # fmt: skip
            self.fronteiras[f"{amb}/{parede}/{de:.2f}"].CorrespondingBoundary = self.fronteiras[par]
            for nome in vaos:
                self.fronteiras[f"{amb}/{nome}"].CorrespondingBoundary = self.fronteiras[
                    f"{outro}/{nome}"
                ]

    def gerar(self):
        self.projeto()
        elementos = [*self.paredes(), *self.lajes()]
        self.ambientes()
        self.fronteiras_dos_ambientes()
        self.f.createIfcRelContainedInSpatialStructure(
            gid("contem/pavimento"), None, None, None, elementos, self.pavimento
        )
        return self.f


def _sub(a, b):
    return tuple(x - y for x, y in zip(a, b, strict=True))


def _escalar(a, b):
    return sum(x * y for x, y in zip(a, b, strict=True))


def _vetorial(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _unitario(a):
    tamanho = _escalar(a, a) ** 0.5
    return tuple(round(x / tamanho, 9) for x in a)


def _normal(vertices):
    """Normal unitária de um polígono plano (regra da mão direita)."""
    n = (0.0, 0.0, 0.0)
    for i, p in enumerate(vertices):
        q = vertices[(i + 1) % len(vertices)]
        n = tuple(a + b for a, b in zip(n, _vetorial(p, q), strict=True))
    return tuple(round(x) + 0.0 for x in _unitario(n))


def relatorio(f) -> str:
    """Resumo das entidades do arquivo, gravado em exemplos/ifc/RELATORIO.md."""
    classes = ["IfcProject", "IfcSite", "IfcBuilding", "IfcBuildingStorey", "IfcSpace", "IfcWall",
               "IfcSlab", "IfcWindow", "IfcDoor", "IfcOpeningElement", "IfcWallType",
               "IfcSlabType", "IfcWindowType", "IfcDoorType", "IfcMaterial",
               "IfcMaterialLayerSet", "IfcMaterialConstituentSet", "IfcMaterialProperties",
               "IfcPropertySet", "IfcElementQuantity", "IfcRelSpaceBoundary2ndLevel"]  # fmt: skip
    linhas = [
        "# Relatório do IFC de exemplo", "",
        "Gerado por `backend/ferramentas/gerar_residencia_ifc.py`. Não editar à mão.", "",
        f"- Esquema: {f.schema}", f"- Total de entidades: {len(list(f))}", "",
        "## Entidades por classe", "", "| Classe | Quantidade |", "|---|---|",
        *[f"| {c} | {len(f.by_type(c))} |" for c in classes], "",
        "## Ambientes", "", "| Nº | Nome | Área (m²) | Volume (m³) | GlobalId |", "|---|---|---|---|---|",
    ]  # fmt: skip
    for _chave, (numero, nome, x0, y0, x1, y1) in AMBIENTES.items():
        area = (x1 - x0) * (y1 - y0)
        espaco = next(s for s in f.by_type("IfcSpace") if s.Name == numero)
        linhas.append(f"| {numero} | {nome} | {area:.4f} | {area * PE_DIREITO:.4f} |"
                      f" `{espaco.GlobalId}` |")  # fmt: skip
    linhas += ["", "## Composições (camadas de fora para dentro)", ""]
    biblioteca = {m["id"]: m for m in json.loads(BIBLIOTECA.read_text("utf-8"))["materiais"]}
    for nome, camadas in COMPOSICOES.values():
        linhas += [f"**{nome}**", ""]
        linhas += [f"{i}. {biblioteca[m]['nome']} — {e * 100:g} cm" for i, (m, e) in
                   enumerate(camadas, 1)]  # fmt: skip
        linhas.append("")
    linhas += ["## Elementos", "", "| Classe | Etiqueta | Nome | GlobalId |", "|---|---|---|---|"]
    for classe in ("IfcWall", "IfcSlab", "IfcWindow", "IfcDoor"):
        linhas += [f"| {classe} | {e.Tag} | {e.Name} | `{e.GlobalId}` |" for e in f.by_type(classe)]
    fronteiras = f.by_type("IfcRelSpaceBoundary2ndLevel")
    linhas += [
        "", "## Fronteiras de espaço (2º nível)", "",
        f"- Total: {len(fronteiras)}",
        *[f"- {rotulo}: {sum(1 for b in fronteiras if b.InternalOrExternalBoundary == valor)}"
          for rotulo, valor in (("Externas (ar)", "EXTERNAL"), ("Externas (solo)", "EXTERNAL_EARTH"),
                                ("Internas", "INTERNAL"))],
        f"- Com fronteira correspondente (pares): "
        f"{sum(1 for b in fronteiras if b.CorrespondingBoundary)}",
        f"- Aberturas (com fronteira-mãe): {sum(1 for b in fronteiras if b.ParentBoundary)}", "",
    ]  # fmt: skip
    return "\n".join(linhas)


def main() -> None:
    f = Gerador().gerar()
    DESTINO.mkdir(parents=True, exist_ok=True)
    f.write(str(ARQUIVO_IFC))
    (DESTINO / "RELATORIO.md").write_text(relatorio(f), encoding="utf-8", newline="\n")
    print(f"Gravado: {ARQUIVO_IFC} ({ARQUIVO_IFC.stat().st_size / 1024:.0f} kB)")


if __name__ == "__main__":
    main()
