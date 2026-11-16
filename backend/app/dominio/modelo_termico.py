"""Modelo térmico intermediário: zonas, superfícies e aberturas, com a origem
(GlobalId) de cada item, a lista de suposições e as checagens automáticas.

É montado SOMENTE a partir das fronteiras de espaço de 2º nível do IFC. A
montagem pela geometria dos ambientes (IFC sem fronteiras) e a conversão para
epJSON ainda não foram implementadas — o campo ``prontidao`` diz isso.
"""

from typing import Literal

from pydantic import BaseModel

from app.dominio import geometria as geo
from app.dominio.modelo_bim import ModeloBim

Condicao = Literal["exterior", "solo", "zona", "adiabatica"]


class Abertura(BaseModel):
    id: str
    tipo: Literal["janela", "porta", "outro"]
    superficie_id: str
    elemento_id: str | None
    fronteira_id: str
    construcao_id: str | None
    vertices: list[tuple[float, float, float]]
    area: float


class Superficie(BaseModel):
    id: str
    zona_id: str
    tipo: Literal["parede", "piso", "cobertura"]
    condicao: Condicao
    zona_vizinha_id: str | None = None
    par_id: str | None = None
    elemento_id: str | None
    fronteira_id: str
    construcao_id: str | None
    vertices: list[tuple[float, float, float]]
    area_bruta: float
    area_liquida: float
    azimute: float | None
    inclinacao: float
    aberturas_ids: list[str] = []


class Zona(BaseModel):
    id: str
    nome: str | None
    ambiente_id: str
    area_de_piso: float | None
    volume_ifc: float | None
    volume_calculado: float | None
    superficies_ids: list[str]


class Checagem(BaseModel):
    codigo: str
    nome: str
    ok: bool
    detalhe: str
    alvos: list[str] = []


class EtapaProntidao(BaseModel):
    codigo: str
    nome: str
    estado: Literal["ok", "pendente", "erro", "nao_implementado"]
    detalhe: str


class ModeloTermico(BaseModel):
    zonas: list[Zona]
    superficies: list[Superficie]
    aberturas: list[Abertura]
    suposicoes: list[str]
    checagens: list[Checagem]
    prontidao: list[EtapaProntidao]


def _tipo_de_superficie(inclinacao: float) -> Literal["parede", "piso", "cobertura"]:
    if inclinacao < 60:
        return "cobertura"
    return "piso" if inclinacao > 120 else "parede"


def montar_modelo_termico(bim: ModeloBim) -> ModeloTermico:
    elementos = {e.global_id: e for e in bim.elementos}
    fronteiras = {f.global_id: f for f in bim.fronteiras}
    suposicoes: list[str] = []
    superficies: dict[str, Superficie] = {}
    aberturas: list[Abertura] = []
    zonas: list[Zona] = []
    id_da_zona = {a.global_id: f"Z{i}" for i, a in enumerate(bim.ambientes, 1)}

    for ambiente in bim.ambientes:
        zid = id_da_zona[ambiente.global_id]
        maes = [fronteiras[i] for i in ambiente.fronteiras_ids if not fronteiras[i].pai_id]
        ids = []
        for n, fr in enumerate(maes, 1):
            elemento = elementos.get(fr.elemento_id) if fr.elemento_id else None
            par = fronteiras.get(fr.correspondente_id) if fr.correspondente_id else None
            if fr.posicao == "externa":
                condicao: Condicao = "exterior"
            elif fr.posicao == "solo":
                condicao = "solo"
            elif fr.posicao == "interna" and par and par.ambiente_id in id_da_zona:
                condicao = "zona"
            else:
                condicao = "adiabatica"
                suposicoes.append(
                    f"Superfície {zid}-S{n} ({elemento.nome if elemento else 'sem elemento'}):"
                    " fronteira interna sem ambiente do outro lado (tipo "
                    f"{fr.nivel or 'não informado'}); tratada como adiabática."
                )
            sid = f"{zid}-S{n}"
            superficies[fr.global_id] = Superficie(
                id=sid,
                zona_id=zid,
                tipo=_tipo_de_superficie(fr.inclinacao),
                condicao=condicao,
                zona_vizinha_id=id_da_zona[par.ambiente_id] if condicao == "zona" else None,
                elemento_id=fr.elemento_id,
                fronteira_id=fr.global_id,
                construcao_id=elemento.construcao_id if elemento else None,
                vertices=fr.vertices,
                area_bruta=fr.area,
                area_liquida=fr.area,
                azimute=fr.azimute,
                inclinacao=fr.inclinacao,
            )
            ids.append(sid)
        poligonos = [f.vertices for f in maes]
        zonas.append(
            Zona(
                id=zid,
                nome=ambiente.nome,
                ambiente_id=ambiente.global_id,
                area_de_piso=ambiente.dimensoes["area_de_piso"].valor,
                volume_ifc=ambiente.dimensoes["volume"].valor,
                volume_calculado=round(geo.volume_fechado(poligonos), 4) if poligonos else None,
                superficies_ids=ids,
            )
        )

    for sup in superficies.values():  # liga os pares entre zonas
        par = fronteiras[sup.fronteira_id].correspondente_id
        if sup.condicao == "zona" and par in superficies:
            sup.par_id = superficies[par].id

    for fr in bim.fronteiras:
        if not fr.pai_id or fr.pai_id not in superficies:
            continue
        mae = superficies[fr.pai_id]
        elemento = elementos.get(fr.elemento_id) if fr.elemento_id else None
        categoria = elemento.categoria if elemento else "outro"
        aid = f"{mae.id}-A{len(mae.aberturas_ids) + 1}"
        aberturas.append(
            Abertura(
                id=aid,
                tipo=categoria if categoria in ("janela", "porta") else "outro",
                superficie_id=mae.id,
                elemento_id=fr.elemento_id,
                fronteira_id=fr.global_id,
                construcao_id=elemento.construcao_id if elemento else None,
                vertices=fr.vertices,
                area=fr.area,
            )
        )
        mae.aberturas_ids.append(aid)
        mae.area_liquida = round(mae.area_liquida - fr.area, 6)

    if bim.fronteiras:
        suposicoes.insert(
            0,
            "As superfícies ficam na face interna dos elementos (posição das fronteiras de"
            " espaço do IFC); a espessura das paredes não entra no volume das zonas.",
        )
    lista = list(superficies.values())
    checagens = _checar(bim, zonas, lista, aberturas)
    return ModeloTermico(
        zonas=zonas,
        superficies=lista,
        aberturas=aberturas,
        suposicoes=suposicoes,
        checagens=checagens,
        prontidao=_prontidao(bim, checagens),
    )


def _checar(bim, zonas, superficies, aberturas) -> list[Checagem]:
    por_id = {s.id: s for s in superficies}
    saida = []

    ruins, detalhes = [], []
    for z in zonas:
        if z.volume_ifc and z.volume_calculado is not None:
            desvio = abs(z.volume_calculado - z.volume_ifc) / z.volume_ifc
            detalhes.append(f"{z.nome}: {z.volume_calculado:.2f} m³ × {z.volume_ifc:.2f} m³ do IFC")
            if desvio > 0.01:
                ruins.append(z.ambiente_id)
        else:
            ruins.append(z.ambiente_id)
            detalhes.append(f"{z.nome}: sem volume para comparar")
    saida.append(
        Checagem(
            codigo="VOLUME",
            nome="Volume da zona confere com o IfcSpace (tolerância de 1%)",
            ok=bool(zonas) and not ruins,
            detalhe="; ".join(detalhes) or "Não há zonas.",
            alvos=ruins,
        )
    )

    abertas = {
        z.ambiente_id: geo.arestas_abertas([por_id[i].vertices for i in z.superficies_ids])
        for z in zonas
    }
    ruins = [a for a, n in abertas.items() if n]
    saida.append(
        Checagem(
            codigo="FECHADA",
            nome="Zonas fechadas (toda aresta é compartilhada por duas superfícies)",
            ok=bool(zonas) and not ruins,
            detalhe="Todas as zonas estão fechadas."
            if zonas and not ruins
            else f"{len(ruins)} zona(s) com arestas abertas."
            if zonas
            else "Não há zonas.",
            alvos=ruins,
        )
    )

    ruins = [z.ambiente_id for z in zonas if (z.volume_calculado or 0) <= 0]
    saida.append(
        Checagem(
            codigo="NORMAIS",
            nome="Normais para fora (vértices anti-horários vistos de fora da zona)",
            ok=bool(zonas) and not ruins,
            detalhe="O volume calculado com as normais é positivo em todas as zonas."
            if zonas and not ruins
            else "Há zonas com normais invertidas ou sem superfícies.",
            alvos=ruins,
        )
    )

    ruins = []
    for s in superficies:
        if s.condicao != "zona":
            continue
        par = por_id.get(s.par_id) if s.par_id else None
        if (
            par is None
            or par.par_id != s.id
            or par.elemento_id != s.elemento_id
            or abs(par.area_bruta - s.area_bruta) > 0.01
            or geo.escalar(geo.normal(par.vertices), geo.normal(s.vertices)) > -0.999
        ):
            ruins.append(s.fronteira_id)
    n_pares = sum(1 for s in superficies if s.condicao == "zona") // 2
    saida.append(
        Checagem(
            codigo="PARES",
            nome="Paredes entre zonas em pares (mesmo elemento, mesma área, normais opostas)",
            ok=not ruins,
            detalhe=f"{n_pares} par(es) conferido(s)."
            if not ruins
            else f"{len(ruins)} superfície(s) entre zonas sem par coerente.",
            alvos=ruins,
        )
    )

    ruins = [
        a.fronteira_id
        for a in aberturas
        if not geo.contido(a.vertices, por_id[a.superficie_id].vertices)
    ]
    saida.append(
        Checagem(
            codigo="ABERTURAS",
            nome="Aberturas coplanares e contidas na superfície-mãe",
            ok=not ruins,
            detalhe=f"{len(aberturas)} abertura(s) conferida(s)."
            if not ruins
            else f"{len(ruins)} abertura(s) fora da superfície-mãe.",
            alvos=ruins,
        )
    )
    return saida


def _prontidao(bim: ModeloBim, checagens: list[Checagem]) -> list[EtapaProntidao]:
    codigos = {d.codigo for d in bim.diagnostico}
    falhas = [c.nome for c in checagens if not c.ok]
    incompletos = [d.mensagem for d in bim.diagnostico if d.codigo == "MATERIAL_INCOMPLETO"]
    tem_ambientes = "SEM_AMBIENTES" not in codigos
    tem_fronteiras = tem_ambientes and bool(bim.fronteiras)
    return [
        EtapaProntidao(
            codigo="MODELO",
            nome="Modelo IFC carregado",
            estado="ok",
            detalhe=f"{bim.arquivo} ({bim.esquema}): {len(bim.elementos)} elementos.",
        ),
        EtapaProntidao(
            codigo="AMBIENTES",
            nome="Ambientes (IfcSpace)",
            estado="ok" if tem_ambientes else "erro",
            detalhe=f"{len(bim.ambientes)} ambiente(s)."
            if tem_ambientes
            else "O IFC não tem ambientes; veja o diagnóstico.",
        ),
        EtapaProntidao(
            codigo="FRONTEIRAS",
            nome="Fronteiras de espaço de 2º nível",
            estado="ok" if tem_fronteiras else "erro",
            detalhe=f"{len(bim.fronteiras)} fronteira(s)."
            if tem_fronteiras
            else "Sem fronteiras de 2º nível; o cálculo pela geometria ainda não existe.",
        ),
        EtapaProntidao(
            codigo="GEOMETRIA",
            nome="Checagens do modelo térmico",
            estado=("ok" if not falhas else "erro") if tem_fronteiras else "pendente",
            detalhe="Todas as checagens passaram."
            if tem_fronteiras and not falhas
            else ("Falharam: " + "; ".join(falhas))
            if tem_fronteiras
            else "Depende das fronteiras de espaço.",
        ),
        EtapaProntidao(
            codigo="MATERIAIS",
            nome="Propriedades térmicas dos materiais (no IFC)",
            estado="pendente" if incompletos or "ELEMENTO_SEM_MATERIAL" in codigos else "ok",
            detalhe=" ".join(incompletos)
            or (
                "Há elementos sem material."
                if "ELEMENTO_SEM_MATERIAL" in codigos
                else "Condutividade, densidade e calor específico presentes nas camadas."
            ),
        ),
        EtapaProntidao(
            codigo="OPERACAO",
            nome="Ocupação, iluminação, equipamentos e setpoints",
            estado="pendente",
            detalhe="O IFC não traz esses dados. Informe-os no painel “Uso e operação”, ambiente"
            " por ambiente.",
        ),
        EtapaProntidao(
            codigo="EPJSON",
            nome="Conversão do modelo térmico para epJSON",
            estado="nao_implementado",
            detalhe="Ainda não implementada. Por isso a simulação deste IFC no EnergyPlus não"
            " está disponível.",
        ),
        EtapaProntidao(
            codigo="SIMULACAO",
            nome="Simulação deste modelo no EnergyPlus",
            estado="nao_implementado",
            detalhe="Disponível hoje apenas para o exemplo que acompanha o EnergyPlus (painel"
            " “Simulação”).",
        ),
    ]
