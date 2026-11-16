"""Cálculo térmico de camadas, conferido pelos mesmos casos do front-end."""

import json
from pathlib import Path

import pytest

from app.dominio import geometria as geo
from app.dominio.termica import CamadaTermica, calcular_desempenho

VETORES = json.loads(
    (Path(__file__).parents[2] / "exemplos" / "testes" / "vetores_termicos.json").read_text("utf-8")
)


@pytest.mark.parametrize("caso", VETORES["casos"], ids=lambda c: c["nome"][:40])
def test_casos_de_resposta_conhecida(caso):
    r = calcular_desempenho([CamadaTermica(**c) for c in caso["camadas"]], caso["rsi"], caso["rse"])

    for campo, esperado in caso["esperado"].items():
        obtido = getattr(r, campo)
        if campo == "resistencias":
            assert obtido == [
                pytest.approx(e, rel=1e-6) if e is not None else None for e in esperado
            ]
        elif esperado is None:
            assert obtido is None, campo
        else:
            assert obtido == pytest.approx(esperado, rel=1e-6), campo


def test_mais_isolante_aumenta_a_resistencia_e_reduz_a_transmitancia():
    base = [CamadaTermica(0.10, 1.95)]
    antes = calcular_desempenho(base, 0.13, 0.04)
    depois = calcular_desempenho([*base, CamadaTermica(0.05, 0.03)], 0.13, 0.04)

    assert depois.resistencia_camadas == pytest.approx(antes.resistencia_camadas + 0.05 / 0.03)
    assert depois.transmitancia < antes.transmitancia


def test_pendencias_dizem_o_que_falta():
    r = calcular_desempenho([CamadaTermica(0.1, None)], 0.13, 0.04)

    assert "Camada 1" in r.pendencias[0]


# ---- geometria ----------------------------------------------------------------

QUADRADO = [(0, 0, 0), (2, 0, 0), (2, 2, 0), (0, 2, 0)]  # normal +Z


def test_area_normal_azimute_e_inclinacao():
    parede_sul = [(0, 0, 0), (4, 0, 0), (4, 0, 3), (0, 0, 3)]  # normal -Y (vista do sul)

    assert geo.area(QUADRADO) == 4
    assert geo.normal(QUADRADO) == (0, 0, 1)
    assert geo.inclinacao(geo.normal(QUADRADO)) == 0
    assert geo.azimute(geo.normal(QUADRADO)) is None
    assert geo.normal(parede_sul) == (0, -1, 0)
    assert geo.azimute(geo.normal(parede_sul)) == 180
    assert geo.rotulo_orientacao(180) == "Sul"
    assert geo.azimute((1, 0, 0), norte_graus=90) == 0  # norte verdadeiro girado


def _cubo():
    return [
        [(0, 0, 0), (0, 1, 0), (1, 1, 0), (1, 0, 0)],  # piso (normal -Z)
        [(0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)],  # teto
        [(0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1)],  # sul
        [(1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1)],  # leste
        [(1, 1, 0), (0, 1, 0), (0, 1, 1), (1, 1, 1)],  # norte
        [(0, 1, 0), (0, 0, 0), (0, 0, 1), (0, 1, 1)],  # oeste
    ]


def test_cubo_fechado_tem_volume_1_e_nenhuma_aresta_aberta():
    assert geo.volume_fechado(_cubo()) == pytest.approx(1)
    assert geo.arestas_abertas(_cubo()) == 0


def test_cubo_sem_tampa_tem_arestas_abertas():
    assert geo.arestas_abertas(_cubo()[:1] + _cubo()[2:]) == 4


def test_parede_dividida_em_dois_trechos_ainda_fecha():
    cubo = _cubo()
    cubo[2:3] = [
        [(0, 0, 0), (0.4, 0, 0), (0.4, 0, 1), (0, 0, 1)],
        [(0.4, 0, 0), (1, 0, 0), (1, 0, 1), (0.4, 0, 1)],
    ]

    assert geo.arestas_abertas(cubo) == 0


def test_abertura_contida_ou_fora_da_superficie():
    janela = [(0.5, 0.5, 0), (1.5, 0.5, 0), (1.5, 1.5, 0), (0.5, 1.5, 0)]
    fora = [(1.5, 0.5, 0), (2.5, 0.5, 0), (2.5, 1.5, 0), (1.5, 1.5, 0)]
    em_outro_plano = [(x, y, 0.1) for x, y, _ in janela]

    assert geo.contido(janela, QUADRADO)
    assert not geo.contido(fora, QUADRADO)
    assert not geo.contido(em_outro_plano, QUADRADO)
