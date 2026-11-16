"""Leitura do consumo anual por uso final a partir do eplusout.sql."""

import pytest

from app.servicos.resultados import ResultadosIndisponiveis, ler_consumo_anual
from tests.conftest import gravar_sql_falso


def test_consumo_por_uso_final_ignora_zeros_totais_e_agua(tmp_path):
    sql = tmp_path / "eplusout.sql"
    gravar_sql_falso(sql)

    r = ler_consumo_anual(sql)

    assert [(i.uso_final, i.fonte, i.kwh) for i in r.itens] == [
        ("Aquecimento", "Eletricidade", 100.0),
        ("Resfriamento", "Eletricidade", 50.0),
        ("Iluminação interna", "Eletricidade", 30.0),
        ("Aquecimento", "Gás natural", 20.0),
    ]


def test_totais_e_intensidade(tmp_path):
    sql = tmp_path / "eplusout.sql"
    gravar_sql_falso(sql)

    r = ler_consumo_anual(sql)

    assert [(t.fonte, t.kwh) for t in r.total_por_fonte] == [
        ("Eletricidade", 180.0),
        ("Gás natural", 20.0),
    ]
    assert r.total_kwh == 200.0
    assert r.area_condicionada_m2 == 50.0
    assert r.area_total_m2 == 80.0
    assert r.intensidade_kwh_m2 == 4.0


def test_guarda_a_chave_original_do_energyplus(tmp_path):
    sql = tmp_path / "eplusout.sql"
    gravar_sql_falso(sql)

    item = ler_consumo_anual(sql).itens[0]

    assert (item.uso_final_chave, item.fonte_chave) == ("Heating", "Electricity")


def test_arquivo_ausente_gera_erro_claro(tmp_path):
    with pytest.raises(ResultadosIndisponiveis, match="eplusout.sql"):
        ler_consumo_anual(tmp_path / "eplusout.sql")


def test_sem_area_condicionada_intensidade_fica_vazia(tmp_path):
    sql = tmp_path / "eplusout.sql"
    gravar_sql_falso(
        sql,
        [
            ("End Uses", "Heating", "Electricity", "kWh", "10.00"),
            ("Building Area", "Total Building Area", "Area", "m2", "80.00"),
            ("Building Area", "Net Conditioned Building Area", "Area", "m2", "0.00"),
        ],
    )

    assert ler_consumo_anual(sql).intensidade_kwh_m2 is None
