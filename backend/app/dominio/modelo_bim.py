"""Leitura do IFC: elementos, materiais, camadas, ambientes e fronteiras.

Cada valor físico carrega a sua ORIGEM:
  ifc         lido diretamente do arquivo (a fonte diz de onde);
  calculado   obtido da geometria ou de outros valores;
  manual      informado pelo usuário (só aparece nos ajustes, no front-end);
  biblioteca  valor da biblioteca técnica;
  ausente     não informado.
Nada é preenchido "por aproximação": o que o IFC não traz fica como ausente.
"""

import hashlib
import math
import re
import unicodedata
from pathlib import Path
from typing import Literal

import ifcopenshell
import ifcopenshell.geom
import ifcopenshell.util.element as ue
import ifcopenshell.util.placement
import ifcopenshell.util.shape
import ifcopenshell.util.unit
from pydantic import BaseModel

from app.dominio import geometria as geo

Origem = Literal["ifc", "calculado", "manual", "biblioteca", "estimado", "ausente"]
Categoria = Literal["parede", "piso", "cobertura", "janela", "porta", "outro"]


class Valor(BaseModel):
    valor: float | str | bool | None = None
    unidade: str | None = None
    origem: Origem = "ausente"
    fonte: str | None = None
    estimativa_id: str | None = None


class Material(BaseModel):
    id: str
    nome: str
    categoria: str | None = None
    descricao: str | None = None
    propriedades: dict[str, Valor]


class Camada(BaseModel):
    material_id: str | None
    nome: str | None = None
    espessura: Valor


class Constituinte(BaseModel):
    nome: str | None
    material_id: str | None
    categoria: str | None = None


class Construcao(BaseModel):
    id: str
    nome: str
    tipo: Literal["camadas", "constituintes", "material"]
    camadas: list[Camada] = []
    constituintes: list[Constituinte] = []
    elementos_ids: list[str] = []


class Orientacao(BaseModel):
    azimute: float | None
    rotulo: str | None
    inclinacao: float
    fonte: str


class Elemento(BaseModel):
    global_id: str
    classe: str
    categoria: Categoria
    nome: str | None = None
    descricao: str | None = None
    etiqueta: str | None = None
    tipo_predefinido: str | None = None
    tipo_construtivo: str | None = None
    pavimento_id: str | None = None
    construcao_id: str | None = None
    hospedeiro_id: str | None = None
    aberturas_ids: list[str] = []
    ambientes_ids: list[str] = []
    fronteiras_ids: list[str] = []
    externo: Valor
    condicao: Literal["exterior", "solo", "interior", "indefinida"] = "indefinida"
    dimensoes: dict[str, Valor] = {}
    orientacao: Orientacao | None = None
    envidracamento: dict[str, Valor] = {}
    conjuntos: dict[str, dict[str, float | str | bool | None]] = {}


class Ambiente(BaseModel):
    global_id: str
    numero: str | None = None
    nome: str | None = None
    pavimento_id: str | None = None
    dimensoes: dict[str, Valor] = {}
    fronteiras_ids: list[str] = []
    elementos_ids: list[str] = []
    conjuntos: dict[str, dict[str, float | str | bool | None]] = {}


class Fronteira(BaseModel):
    global_id: str
    ambiente_id: str
    elemento_id: str | None
    nivel: str | None  # "2a", "2b"...
    posicao: Literal["externa", "solo", "interna", "indefinida"]
    virtual: bool = False
    pai_id: str | None = None
    correspondente_id: str | None = None
    vertices: list[tuple[float, float, float]]
    area: float
    normal: tuple[float, float, float]
    azimute: float | None
    inclinacao: float


class Pavimento(BaseModel):
    global_id: str
    nome: str | None
    elevacao: float | None


class Diagnostico(BaseModel):
    nivel: Literal["erro", "alerta", "info"]
    codigo: str
    mensagem: str
    como_resolver: str | None = None
    alvos: list[str] = []


class Projeto(BaseModel):
    global_id: str | None = None
    nome: str | None = None
    descricao: str | None = None
    edificio: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    elevacao: float | None = None
    norte_graus: float = 0.0


class ModeloBim(BaseModel):
    esquema: str
    arquivo: str
    hash: str
    projeto: Projeto
    pavimentos: list[Pavimento]
    ambientes: list[Ambiente]
    elementos: list[Elemento]
    construcoes: list[Construcao]
    materiais: list[Material]
    fronteiras: list[Fronteira]
    diagnostico: list[Diagnostico]


# Propriedade do modelo -> (conjunto IFC, propriedade IFC, unidade)
_PROPS_MATERIAL = {
    "condutividade": ("Pset_MaterialThermal", "ThermalConductivity", "W/(m·K)"),
    "calor_especifico": ("Pset_MaterialThermal", "SpecificHeatCapacity", "J/(kg·K)"),
    "densidade": ("Pset_MaterialCommon", "MassDensity", "kg/m³"),
    "transmitancia_solar": ("Pset_MaterialOptical", "SolarTransmittance", None),
    "refletancia_solar": ("Pset_MaterialOptical", "SolarReflectanceFront", None),
    "transmitancia_visivel": ("Pset_MaterialOptical", "VisibleTransmittance", None),
    "refletancia_visivel": ("Pset_MaterialOptical", "VisibleReflectanceFront", None),
    "emissividade": ("Pset_MaterialOptical", "ThermalIrEmissivityFront", None),
}
_PROPS_VIDRO = {
    "camadas_de_vidro": ("GlassLayers", None),
    "espessura_vidro_1": ("GlassThickness1", "m"),
    "transmitancia_solar": ("SolarTransmittance", None),
    "refletancia_solar": ("SolarReflectance", None),
    "transmitancia_visivel": ("VisibleLightTransmittance", None),
    "refletancia_visivel": ("VisibleLightReflectance", None),
    "fator_solar": ("SolarHeatGainTransmittance", None),
    "transmitancia_termica_verao": ("ThermalTransmittanceSummer", "W/(m²·K)"),
    "transmitancia_termica_inverno": ("ThermalTransmittanceWinter", "W/(m²·K)"),
}
# Dimensão do modelo -> candidatos (conjunto de quantidades, quantidade, unidade)
_QUANTIDADES = {
    "comprimento": [("Length", "m")],
    "largura": [("Width", "m")],
    "altura": [("Height", "m")],
    "espessura": [("Width", "m"), ("Depth", "m")],
    "area_bruta": [("GrossSideArea", "m2"), ("GrossArea", "m2"), ("GrossFloorArea", "m2")],
    "area_liquida": [("NetSideArea", "m2"), ("NetArea", "m2"), ("Area", "m2")],
    "area_de_piso": [("NetFloorArea", "m2")],
    "volume": [("NetVolume", "m3"), ("GrossVolume", "m3")],
}
_DIMENSOES_POR_CATEGORIA = {
    "parede": ["comprimento", "altura", "espessura", "area_bruta", "area_liquida", "volume"],
    "piso": ["espessura", "area_bruta", "area_liquida", "volume"],
    "cobertura": ["espessura", "area_bruta", "area_liquida", "volume"],
    "janela": ["largura", "altura", "area_liquida"],
    "porta": ["largura", "altura", "area_liquida"],
    "outro": ["volume"],
}
_UNIDADE = {"m": "m", "m2": "m²", "m3": "m³"}


def _slug(texto: str) -> str:
    sem_acento = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", sem_acento.lower()).strip("-") or "sem-nome"


def _limpo(conjuntos: dict) -> dict:
    return {
        nome: {
            k: v
            for k, v in props.items()
            if k != "id" and isinstance(v, int | float | str | bool | None)
        }
        for nome, props in conjuntos.items()
    }


class _Leitor:
    def __init__(self, caminho: Path):
        self.caminho = caminho
        self.f = ifcopenshell.open(str(caminho))
        self.escala = {
            "m": self._escala("LENGTHUNIT"),
            "m2": self._escala("AREAUNIT"),
            "m3": self._escala("VOLUMEUNIT"),
        }
        self.diagnostico: list[Diagnostico] = []
        self.materiais: dict[str, Material] = {}
        self._material_por_id: dict[int, str] = {}
        self.construcoes: dict[str, Construcao] = {}
        self._construcao_por_id: dict[int, str] = {}
        self._geom = ifcopenshell.geom.settings()

    def _escala(self, tipo: str) -> float:
        try:
            return float(ifcopenshell.util.unit.calculate_unit_scale(self.f, tipo))
        except Exception:  # noqa: BLE001 - unidade ausente: assume SI
            return 1.0

    # -- projeto ----------------------------------------------------------------
    def projeto(self) -> Projeto:
        f = self.f
        proj = (f.by_type("IfcProject") or [None])[0]
        sitio = (f.by_type("IfcSite") or [None])[0]
        edificio = (f.by_type("IfcBuilding") or [None])[0]

        def graus(dms):
            if not dms:
                return None
            partes = list(dms) + [0, 0, 0]
            return round(partes[0] + partes[1] / 60 + partes[2] / 3600 + partes[3] / 3.6e9, 6)

        norte = 0.0
        for contexto in f.by_type("IfcGeometricRepresentationContext", include_subtypes=False):
            if contexto.TrueNorth:
                x, y = contexto.TrueNorth.DirectionRatios[:2]
                norte = round(math.degrees(math.atan2(x, y)), 4)
                break
        return Projeto(
            global_id=proj.GlobalId if proj else None,
            nome=proj.Name if proj else None,
            descricao=proj.Description if proj else None,
            edificio=edificio.Name if edificio else None,
            latitude=graus(sitio.RefLatitude) if sitio else None,
            longitude=graus(sitio.RefLongitude) if sitio else None,
            elevacao=sitio.RefElevation * self.escala["m"]
            if sitio and sitio.RefElevation is not None
            else None,
            norte_graus=norte,
        )

    # -- materiais --------------------------------------------------------------
    def material(self, mat) -> str | None:
        if mat is None:
            return None
        if mat.id() in self._material_por_id:
            return self._material_por_id[mat.id()]
        base = _slug(mat.Name or "material")
        mid, n = base, 2
        while mid in self.materiais:
            mid, n = f"{base}-{n}", n + 1
        conjuntos = ue.get_psets(mat)
        props = {}
        for chave, (pset, prop, unidade) in _PROPS_MATERIAL.items():
            bruto = conjuntos.get(pset, {}).get(prop)
            props[chave] = (
                Valor(valor=float(bruto), unidade=unidade, origem="ifc", fonte=f"{pset}.{prop}")
                if isinstance(bruto, int | float)
                else Valor(unidade=unidade)
            )
        # A absortância solar de materiais opacos é 1 - refletância (transmitância nula).
        refl, trans = props["refletancia_solar"], props["transmitancia_solar"]
        props["absortancia_solar"] = (
            Valor(
                valor=round(1 - refl.valor, 6),
                origem="calculado",
                fonte="1 − refletância solar (Pset_MaterialOptical.SolarReflectanceFront)",
            )
            if refl.valor is not None and trans.valor is None
            else Valor()
        )
        self.materiais[mid] = Material(
            id=mid,
            nome=mat.Name or "(sem nome)",
            categoria=getattr(mat, "Category", None),
            descricao=getattr(mat, "Description", None),
            propriedades=props,
        )
        self._material_por_id[mat.id()] = mid
        return mid

    def construcao(self, elemento) -> str | None:
        definicao = ue.get_material(elemento, should_skip_usage=True)
        if definicao is None:
            return None
        if definicao.id() in self._construcao_por_id:
            return self._construcao_por_id[definicao.id()]
        if definicao.is_a("IfcMaterialLayerSet"):
            nome = definicao.LayerSetName or "Composição em camadas"
            construcao = Construcao(
                id="",
                nome=nome,
                tipo="camadas",
                camadas=[
                    Camada(
                        material_id=self.material(c.Material),
                        nome=getattr(c, "Name", None) or (c.Material.Name if c.Material else None),
                        espessura=Valor(
                            valor=round(c.LayerThickness * self.escala["m"], 6),
                            unidade="m",
                            origem="ifc",
                            fonte="IfcMaterialLayer.LayerThickness",
                        ),
                    )
                    for c in definicao.MaterialLayers
                ],
            )
        elif definicao.is_a("IfcMaterialConstituentSet"):
            nome = definicao.Name or "Conjunto de constituintes"
            construcao = Construcao(
                id="",
                nome=nome,
                tipo="constituintes",
                constituintes=[
                    Constituinte(
                        nome=c.Name, material_id=self.material(c.Material), categoria=c.Category
                    )
                    for c in definicao.MaterialConstituents or []
                ],
            )
        elif definicao.is_a("IfcMaterial"):
            nome = definicao.Name or "Material"
            construcao = Construcao(
                id="",
                nome=nome,
                tipo="material",
                constituintes=[Constituinte(nome=nome, material_id=self.material(definicao))],
            )
        else:  # IfcMaterialList, perfis etc. — ainda não interpretados
            return None
        base = _slug(nome)
        cid, n = base, 2
        while cid in self.construcoes:
            cid, n = f"{base}-{n}", n + 1
        construcao.id = cid
        self.construcoes[cid] = construcao
        self._construcao_por_id[definicao.id()] = cid
        return cid

    # -- dimensões --------------------------------------------------------------
    def dimensoes(self, produto, chaves: list[str], extras: dict[str, Valor] | None = None):
        qtos = ue.get_psets(produto, qtos_only=True)
        saida: dict[str, Valor] = dict(extras or {})
        for chave in chaves:
            if chave in saida:
                continue
            for conjunto, quantidades in qtos.items():
                achado = next(
                    (
                        (q, u)
                        for q, u in _QUANTIDADES[chave]
                        if isinstance(quantidades.get(q), int | float)
                    ),
                    None,
                )
                if achado:
                    q, u = achado
                    saida[chave] = Valor(
                        valor=round(quantidades[q] * self.escala[u], 6),
                        unidade=_UNIDADE[u],
                        origem="ifc",
                        fonte=f"{conjunto}.{q}",
                    )
                    break
        if "volume" in chaves and "volume" not in saida:
            try:
                forma = ifcopenshell.geom.create_shape(self._geom, produto)
                saida["volume"] = Valor(
                    valor=round(ifcopenshell.util.shape.get_volume(forma.geometry), 6),
                    unidade="m³",
                    origem="calculado",
                    fonte="geometria do elemento",
                )
            except Exception:  # noqa: BLE001 - sem geometria utilizável
                pass
        for chave in chaves:
            saida.setdefault(chave, Valor(unidade=_UNIDADE.get(_QUANTIDADES[chave][0][1])))
        return saida

    # -- fronteiras ---------------------------------------------------------------
    def fronteiras(self, norte: float) -> list[Fronteira]:
        saida = []
        ignoradas = 0
        for rel in self.f.by_type("IfcRelSpaceBoundary"):
            espaco = rel.RelatingSpace
            if not espaco or not espaco.is_a("IfcSpace"):
                continue
            nivel2 = rel.is_a("IfcRelSpaceBoundary2ndLevel") or (rel.Name or "") == "2ndLevel"
            if not nivel2:
                continue
            vertices = self._vertices(rel, espaco)
            if vertices is None:
                ignoradas += 1
                continue
            n = geo.normal(vertices)
            pai = getattr(rel, "ParentBoundary", None)
            par = getattr(rel, "CorrespondingBoundary", None)
            posicao = {
                "EXTERNAL": "externa",
                "EXTERNAL_EARTH": "solo",
                "EXTERNAL_WATER": "externa",
                "EXTERNAL_FIRE": "externa",
                "INTERNAL": "interna",
            }.get(rel.InternalOrExternalBoundary, "indefinida")
            saida.append(
                Fronteira(
                    global_id=rel.GlobalId,
                    ambiente_id=espaco.GlobalId,
                    elemento_id=rel.RelatedBuildingElement.GlobalId
                    if rel.RelatedBuildingElement
                    else None,
                    nivel=rel.Description,
                    posicao=posicao,
                    virtual=rel.PhysicalOrVirtualBoundary == "VIRTUAL",
                    pai_id=pai.GlobalId if pai else None,
                    correspondente_id=par.GlobalId if par else None,
                    vertices=vertices,
                    area=round(geo.area(vertices), 6),
                    normal=tuple(round(c, 6) + 0.0 for c in n),
                    azimute=geo.azimute(n, norte),
                    inclinacao=geo.inclinacao(n),
                )
            )
        if ignoradas:
            self.diagnostico.append(
                Diagnostico(
                    nivel="alerta",
                    codigo="FRONTEIRA_NAO_LIDA",
                    mensagem=f"{ignoradas} fronteira(s) de espaço têm geometria que a plataforma"
                    " ainda não interpreta (só planos com contorno em polilinha).",
                    como_resolver="Exporte as fronteiras de 2º nível como superfícies planas.",
                )
            )
        return saida

    def _vertices(self, rel, espaco):
        geometria = rel.ConnectionGeometry
        if not geometria or not geometria.is_a("IfcConnectionSurfaceGeometry"):
            return None
        sup = geometria.SurfaceOnRelatingElement
        if not sup or not sup.is_a("IfcCurveBoundedPlane"):
            return None
        contorno = sup.OuterBoundary
        if not contorno.is_a("IfcPolyline"):
            return None
        pos = sup.BasisSurface.Position
        origem = pos.Location.Coordinates
        z = geo.unitario(pos.Axis.DirectionRatios) if pos.Axis else (0.0, 0.0, 1.0)
        x = geo.unitario(pos.RefDirection.DirectionRatios) if pos.RefDirection else (1.0, 0, 0)
        y = geo.vetorial(z, x)
        matriz = ifcopenshell.util.placement.get_local_placement(espaco.ObjectPlacement)
        pontos = []
        for p in contorno.Points:
            a, b = p.Coordinates[0], p.Coordinates[1]
            local = [origem[i] + a * x[i] + b * y[i] for i in range(3)]
            mundo = [
                sum(matriz[i][j] * local[j] for j in range(3)) + matriz[i][3] for i in range(3)
            ]
            pontos.append(tuple(round(c * self.escala["m"], 6) + 0.0 for c in mundo))
        if len(pontos) > 1 and pontos[0] == pontos[-1]:
            pontos.pop()
        return pontos if len(pontos) >= 3 else None

    # -- elementos ----------------------------------------------------------------
    def categoria(self, el) -> Categoria:
        tipo = getattr(el, "PredefinedType", None)
        if el.is_a("IfcWall"):
            return "parede"
        if el.is_a("IfcRoof") or (el.is_a("IfcSlab") and tipo == "ROOF"):
            return "cobertura"
        if el.is_a("IfcSlab"):
            return "piso"
        if el.is_a("IfcWindow"):
            return "janela"
        if el.is_a("IfcDoor"):
            return "porta"
        return "outro"

    def elemento(self, el, fronteiras_do_elemento: list[Fronteira]) -> Elemento:
        categoria = self.categoria(el)
        conjuntos = ue.get_psets(el, psets_only=True)
        tipo = ue.get_type(el)
        pavimento = ue.get_container(el)
        hospedeiro, aberturas = None, []
        for rel in getattr(el, "FillsVoids", []) or []:
            vazios = rel.RelatingOpeningElement.VoidsElements
            if vazios:
                hospedeiro = vazios[0].RelatingBuildingElement.GlobalId
        for rel in getattr(el, "HasOpenings", []) or []:
            for preenche in rel.RelatedOpeningElement.HasFillings or []:
                aberturas.append(preenche.RelatedBuildingElement.GlobalId)

        externo_bruto = next(
            (p["IsExternal"] for p in conjuntos.values() if isinstance(p.get("IsExternal"), bool)),
            None,
        )
        nome_pset = next((n for n, p in conjuntos.items() if "IsExternal" in p), None)
        posicoes = {f.posicao for f in fronteiras_do_elemento}
        if "solo" in posicoes:
            condicao = "solo"
        elif "externa" in posicoes:
            condicao = "exterior"
        elif posicoes == {"interna"}:
            condicao = "interior"
        elif externo_bruto is not None and not posicoes:
            condicao = "exterior" if externo_bruto else "interior"
        else:
            condicao = "indefinida"

        extras: dict[str, Valor] = {}
        if categoria in ("janela", "porta"):
            for chave, atributo in (("largura", "OverallWidth"), ("altura", "OverallHeight")):
                bruto = getattr(el, atributo, None)
                if bruto is not None:
                    extras[chave] = Valor(
                        valor=round(bruto * self.escala["m"], 6),
                        unidade="m",
                        origem="ifc",
                        fonte=f"{el.is_a()}.{atributo}",
                    )
        dimensoes = self.dimensoes(el, _DIMENSOES_POR_CATEGORIA[categoria], extras)
        construcao_id = self.construcao(el)
        if construcao_id:
            self.construcoes[construcao_id].elementos_ids.append(el.GlobalId)
            camadas = self.construcoes[construcao_id].camadas
            if camadas and dimensoes.get("espessura", Valor()).valor is None:
                dimensoes["espessura"] = Valor(
                    valor=round(sum(c.espessura.valor or 0 for c in camadas), 6),
                    unidade="m",
                    origem="calculado",
                    fonte="soma das espessuras das camadas",
                )

        orientacao = None
        externas = [f for f in fronteiras_do_elemento if f.posicao in ("externa", "solo")]
        if externas:
            maior = max(externas, key=lambda f: f.area)
            orientacao = Orientacao(
                azimute=maior.azimute,
                rotulo=geo.rotulo_orientacao(maior.azimute),
                inclinacao=maior.inclinacao,
                fonte="normal da fronteira de espaço externa (aponta para fora do ambiente)",
            )

        vidro: dict[str, Valor] = {}
        if categoria == "janela":
            bruto = conjuntos.get("Pset_DoorWindowGlazingType", {})
            for chave, (prop, unidade) in _PROPS_VIDRO.items():
                v = bruto.get(prop)
                fator = self.escala["m"] if unidade == "m" else 1
                vidro[chave] = (
                    Valor(
                        valor=round(float(v) * fator, 6),
                        unidade=unidade,
                        origem="ifc",
                        fonte=f"Pset_DoorWindowGlazingType.{prop}",
                    )
                    if isinstance(v, int | float) and not isinstance(v, bool)
                    else Valor(unidade=unidade)
                )

        return Elemento(
            global_id=el.GlobalId,
            classe=el.is_a(),
            categoria=categoria,
            nome=el.Name,
            descricao=el.Description,
            etiqueta=getattr(el, "Tag", None),
            tipo_predefinido=getattr(el, "PredefinedType", None),
            tipo_construtivo=tipo.Name if tipo else None,
            pavimento_id=pavimento.GlobalId if pavimento else None,
            construcao_id=construcao_id,
            hospedeiro_id=hospedeiro,
            aberturas_ids=aberturas,
            ambientes_ids=sorted({f.ambiente_id for f in fronteiras_do_elemento}),
            fronteiras_ids=[f.global_id for f in fronteiras_do_elemento],
            externo=Valor(valor=externo_bruto, origem="ifc", fonte=f"{nome_pset}.IsExternal")
            if externo_bruto is not None
            else Valor(),
            condicao=condicao,
            dimensoes=dimensoes,
            orientacao=orientacao,
            envidracamento=vidro,
            conjuntos=_limpo(conjuntos),
        )

    # -- modelo completo ------------------------------------------------------------
    def ler(self) -> ModeloBim:
        f = self.f
        projeto = self.projeto()
        fronteiras = self.fronteiras(projeto.norte_graus)
        por_elemento: dict[str, list[Fronteira]] = {}
        por_ambiente: dict[str, list[Fronteira]] = {}
        for fr in fronteiras:
            por_ambiente.setdefault(fr.ambiente_id, []).append(fr)
            if fr.elemento_id:
                por_elemento.setdefault(fr.elemento_id, []).append(fr)

        elementos = [
            self.elemento(el, por_elemento.get(el.GlobalId, []))
            for el in f.by_type("IfcElement")
            if not el.is_a("IfcFeatureElement") and not el.is_a("IfcVirtualElement")
        ]
        ambientes = []
        for espaco in f.by_type("IfcSpace"):
            pai = next(
                (r.RelatingObject for r in espaco.Decomposes or [] if r.is_a("IfcRelAggregates")),
                None,
            ) or ue.get_container(espaco)
            dims = self.dimensoes(espaco, ["area_de_piso", "volume", "altura"])
            meus = por_ambiente.get(espaco.GlobalId, [])
            ambientes.append(
                Ambiente(
                    global_id=espaco.GlobalId,
                    numero=espaco.Name,
                    nome=espaco.LongName or espaco.Name,
                    pavimento_id=pai.GlobalId if pai else None,
                    dimensoes=dims,
                    fronteiras_ids=[b.global_id for b in meus],
                    elementos_ids=sorted({b.elemento_id for b in meus if b.elemento_id}),
                    conjuntos=_limpo(ue.get_psets(espaco, psets_only=True)),
                )
            )
        self._diagnosticar(ambientes, elementos, fronteiras)
        return ModeloBim(
            esquema=f.schema,
            arquivo=self.caminho.name,
            hash=hashlib.sha256(self.caminho.read_bytes()).hexdigest()[:16],
            projeto=projeto,
            pavimentos=[
                Pavimento(
                    global_id=p.GlobalId,
                    nome=p.Name,
                    elevacao=p.Elevation * self.escala["m"] if p.Elevation is not None else None,
                )
                for p in f.by_type("IfcBuildingStorey")
            ],
            ambientes=ambientes,
            elementos=elementos,
            construcoes=list(self.construcoes.values()),
            materiais=list(self.materiais.values()),
            fronteiras=fronteiras,
            diagnostico=self.diagnostico,
        )

    def _diagnosticar(self, ambientes, elementos, fronteiras) -> None:
        d = self.diagnostico
        if not self.f.schema.startswith("IFC4"):
            d.append(
                Diagnostico(
                    nivel="alerta",
                    codigo="ESQUEMA",
                    mensagem=f"O arquivo está no esquema {self.f.schema}; a plataforma foi"
                    " feita para IFC4.",
                    como_resolver="No Revit, exporte com a configuração “IFC4 Reference View”"
                    " ou “IFC4 Design Transfer View”.",
                )
            )
        if not ambientes:
            d.append(
                Diagnostico(
                    nivel="erro",
                    codigo="SEM_AMBIENTES",
                    mensagem="O arquivo não tem ambientes (IfcSpace). Sem eles não é possível"
                    " definir as zonas térmicas, e a plataforma não tenta adivinhá-las.",
                    como_resolver="No Revit: crie Ambientes (Rooms) em todos os cômodos. Na"
                    " exportação IFC, em “Modificar configuração”, marque “Exportar ambientes"
                    " em vistas 3D” e escolha “Fronteiras de espaço: 2º nível”.",
                )
            )
        elif not fronteiras:
            d.append(
                Diagnostico(
                    nivel="alerta",
                    codigo="SEM_FRONTEIRAS",
                    mensagem="O arquivo tem ambientes, mas não tem fronteiras de espaço de 2º"
                    " nível. O cálculo das superfícies pela geometria dos ambientes ainda não"
                    " foi implementado.",
                    como_resolver="No Revit, na exportação IFC, escolha “Fronteiras de espaço:"
                    " 2º nível” e exporte de novo.",
                    alvos=[a.global_id for a in ambientes],
                )
            )
        envoltoria = [e for e in elementos if e.categoria != "outro"]
        sem_material = [e.global_id for e in envoltoria if not e.construcao_id]
        if sem_material:
            d.append(
                Diagnostico(
                    nivel="alerta",
                    codigo="ELEMENTO_SEM_MATERIAL",
                    mensagem=f"{len(sem_material)} elemento(s) da envoltória não têm material"
                    " nem camadas no IFC.",
                    como_resolver="Defina os materiais no modelo de origem ou escolha uma"
                    " composição da biblioteca no inspetor.",
                    alvos=sem_material,
                )
            )
        usados = {
            c.material_id
            for cons in self.construcoes.values()
            if cons.tipo == "camadas"
            for c in cons.camadas
        }
        for mat in self.materiais.values():
            if mat.id not in usados:
                continue
            faltam = [
                rotulo
                for chave, rotulo in (
                    ("condutividade", "condutividade térmica"),
                    ("densidade", "densidade"),
                    ("calor_especifico", "calor específico"),
                )
                if mat.propriedades[chave].valor is None
            ]
            if faltam:
                d.append(
                    Diagnostico(
                        nivel="alerta",
                        codigo="MATERIAL_INCOMPLETO",
                        mensagem=f"Material “{mat.nome}”: falta {', '.join(faltam)}.",
                        como_resolver="Informe o valor no inspetor (aba Parâmetros) ou aplique"
                        " um material da biblioteca.",
                        alvos=[mat.id],
                    )
                )
        sem_absortancia = [
            m.nome
            for m in self.materiais.values()
            if m.id in usados and m.propriedades["absortancia_solar"].valor is None
        ]
        if sem_absortancia:
            d.append(
                Diagnostico(
                    nivel="info",
                    codigo="ABSORTANCIA_AUSENTE",
                    mensagem="O IFC não informa a absortância solar de: "
                    + ", ".join(sem_absortancia)
                    + ". Ela será necessária para as superfícies externas.",
                    como_resolver="Informe a absortância no inspetor (aba Parâmetros).",
                )
            )
        outros = [m.nome for m in self.materiais.values() if m.id not in usados]
        sem_dados = [
            m.nome
            for m in self.materiais.values()
            if m.id not in usados and all(v.valor is None for v in m.propriedades.values())
        ]
        if sem_dados and outros:
            d.append(
                Diagnostico(
                    nivel="info",
                    codigo="MATERIAL_SEM_PROPRIEDADES",
                    mensagem="Materiais sem nenhuma propriedade térmica no IFC: "
                    + ", ".join(sem_dados)
                    + ".",
                )
            )


def ler_modelo_bim(caminho: Path) -> ModeloBim:
    """Lê um arquivo IFC e devolve o modelo de inspeção."""
    return _Leitor(Path(caminho)).ler()
