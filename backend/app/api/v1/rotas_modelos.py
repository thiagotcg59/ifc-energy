"""Rotas de modelos IFC: abrir, consultar a análise e guardar os ajustes."""

from typing import Any

from fastapi import APIRouter, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse

from app.api.v1.esquemas import Erro
from app.servicos.modelos import Ajustes, ErroModelo, ModeloAnalise, ler_biblioteca

rotas_modelos = APIRouter(prefix="/api/v1", tags=["modelos"])
LIMITE_BYTES = 300 * 1024 * 1024
NAO_ENCONTRADO = "Modelo não encontrado. Abra o arquivo IFC de novo."


def _servico(request: Request):
    return request.app.state.servico_modelos


def _obter(request: Request, modelo_id: str) -> ModeloAnalise:
    try:
        analise = _servico(request).obter(modelo_id)
    except ErroModelo as erro:
        raise HTTPException(status_code=404, detail=NAO_ENCONTRADO) from erro
    if analise is None:
        raise HTTPException(status_code=404, detail=NAO_ENCONTRADO)
    return analise


@rotas_modelos.post(
    "/modelos/exemplo",
    response_model=ModeloAnalise,
    status_code=201,
    summary="Abre a residência de exemplo (IFC sintético versionado)",
)
def abrir_exemplo(request: Request) -> ModeloAnalise:
    return _servico(request).abrir_exemplo()


@rotas_modelos.post(
    "/modelos",
    response_model=ModeloAnalise,
    status_code=201,
    responses={400: {"model": Erro}, 413: {"model": Erro}},
    summary="Envia um arquivo IFC (fica só neste computador) e devolve a análise",
)
def importar_modelo(request: Request, arquivo: UploadFile) -> ModeloAnalise:
    conteudo = arquivo.file.read(LIMITE_BYTES + 1)
    if len(conteudo) > LIMITE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="O arquivo passa de 300 MB. Exporte só a edificação (sem terreno e"
            " mobiliário) e tente de novo.",
        )
    try:
        return _servico(request).importar(arquivo.filename or "modelo.ifc", conteudo)
    except ErroModelo as erro:
        raise HTTPException(status_code=400, detail=str(erro)) from erro


@rotas_modelos.get(
    "/modelos/{modelo_id}",
    response_model=ModeloAnalise,
    responses={404: {"model": Erro}},
    summary="Análise de um modelo já aberto",
)
def obter_modelo(request: Request, modelo_id: str) -> ModeloAnalise:
    return _obter(request, modelo_id)


@rotas_modelos.get(
    "/modelos/{modelo_id}/ifc",
    responses={404: {"model": Erro}},
    response_class=FileResponse,
    summary="Arquivo IFC original (para o visualizador 3D)",
)
def baixar_ifc(request: Request, modelo_id: str) -> FileResponse:
    _obter(request, modelo_id)
    return FileResponse(_servico(request).caminho_ifc(modelo_id), media_type="application/x-step")


@rotas_modelos.get(
    "/modelos/{modelo_id}/ajustes",
    response_model=Ajustes,
    responses={404: {"model": Erro}},
    summary="Parâmetros editados pelo usuário para este modelo",
)
def obter_ajustes(request: Request, modelo_id: str) -> Ajustes:
    _obter(request, modelo_id)
    return _servico(request).obter_ajustes(modelo_id)


@rotas_modelos.put(
    "/modelos/{modelo_id}/ajustes",
    response_model=Ajustes,
    responses={404: {"model": Erro}},
    summary="Salva os parâmetros editados (o IFC original não é alterado)",
)
def salvar_ajustes(request: Request, modelo_id: str, ajustes: Ajustes) -> Ajustes:
    _obter(request, modelo_id)
    return _servico(request).salvar_ajustes(modelo_id, ajustes)


@rotas_modelos.get(
    "/biblioteca",
    response_model=dict[str, Any],
    summary="Biblioteca técnica de materiais e convenções de cálculo, com as fontes",
)
def biblioteca() -> dict:
    return ler_biblioteca()
