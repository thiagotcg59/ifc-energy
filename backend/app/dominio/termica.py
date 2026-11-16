"""Cálculos térmicos de composições em camadas homogêneas (funções puras).

Metodologia explícita (regime permanente, camadas em série):

- resistência de cada camada:        R_i = e_i / λ_i            [m²·K/W]
- resistência de superfície a superfície: R_t = Σ R_i
- resistência total ambiente a ambiente:  R_T = R_si + R_t + R_se
- transmitância térmica:             U = 1 / R_T                [W/(m²·K)]
- capacidade térmica por área:       C_T = Σ e_i · ρ_i · c_i    [J/(m²·K)]

R_si e R_se (resistências superficiais interna e externa) NÃO são propriedades
das camadas: são uma convenção de cálculo informada à parte. O mesmo cálculo
existe no front-end (src/dominio/termica.ts); os dois são conferidos pelos
mesmos casos em exemplos/testes/vetores_termicos.json.
"""

from dataclasses import dataclass


@dataclass
class CamadaTermica:
    espessura: float | None  # m
    condutividade: float | None  # W/(m·K)
    densidade: float | None = None  # kg/m³
    calor_especifico: float | None = None  # J/(kg·K)


@dataclass
class DesempenhoTermico:
    resistencias: list[float | None]  # por camada, m²·K/W
    resistencia_camadas: float | None  # superfície a superfície
    resistencia_total: float | None  # com R_si e R_se
    transmitancia: float | None  # U, W/(m²·K)
    capacidade_termica: float | None  # J/(m²·K)
    pendencias: list[str]


def _positivo(valor) -> bool:
    return isinstance(valor, int | float) and valor > 0


def calcular_desempenho(
    camadas: list[CamadaTermica], rsi: float | None, rse: float | None
) -> DesempenhoTermico:
    pendencias: list[str] = []
    resistencias: list[float | None] = []
    for i, c in enumerate(camadas, 1):
        if _positivo(c.espessura) and _positivo(c.condutividade):
            resistencias.append(c.espessura / c.condutividade)
        else:
            resistencias.append(None)
            pendencias.append(f"Camada {i}: falta espessura ou condutividade térmica.")
    completo = bool(camadas) and all(r is not None for r in resistencias)
    r_camadas = sum(resistencias) if completo else None
    if not camadas:
        pendencias.append("A composição não tem camadas.")

    r_total = None
    if r_camadas is not None:
        if rsi is None or rse is None:
            pendencias.append("Faltam as resistências superficiais (R_si e R_se).")
        else:
            r_total = rsi + r_camadas + rse

    capacidade = None
    if camadas and all(
        _positivo(c.espessura) and _positivo(c.densidade) and _positivo(c.calor_especifico)
        for c in camadas
    ):
        capacidade = sum(c.espessura * c.densidade * c.calor_especifico for c in camadas)
    elif camadas:
        pendencias.append("Capacidade térmica: falta densidade ou calor específico.")

    return DesempenhoTermico(
        resistencias=resistencias,
        resistencia_camadas=r_camadas,
        resistencia_total=r_total,
        transmitancia=1 / r_total if r_total else None,
        capacidade_termica=capacidade,
        pendencias=pendencias,
    )
