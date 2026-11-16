"""Formatos de resposta da API (viram o OpenAPI e os tipos do front-end)."""

from typing import Literal

from pydantic import BaseModel

from app.persistencia.banco import RegistroSimulacao

EstadoSimulacao = Literal["na_fila", "validando", "dias_de_projeto", "anual", "concluida", "falhou"]


class EstadoEnergyPlus(BaseModel):
    encontrado: bool
    versao: str | None
    versao_esperada: str
    pasta: str
    mensagem: str


class Saude(BaseModel):
    estado: Literal["ok"]
    versao: str
    energyplus: EstadoEnergyPlus


class Simulacao(BaseModel):
    id: str
    tipo: str
    estado: EstadoSimulacao
    mensagem: str
    detalhes: list[str]
    criado_em: str
    atualizado_em: str

    @classmethod
    def de_registro(cls, r: RegistroSimulacao) -> "Simulacao":
        return cls(
            id=r.id,
            tipo=r.tipo,
            estado=r.estado,
            mensagem=r.mensagem,
            detalhes=r.detalhes,
            criado_em=r.criado_em,
            atualizado_em=r.atualizado_em,
        )


class Erro(BaseModel):
    detail: str
