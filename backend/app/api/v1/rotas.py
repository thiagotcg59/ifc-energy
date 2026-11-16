"""Rotas de /api/v1: só validação e chamada de serviços."""

from fastapi import APIRouter, HTTPException, Request

from app.api.v1.esquemas import Erro, EstadoEnergyPlus, Saude, Simulacao
from app.core.versoes import ENERGYPLUS_VERSAO, VERSAO_APP
from app.servicos.energyplus import EnergyPlusIndisponivel
from app.servicos.resultados import ConsumoAnual

rotas = APIRouter(prefix="/api/v1")


@rotas.get("/saude", response_model=Saude, tags=["sistema"], summary="Estado do sistema")
def saude(request: Request) -> Saude:
    motor = request.app.state.motor
    encontrado = motor.disponivel()
    versao = motor.versao() if encontrado else None
    if not encontrado:
        mensagem = (
            f"EnergyPlus não encontrado em {motor.pasta}. Instale o EnergyPlus"
            f" {ENERGYPLUS_VERSAO} ou informe a pasta na variável"
            " IFC_ENERGY_ENERGYPLUS_DIR do arquivo .env e reinicie."
        )
    elif versao != ENERGYPLUS_VERSAO:
        mensagem = (
            f"EnergyPlus {versao} encontrado, mas o projeto foi testado com a versão"
            f" {ENERGYPLUS_VERSAO}. Os resultados podem diferir."
        )
    else:
        mensagem = f"EnergyPlus {versao} pronto."
    return Saude(
        estado="ok",
        versao=VERSAO_APP,
        energyplus=EstadoEnergyPlus(
            encontrado=encontrado,
            versao=versao,
            versao_esperada=ENERGYPLUS_VERSAO,
            pasta=str(motor.pasta),
            mensagem=mensagem,
        ),
    )


@rotas.post(
    "/simulacoes/exemplo",
    response_model=Simulacao,
    status_code=202,
    responses={503: {"model": Erro}},
    tags=["simulações"],
    summary="Coloca na fila a simulação da casa de exemplo",
)
def simular_exemplo(request: Request) -> Simulacao:
    try:
        registro = request.app.state.servico_simulacao.criar_exemplo()
    except EnergyPlusIndisponivel as erro:
        raise HTTPException(status_code=503, detail=str(erro)) from erro
    request.app.state.fila.avisar()
    return Simulacao.de_registro(registro)


@rotas.get(
    "/simulacoes",
    response_model=list[Simulacao],
    tags=["simulações"],
    summary="Últimas simulações, da mais recente para a mais antiga",
)
def listar_simulacoes(request: Request) -> list[Simulacao]:
    return [Simulacao.de_registro(r) for r in request.app.state.repositorio.listar()]


def _obter(request: Request, sim_id: str):
    registro = request.app.state.repositorio.obter(sim_id)
    if registro is None:
        raise HTTPException(
            status_code=404,
            detail="Simulação não encontrada. Confira o identificador ou inicie uma nova.",
        )
    return registro


@rotas.get(
    "/simulacoes/{sim_id}",
    response_model=Simulacao,
    responses={404: {"model": Erro}},
    tags=["simulações"],
    summary="Estado de uma simulação",
)
def estado_da_simulacao(request: Request, sim_id: str) -> Simulacao:
    return Simulacao.de_registro(_obter(request, sim_id))


@rotas.get(
    "/simulacoes/{sim_id}/resultados",
    response_model=ConsumoAnual,
    responses={404: {"model": Erro}, 409: {"model": Erro}},
    tags=["simulações"],
    summary="Consumo anual por uso final",
)
def resultados_da_simulacao(request: Request, sim_id: str) -> ConsumoAnual:
    registro = _obter(request, sim_id)
    if registro.estado == "falhou":
        raise HTTPException(
            status_code=409,
            detail="Esta simulação falhou e não tem resultados. Veja os erros no estado"
            " da simulação e inicie uma nova.",
        )
    if registro.resultado is None:
        raise HTTPException(
            status_code=409,
            detail="A simulação ainda não terminou. Aguarde o estado 'concluida'.",
        )
    return ConsumoAnual.model_validate(registro.resultado)
