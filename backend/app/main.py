"""Monta a aplicação FastAPI.

Iniciar manualmente:  uv run uvicorn app.main:app --port 8000
(o iniciar.ps1 da raiz já faz isso)
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.v1.rotas import rotas
from app.core.config import Configuracao
from app.core.logs import configurar_logs
from app.core.versoes import VERSAO_APP
from app.persistencia.banco import RepositorioSimulacoes
from app.servicos.energyplus import MotorEnergyPlus
from app.servicos.simulacao import FilaSimulacoes, ServicoSimulacao


def criar_app(
    configuracao: Configuracao | None = None,
    *,
    motor: MotorEnergyPlus | None = None,
    iniciar_fila: bool = True,
) -> FastAPI:
    cfg = configuracao or Configuracao()
    configurar_logs(cfg.nivel_log)

    @asynccontextmanager
    async def ciclo_de_vida(app: FastAPI):
        repositorio = RepositorioSimulacoes(cfg.banco)
        repositorio.marcar_interrompidas()
        app.state.repositorio = repositorio
        app.state.motor = motor or MotorEnergyPlus(cfg.energyplus_dir)
        app.state.servico_simulacao = ServicoSimulacao(
            repositorio, app.state.motor, cfg.execucoes_dir, cfg.exemplo_epjson
        )
        app.state.fila = FilaSimulacoes(app.state.servico_simulacao)
        if iniciar_fila:
            app.state.fila.iniciar()
        yield
        app.state.fila.parar()

    app = FastAPI(
        title="ifc-energy",
        version=VERSAO_APP,
        description="Simulação termoenergética de casas unifamiliares a partir de IFC.",
        lifespan=ciclo_de_vida,
        docs_url="/api/v1/docs",
        openapi_url="/api/v1/openapi.json",
        redoc_url=None,
    )
    app.include_router(rotas)
    return app


app = criar_app()
