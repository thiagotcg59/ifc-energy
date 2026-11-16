"""Peças compartilhadas pelos testes.

Os testes rápidos NÃO usam o EnergyPlus de verdade: usam um "motor falso" que
imita o que o EnergyPlus devolve. Assim rodam em segundos e também no GitHub.
Os testes marcados com ``energyplus`` usam a instalação real.
"""

import sqlite3
from contextlib import closing
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import Configuracao
from app.main import criar_app
from app.servicos.energyplus import MotorEnergyPlus, ResultadoExecucao

# Tabela "End Uses" resumida, no formato que o EnergyPlus grava no eplusout.sql.
# Valores escolhidos à mão para a conta ser fácil de conferir:
#   eletricidade = 100 + 50 + 30 = 180 kWh ; gás = 20 kWh ; total = 200 kWh
#   área condicionada = 50 m2  ->  intensidade = 200 / 50 = 4 kWh/m2
LINHAS_TABELA = [
    ("End Uses", "Heating", "Electricity", "kWh", "      100.00"),
    ("End Uses", "Cooling", "Electricity", "kWh", "       50.00"),
    ("End Uses", "Interior Lighting", "Electricity", "kWh", "       30.00"),
    ("End Uses", "Fans", "Electricity", "kWh", "        0.00"),
    ("End Uses", "", "Electricity", "kWh", ""),
    ("End Uses", "Total End Uses", "Electricity", "kWh", "      180.00"),
    ("End Uses", "Heating", "Natural Gas", "kWh", "       20.00"),
    ("End Uses", "Cooling", "Natural Gas", "kWh", "        0.00"),
    ("End Uses", "Total End Uses", "Natural Gas", "kWh", "       20.00"),
    ("End Uses", "Heating", "Water", "m3", "        7.00"),
    ("End Uses", "Total End Uses", "Water", "m3", "        7.00"),
    ("Building Area", "Total Building Area", "Area", "m2", "       80.00"),
    ("Building Area", "Net Conditioned Building Area", "Area", "m2", "       50.00"),
]


def gravar_sql_falso(caminho: Path, linhas=LINHAS_TABELA) -> None:
    """Cria um eplusout.sql mínimo com a mesma tabela que o EnergyPlus gera."""
    caminho.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(caminho)) as con, con:
        con.execute(
            "CREATE TABLE TabularDataWithStrings (ReportName TEXT, ReportForString TEXT,"
            " TableName TEXT, RowName TEXT, ColumnName TEXT, Units TEXT, Value TEXT)"
        )
        con.executemany(
            "INSERT INTO TabularDataWithStrings VALUES"
            " ('AnnualBuildingUtilityPerformanceSummary', 'Entire Facility', ?, ?, ?, ?, ?)",
            linhas,
        )


ESQUEMA_MINI = {
    "$schema": "https://json-schema.org/draft-07/schema#",
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "Version": {"type": "object"},
        "Building": {"type": "object"},
        "SimulationControl": {"type": "object"},
        "RunPeriod": {
            "type": "object",
            "patternProperties": {
                ".*": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "begin_month": {"type": "integer"},
                        "begin_day_of_month": {"type": "integer"},
                        "end_month": {"type": "integer"},
                        "end_day_of_month": {"type": "integer"},
                    },
                }
            },
        },
        "Output:SQLite": {"type": "object"},
        "OutputControl:Table:Style": {"type": "object"},
        "Output:Table:SummaryReports": {"type": "object"},
    },
}

EPJSON_MINI = {
    "Version": {"Version 1": {"version_identifier": "26.2"}},
    "Building": {"Casa de teste": {}},
    "RunPeriod": {"Inverno": {"begin_month": 1, "begin_day_of_month": 14}},
}


class MotorFalso(MotorEnergyPlus):
    """Imita o EnergyPlus: não roda nada, só grava a saída esperada."""

    def __init__(self, pasta: Path, *, encontrado=True, falhar_em: str | None = None):
        super().__init__(pasta)
        self.encontrado = encontrado
        self.falhar_em = falhar_em
        self.modos_executados: list[str] = []

    def disponivel(self) -> bool:
        return self.encontrado

    def versao(self) -> str | None:
        return "26.2.0" if self.encontrado else None

    def carregar_esquema(self) -> dict:
        return ESQUEMA_MINI

    def clima_do_exemplo(self) -> Path:
        return self.pasta / "clima.epw"

    def executar(self, entrada: Path, clima: Path, pasta_saida: Path, modo: str):
        self.modos_executados.append(modo)
        if modo == self.falhar_em:
            return ResultadoExecucao(
                sucesso=False,
                avisos=0,
                erros_graves=1,
                mensagens=["** Severe  ** Zona sem superfícies"],
            )
        gravar_sql_falso(pasta_saida / "eplusout.sql")
        return ResultadoExecucao(sucesso=True, avisos=2, erros_graves=0, mensagens=[])


@pytest.fixture
def configuracao(tmp_path: Path) -> Configuracao:
    import json

    exemplo = tmp_path / "exemplo.epJSON"
    exemplo.write_text(json.dumps(EPJSON_MINI), encoding="utf-8")
    return Configuracao(
        energyplus_dir=tmp_path / "energyplus",
        dados_dir=tmp_path / "dados",
        exemplo_epjson=exemplo,
    )


@pytest.fixture
def motor(tmp_path: Path) -> MotorFalso:
    return MotorFalso(tmp_path / "energyplus")


@pytest.fixture
def app(configuracao, motor):
    # iniciar_fila=False: nos testes processamos a fila "na mão", sem esperar.
    return criar_app(configuracao, motor=motor, iniciar_fila=False)


@pytest.fixture
def cliente(app):
    with TestClient(app) as c:
        yield c
