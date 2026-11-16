"""Preparação e validação de arquivos epJSON (entrada do EnergyPlus).

Funções puras: recebem um dicionário e devolvem outro, sem tocar em disco.
Os nomes de campos usados aqui foram conferidos no Energy+.schema.epJSON
da versão 26.2.0.
"""

import copy

from jsonschema import Draft7Validator


def definir_periodo_anual(epjson: dict) -> dict:
    """Troca os períodos de simulação por um único, de 1/jan a 31/dez."""
    novo = copy.deepcopy(epjson)
    novo["RunPeriod"] = {
        "Ano inteiro": {
            "begin_month": 1,
            "begin_day_of_month": 1,
            "end_month": 12,
            "end_day_of_month": 31,
        }
    }
    return novo


def configurar_saidas(epjson: dict) -> dict:
    """Pede as saídas que a plataforma lê: banco SQLite com tabelas em kWh."""
    novo = copy.deepcopy(epjson)
    novo["Output:SQLite"] = {
        "Output:SQLite 1": {
            "option_type": "SimpleAndTabular",
            "unit_conversion_for_tabular_data": "JtoKWH",
        }
    }
    estilos = novo.setdefault("OutputControl:Table:Style", {"OutputControl:Table:Style 1": {}})
    for estilo in estilos.values():
        estilo["unit_conversion"] = "JtoKWH"
    novo["Output:Table:SummaryReports"] = {
        "Output:Table:SummaryReports 1": {"reports": [{"report_name": "AllSummary"}]}
    }
    return novo


def validar_contra_esquema(epjson: dict, esquema: dict, limite: int = 50) -> list[str]:
    """Confere o epJSON contra o esquema da versão instalada do EnergyPlus.

    Devolve uma lista de mensagens (vazia = válido), no formato
    ``TipoDoObjeto > nome > campo: problema``.
    """
    erros = []
    for erro in Draft7Validator(esquema).iter_errors(epjson):
        onde = " > ".join(str(p) for p in erro.absolute_path) or "(raiz)"
        erros.append(f"{onde}: {erro.message}")
        if len(erros) >= limite:
            erros.append(f"(mais erros omitidos; mostrando os primeiros {limite})")
            break
    return erros
