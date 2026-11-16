"""Testes lentos: usam o EnergyPlus instalado de verdade.

Rodar com:  uv run pytest -m energyplus
Não rodam no GitHub (lá não há EnergyPlus instalado).
"""

import json
import re

import pytest

from app.core.config import Configuracao
from app.dominio.epjson import configurar_saidas, definir_periodo_anual, validar_contra_esquema
from app.persistencia.banco import RepositorioSimulacoes
from app.servicos.energyplus import MotorEnergyPlus
from app.servicos.simulacao import ServicoSimulacao

pytestmark = pytest.mark.energyplus


@pytest.fixture(scope="module")
def motor():
    motor = MotorEnergyPlus(Configuracao().energyplus_dir)
    if not motor.disponivel():
        pytest.skip(f"EnergyPlus não encontrado em {motor.pasta}")
    return motor


def test_versao_instalada_e_a_registrada(motor):
    from app.core.versoes import ENERGYPLUS_VERSAO

    assert motor.versao() == ENERGYPLUS_VERSAO


def test_exemplo_e_valido_no_esquema_da_versao_instalada(motor):
    exemplo = json.loads(Configuracao().exemplo_epjson.read_text(encoding="utf-8"))
    preparado = configurar_saidas(definir_periodo_anual(exemplo))

    assert validar_contra_esquema(preparado, motor.carregar_esquema()) == []


def test_exemplo_roda_de_ponta_a_ponta(motor, tmp_path):
    """Valores de referência: execução manual do mesmo arquivo no EnergyPlus
    26.2.0 com o clima de Chicago que vem na instalação (15/11/2026)."""
    cfg = Configuracao(dados_dir=tmp_path)
    repositorio = RepositorioSimulacoes(tmp_path / "banco.sqlite")
    servico = ServicoSimulacao(repositorio, motor, tmp_path / "execucoes", cfg.exemplo_epjson)

    registro = servico.criar_exemplo()
    servico.processar(registro.id)

    final = repositorio.obter(registro.id)
    assert final.estado == "concluida", (final.mensagem, final.detalhes)
    r = final.resultado
    totais = {t["fonte_chave"]: t["kwh"] for t in r["total_por_fonte"]}
    assert totais["Electricity"] == pytest.approx(53403.86, rel=1e-3)
    assert totais["Natural Gas"] == pytest.approx(153638.80, rel=1e-3)
    assert r["area_condicionada_m2"] == pytest.approx(185.83, abs=0.01)
    # A soma dos usos finais tem de fechar com o total.
    assert sum(i["kwh"] for i in r["itens"]) == pytest.approx(r["total_kwh"], abs=0.1)


def _objeto_do_dataset(arquivo, nome):
    """Campos numéricos do objeto ``nome`` em um arquivo .idf da pasta DataSets."""
    texto = arquivo.read_text(encoding="latin-1")
    # O nome também aparece em "Construction"; queremos o objeto do material.
    achado = re.search(rf"(?:Material|WindowMaterial:Glazing),\s*\n\s*{re.escape(nome)},", texto)
    bloco = texto[achado.end() : texto.index(";", achado.end())]
    campos = [linha.split("!")[0].strip(" ,") for linha in bloco.splitlines()]
    return [float(c) for c in campos if c.replace(".", "", 1).replace("-", "", 1).isdigit()]


def test_biblioteca_confere_com_os_datasets_do_energyplus(motor):
    """Nenhum valor da biblioteca é inventado: todos estão nos arquivos citados."""
    from app.servicos.modelos import ler_biblioteca

    pasta = motor.pasta / "DataSets"
    for m in ler_biblioteca()["materiais"]:
        if m["fonte"] == "ashrae":
            _esp, cond, dens, calor = _objeto_do_dataset(
                pasta / "ASHRAE_2005_HOF_Materials.idf", m["nome_na_fonte"]
            )
            assert (m["condutividade"], m["densidade"], m["calor_especifico"]) == (
                cond,
                dens,
                calor,
            ), m["nome"]
        elif m["fonte"] == "vidros":
            v = _objeto_do_dataset(pasta / "WindowGlassMaterials.idf", m["nome_na_fonte"])
            assert [
                m["espessura"],
                m["transmitancia_solar"],
                m["refletancia_solar"],
                m["transmitancia_visivel"],
                m["refletancia_visivel"],
                m["emissividade"],
                m["condutividade"],
            ] == [v[0], v[1], v[2], v[4], v[5], v[8], v[10]], m["nome"]
