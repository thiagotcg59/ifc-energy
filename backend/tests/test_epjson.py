"""Funções puras que preparam e validam o epJSON (sem EnergyPlus)."""

import copy

from app.dominio.epjson import configurar_saidas, definir_periodo_anual, validar_contra_esquema
from tests.conftest import EPJSON_MINI, ESQUEMA_MINI


def test_periodo_anual_substitui_os_periodos_existentes():
    novo = definir_periodo_anual(EPJSON_MINI)

    assert list(novo["RunPeriod"].values()) == [
        {"begin_month": 1, "begin_day_of_month": 1, "end_month": 12, "end_day_of_month": 31}
    ]


def test_funcoes_nao_alteram_o_epjson_original():
    original = copy.deepcopy(EPJSON_MINI)

    definir_periodo_anual(EPJSON_MINI)
    configurar_saidas(EPJSON_MINI)

    assert original == EPJSON_MINI


def test_saidas_pedem_sqlite_com_tabelas_em_kwh():
    novo = configurar_saidas(EPJSON_MINI)

    (sqlite,) = novo["Output:SQLite"].values()
    assert sqlite == {
        "option_type": "SimpleAndTabular",
        "unit_conversion_for_tabular_data": "JtoKWH",
    }
    (relatorios,) = novo["Output:Table:SummaryReports"].values()
    assert {"report_name": "AllSummary"} in relatorios["reports"]


def test_saidas_preservam_estilo_de_tabela_existente():
    entrada = {**EPJSON_MINI, "OutputControl:Table:Style": {"Estilo": {"column_separator": "HTML"}}}

    novo = configurar_saidas(entrada)

    assert novo["OutputControl:Table:Style"] == {
        "Estilo": {"column_separator": "HTML", "unit_conversion": "JtoKWH"}
    }


def test_epjson_valido_nao_gera_erros():
    assert validar_contra_esquema(EPJSON_MINI, ESQUEMA_MINI) == []


def test_campo_com_nome_errado_e_apontado():
    errado = copy.deepcopy(EPJSON_MINI)
    errado["RunPeriod"]["Inverno"]["mes_inicial"] = 1

    erros = validar_contra_esquema(errado, ESQUEMA_MINI)

    assert len(erros) == 1
    assert "RunPeriod" in erros[0]
    assert "mes_inicial" in erros[0]


def test_tipo_de_objeto_desconhecido_e_apontado():
    errado = {**EPJSON_MINI, "ObjetoInventado": {}}

    erros = validar_contra_esquema(errado, ESQUEMA_MINI)

    assert len(erros) == 1
    assert "ObjetoInventado" in erros[0]
