"""Leitura dos resultados que o EnergyPlus grava em eplusout.sql."""

import sqlite3
from contextlib import closing
from pathlib import Path

from pydantic import BaseModel

RELATORIO = "AnnualBuildingUtilityPerformanceSummary"

# Tradução dos nomes que o EnergyPlus usa nas tabelas (só rótulos de tela).
USOS_FINAIS = {
    "Heating": "Aquecimento",
    "Cooling": "Resfriamento",
    "Interior Lighting": "Iluminação interna",
    "Exterior Lighting": "Iluminação externa",
    "Interior Equipment": "Equipamentos internos",
    "Exterior Equipment": "Equipamentos externos",
    "Fans": "Ventiladores",
    "Pumps": "Bombas",
    "Heat Rejection": "Rejeição de calor",
    "Humidification": "Umidificação",
    "Heat Recovery": "Recuperação de calor",
    "Water Systems": "Aquecimento de água",
    "Refrigeration": "Refrigeração",
    "Generators": "Geradores",
}
FONTES = {
    "Electricity": "Eletricidade",
    "Natural Gas": "Gás natural",
    "Gasoline": "Gasolina",
    "Diesel": "Diesel",
    "Coal": "Carvão",
    "Fuel Oil No 1": "Óleo combustível nº 1",
    "Fuel Oil No 2": "Óleo combustível nº 2",
    "Propane": "GLP (propano)",
    "Other Fuel 1": "Outro combustível 1",
    "Other Fuel 2": "Outro combustível 2",
    "District Cooling": "Frio distrital (carga ideal de resfriamento)",
    "District Heating Water": "Calor distrital (carga ideal de aquecimento)",
    "District Heating Steam": "Vapor distrital",
}


class ResultadosIndisponiveis(RuntimeError):
    pass


class ItemConsumo(BaseModel):
    uso_final: str
    uso_final_chave: str
    fonte: str
    fonte_chave: str
    kwh: float


class TotalPorFonte(BaseModel):
    fonte: str
    fonte_chave: str
    kwh: float


class ConsumoAnual(BaseModel):
    """Consumo anual por uso final e fonte de energia, em kWh."""

    itens: list[ItemConsumo]
    total_por_fonte: list[TotalPorFonte]
    total_kwh: float
    area_condicionada_m2: float | None
    area_total_m2: float | None
    intensidade_kwh_m2: float | None


def _numero(texto: str) -> float | None:
    try:
        return float(texto.strip())
    except ValueError:
        return None


def ler_consumo_anual(caminho_sql: Path) -> ConsumoAnual:
    if not caminho_sql.is_file():
        raise ResultadosIndisponiveis(
            f"O EnergyPlus não gravou o arquivo de resultados ({caminho_sql.name})."
        )
    with closing(sqlite3.connect(caminho_sql)) as con:
        linhas = con.execute(
            "SELECT TableName, RowName, ColumnName, Units, Value FROM TabularDataWithStrings"
            " WHERE ReportName = ? AND ReportForString = 'Entire Facility'"
            " AND TableName IN ('End Uses', 'Building Area')",
            (RELATORIO,),
        ).fetchall()

    itens: list[ItemConsumo] = []
    areas: dict[str, float] = {}
    for tabela, linha, coluna, unidade, valor in linhas:
        numero = _numero(valor)
        if numero is None:
            continue
        if tabela == "Building Area":
            areas[linha] = numero
        elif unidade == "kWh" and linha in USOS_FINAIS and numero != 0:
            itens.append(
                ItemConsumo(
                    uso_final=USOS_FINAIS[linha],
                    uso_final_chave=linha,
                    fonte=FONTES.get(coluna, coluna),
                    fonte_chave=coluna,
                    kwh=numero,
                )
            )

    totais: dict[str, TotalPorFonte] = {}
    for item in itens:
        total = totais.setdefault(
            item.fonte_chave,
            TotalPorFonte(fonte=item.fonte, fonte_chave=item.fonte_chave, kwh=0.0),
        )
        total.kwh = round(total.kwh + item.kwh, 2)
    total_kwh = round(sum(i.kwh for i in itens), 2)
    condicionada = areas.get("Net Conditioned Building Area")
    return ConsumoAnual(
        itens=itens,
        total_por_fonte=list(totais.values()),
        total_kwh=total_kwh,
        area_condicionada_m2=condicionada,
        area_total_m2=areas.get("Total Building Area"),
        intensidade_kwh_m2=round(total_kwh / condicionada, 2) if condicionada else None,
    )
