"""O IFC sintético da residência de exemplo: estrutura, geometria e leitura.

Os valores esperados foram calculados à mão a partir das dimensões descritas
em docs/spec/residencia-exemplo.md (casa de 10 m × 7 m, pé-direito 2,80 m).
"""

import ifcopenshell
import ifcopenshell.geom
import ifcopenshell.util.shape
import ifcopenshell.validate
import pytest

from app.dominio.modelo_bim import ler_modelo_bim
from app.dominio.modelo_termico import montar_modelo_termico
from ferramentas.gerar_residencia_ifc import ARQUIVO_IFC, Gerador


@pytest.fixture(scope="module")
def ifc():
    return ifcopenshell.open(str(ARQUIVO_IFC))


@pytest.fixture(scope="module")
def bim():
    return ler_modelo_bim(ARQUIVO_IFC)


@pytest.fixture(scope="module")
def termico(bim):
    return montar_modelo_termico(bim)


def por_etiqueta(bim, etiqueta):
    return next(e for e in bim.elementos if e.etiqueta == etiqueta)


# ---- o arquivo ---------------------------------------------------------------


def test_arquivo_versionado_e_igual_ao_que_o_gerador_produz(tmp_path):
    novo = tmp_path / "novo.ifc"
    Gerador().gerar().write(str(novo))

    assert novo.read_text(encoding="utf-8") == ARQUIVO_IFC.read_text(encoding="utf-8"), (
        "Rode: uv run python -m ferramentas.gerar_residencia_ifc"
    )


def test_e_ifc4_valido_inclusive_nas_regras_do_esquema(ifc):
    registro = ifcopenshell.validate.json_logger()
    ifcopenshell.validate.validate(ifc, registro, express_rules=True)

    assert ifc.schema == "IFC4"
    assert registro.statements == []


@pytest.mark.parametrize(
    ("classe", "quantidade"),
    [
        ("IfcProject", 1),
        ("IfcSite", 1),
        ("IfcBuilding", 1),
        ("IfcBuildingStorey", 1),
        ("IfcSpace", 3),
        ("IfcWall", 6),
        ("IfcSlab", 2),
        ("IfcWindow", 5),
        ("IfcDoor", 3),
        ("IfcOpeningElement", 8),
        ("IfcRelSpaceBoundary2ndLevel", 30),
    ],
)
def test_quantidade_de_entidades(ifc, classe, quantidade):
    assert len(ifc.by_type(classe)) == quantidade


def test_global_ids_sao_unicos(ifc):
    ids = [e.GlobalId for e in ifc.by_type("IfcRoot")]

    assert len(ids) == len(set(ids))


def test_geometria_dos_ambientes_calculada_pelo_ifcopenshell(ifc):
    """Volume = largura × profundidade × 2,80 de cada ambiente."""
    ajustes = ifcopenshell.geom.settings()
    volumes = {
        s.LongName: ifcopenshell.util.shape.get_volume(
            ifcopenshell.geom.create_shape(ajustes, s).geometry
        )
        for s in ifc.by_type("IfcSpace")
    }

    assert volumes["Sala e cozinha"] == pytest.approx(5.85 * 6.70 * 2.80)  # 109,746
    assert volumes["Quarto"] == pytest.approx(3.73 * 4.45 * 2.80)  # 46,4758
    assert volumes["Banheiro"] == pytest.approx(3.73 * 2.13 * 2.80)  # 22,24572


def test_vaos_sao_descontados_da_parede(ifc):
    """Parede sul: 10 × 2,80 = 28 m²; menos a porta (0,90 × 2,10) e a janela
    (1,50 × 1,20) = 24,31 m²; vezes 0,15 m de espessura = 3,6465 m³."""
    parede = next(w for w in ifc.by_type("IfcWall") if w.Tag == "PE-S")
    forma = ifcopenshell.geom.create_shape(ifcopenshell.geom.settings(), parede)

    assert ifcopenshell.util.shape.get_volume(forma.geometry) == pytest.approx(3.6465)


# ---- leitura (modelo de inspeção) --------------------------------------------


def test_projeto_e_local(bim):
    assert bim.projeto.nome == "Residência de exemplo ifc-energy"
    assert bim.projeto.latitude == pytest.approx(-23.5475, abs=1e-4)
    assert bim.projeto.norte_graus == 0


def test_ambientes_com_area_e_volume_lidos_do_ifc(bim):
    sala = next(a for a in bim.ambientes if a.nome == "Sala e cozinha")

    assert sala.numero == "01"
    assert sala.dimensoes["area_de_piso"].valor == pytest.approx(39.195)
    assert sala.dimensoes["area_de_piso"].origem == "ifc"
    assert sala.dimensoes["area_de_piso"].fonte == "Qto_SpaceBaseQuantities.NetFloorArea"
    assert sala.dimensoes["volume"].valor == pytest.approx(109.746)
    assert len(sala.fronteiras_ids) == 14


def test_elemento_e_encontrado_pelo_global_id(bim, ifc):
    parede_ifc = next(w for w in ifc.by_type("IfcWall") if w.Tag == "PE-N")

    parede = next(e for e in bim.elementos if e.global_id == parede_ifc.GlobalId)

    assert parede.nome == "Parede externa norte"
    assert parede.classe == "IfcWall"
    assert parede.categoria == "parede"
    assert parede.tipo_construtivo == "Parede externa de alvenaria rebocada 15 cm"


def test_parede_externa_dimensoes_orientacao_e_relacoes(bim):
    parede = por_etiqueta(bim, "PE-S")

    assert parede.dimensoes["comprimento"].valor == 10.0
    assert parede.dimensoes["espessura"].valor == 0.15
    assert parede.dimensoes["area_liquida"].valor == pytest.approx(24.31)
    assert parede.externo.valor is True and parede.externo.origem == "ifc"
    assert parede.condicao == "exterior"
    assert parede.orientacao.rotulo == "Sul" and parede.orientacao.azimute == 180
    assert parede.orientacao.inclinacao == 90
    assert {por_id(bim, i).etiqueta for i in parede.aberturas_ids} == {"P0", "J5"}
    assert len(parede.ambientes_ids) == 2  # sala e quarto


def por_id(bim, global_id):
    return next(e for e in bim.elementos if e.global_id == global_id)


@pytest.mark.parametrize(
    ("etiqueta", "rotulo", "azimute"),
    [("J1", "Norte", 0), ("J2", "Oeste", 270), ("J3", "Leste", 90), ("J5", "Sul", 180)],
)
def test_orientacao_das_janelas(bim, etiqueta, rotulo, azimute):
    janela = por_etiqueta(bim, etiqueta)

    assert (janela.orientacao.rotulo, janela.orientacao.azimute) == (rotulo, azimute)


def test_camadas_da_parede_externa_de_fora_para_dentro(bim):
    construcao = next(c for c in bim.construcoes if c.id == por_etiqueta(bim, "PE-S").construcao_id)

    assert [(c.nome, c.espessura.valor) for c in construcao.camadas] == [
        ("Argamassa de reboco", 0.025),
        ("Alvenaria de tijolo cerâmico", 0.10),
        ("Argamassa de reboco", 0.025),
    ]
    assert all(c.espessura.origem == "ifc" for c in construcao.camadas)
    assert len(construcao.elementos_ids) == 4  # as quatro paredes externas


def test_propriedades_do_material_vem_do_ifc_com_a_fonte(bim):
    tijolo = next(m for m in bim.materiais if m.nome == "Alvenaria de tijolo cerâmico")

    assert tijolo.propriedades["condutividade"].valor == 0.89
    assert tijolo.propriedades["condutividade"].unidade == "W/(m·K)"
    assert tijolo.propriedades["condutividade"].origem == "ifc"
    assert tijolo.propriedades["condutividade"].fonte == "Pset_MaterialThermal.ThermalConductivity"
    assert tijolo.propriedades["densidade"].valor == 1920
    assert tijolo.propriedades["calor_especifico"].valor == 790


def test_valor_que_o_ifc_nao_traz_fica_ausente_e_nao_e_inventado(bim):
    tijolo = next(m for m in bim.materiais if m.nome == "Alvenaria de tijolo cerâmico")
    aluminio = next(m for m in bim.materiais if m.nome.startswith("Alumínio"))

    assert tijolo.propriedades["absortancia_solar"].valor is None
    assert tijolo.propriedades["absortancia_solar"].origem == "ausente"
    assert all(v.origem == "ausente" for v in aluminio.propriedades.values())
    assert any(d.codigo == "ABSORTANCIA_AUSENTE" for d in bim.diagnostico)


def test_janela_vidro_e_caixilho_separados(bim):
    janela = por_etiqueta(bim, "J1")
    construcao = next(c for c in bim.construcoes if c.id == janela.construcao_id)

    assert janela.dimensoes["largura"].valor == 2.0
    assert janela.dimensoes["area_liquida"].valor == pytest.approx(2.4)
    assert por_id(bim, janela.hospedeiro_id).etiqueta == "PE-N"
    assert [c.nome for c in construcao.constituintes] == ["Vidro", "Caixilho"]
    assert janela.envidracamento["transmitancia_solar"].valor == 0.837
    assert janela.envidracamento["camadas_de_vidro"].valor == 1
    # U e fator solar da JANELA não estão no IFC: ficam ausentes.
    assert janela.envidracamento["fator_solar"].origem == "ausente"
    assert janela.envidracamento["transmitancia_termica_verao"].origem == "ausente"


def test_piso_em_contato_com_o_solo_e_cobertura_exposta(bim):
    piso, cobertura = por_etiqueta(bim, "PISO"), por_etiqueta(bim, "COBERTURA")

    assert (piso.categoria, piso.condicao, piso.orientacao.inclinacao) == ("piso", "solo", 180)
    assert (cobertura.categoria, cobertura.condicao) == ("cobertura", "exterior")
    assert cobertura.orientacao.inclinacao == 0 and cobertura.orientacao.azimute is None


def test_fronteiras_externas_internas_pares_e_filhas(bim):
    fr = bim.fronteiras
    internas = [f for f in fr if f.posicao == "interna"]

    assert len(fr) == 30
    assert sum(1 for f in fr if f.posicao == "solo") == 3
    assert sum(1 for f in fr if f.pai_id) == 10  # 5 janelas + porta externa + 2 portas × 2
    assert sum(1 for f in internas if f.nivel == "2b") == 1
    por_gid = {f.global_id: f for f in fr}
    for f in internas:
        if f.nivel == "2b":
            assert f.correspondente_id is None
        else:
            assert por_gid[f.correspondente_id].correspondente_id == f.global_id


def test_diagnostico_do_exemplo_nao_tem_erros(bim):
    assert [d for d in bim.diagnostico if d.nivel == "erro"] == []


# ---- modelo térmico -----------------------------------------------------------


def test_zonas_com_volume_calculado_igual_ao_do_ifc(termico):
    volumes = {z.nome: (z.volume_calculado, z.volume_ifc) for z in termico.zonas}

    assert volumes["Sala e cozinha"] == pytest.approx((109.746, 109.746))
    assert volumes["Quarto"] == pytest.approx((46.4758, 46.4758))
    assert volumes["Banheiro"] == pytest.approx((22.2457, 22.24572), abs=1e-4)


def test_todas_as_checagens_passam(termico):
    assert {c.codigo: c.ok for c in termico.checagens} == {
        "VOLUME": True,
        "FECHADA": True,
        "NORMAIS": True,
        "PARES": True,
        "ABERTURAS": True,
    }


def test_condicoes_de_contorno(termico):
    contagem = {}
    for s in termico.superficies:
        contagem[s.condicao] = contagem.get(s.condicao, 0) + 1

    # 7 paredes externas + 3 coberturas; 3 pisos; 3 pares entre zonas; 1 trecho 2b
    assert contagem == {"exterior": 10, "solo": 3, "zona": 6, "adiabatica": 1}
    assert any("adiabática" in s for s in termico.suposicoes)


def test_superficie_guarda_a_origem_e_desconta_as_aberturas(termico, bim):
    parede = por_etiqueta(bim, "PE-S")
    sup = next(
        s
        for s in termico.superficies
        if s.elemento_id == parede.global_id and len(s.aberturas_ids) == 2
    )

    # Face da sala na parede sul: 5,85 × 2,80 = 16,38 m²; menos porta e janela.
    assert sup.area_bruta == pytest.approx(16.38)
    assert sup.area_liquida == pytest.approx(16.38 - 0.9 * 2.1 - 1.5 * 1.2)
    assert (sup.tipo, sup.condicao, sup.azimute) == ("parede", "exterior", 180)
    assert sup.construcao_id == parede.construcao_id


def test_par_entre_zonas_aponta_um_para_o_outro(termico):
    por_id_sup = {s.id: s for s in termico.superficies}
    pares = [s for s in termico.superficies if s.condicao == "zona"]

    assert len(pares) == 6
    for s in pares:
        outro = por_id_sup[s.par_id]
        assert outro.par_id == s.id and outro.zona_id == s.zona_vizinha_id


def test_prontidao_diz_o_que_falta_sem_prometer_simulacao(termico):
    estados = {e.codigo: e.estado for e in termico.prontidao}

    assert estados["GEOMETRIA"] == "ok"
    assert estados["MATERIAIS"] == "ok"
    assert estados["EPJSON"] == "nao_implementado"
    assert estados["SIMULACAO"] == "nao_implementado"


# ---- IFC sem ambientes ---------------------------------------------------------


def test_ifc_sem_ambientes_gera_erro_com_orientacao_e_nenhuma_zona(tmp_path):
    f = ifcopenshell.open(str(ARQUIVO_IFC))
    for classe in ("IfcRelSpaceBoundary", "IfcSpace"):
        for entidade in f.by_type(classe):
            f.remove(entidade)
    caminho = tmp_path / "sem_ambientes.ifc"
    f.write(str(caminho))

    bim = ler_modelo_bim(caminho)
    termico = montar_modelo_termico(bim)

    erro = next(d for d in bim.diagnostico if d.codigo == "SEM_AMBIENTES")
    assert erro.nivel == "erro" and "Revit" in erro.como_resolver
    assert termico.zonas == [] and termico.superficies == []
    assert {e.codigo: e.estado for e in termico.prontidao}["AMBIENTES"] == "erro"
