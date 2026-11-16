"""Modelos IFC abertos na plataforma: guarda o arquivo, a análise e os ajustes.

Tudo fica em dados/modelos/<id>/ no computador do usuário (nunca vai ao git):
  modelo.ifc     cópia do arquivo original (nunca é alterado)
  analise.json   modelo de inspeção + modelo térmico (cache)
  ajustes.json   parâmetros editados pelo usuário, separados do IFC
"""

import hashlib
import json
import logging
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from app.dominio.modelo_bim import Material, ModeloBim, Valor, ler_modelo_bim
from app.dominio.modelo_termico import ModeloTermico, montar_modelo_termico

log = logging.getLogger(__name__)
VERSAO_DA_ANALISE = 1
BIBLIOTECA = Path(__file__).resolve().parents[1] / "dominio" / "dados" / "biblioteca_materiais.json"


class ErroModelo(ValueError):
    """Arquivo recusado; a mensagem diz o que fazer."""


class ModeloAnalise(BaseModel):
    id: str
    origem: Literal["exemplo", "upload"]
    versao: int = VERSAO_DA_ANALISE
    bim: ModeloBim
    termico: ModeloTermico


class CamadaAjustada(BaseModel):
    material_id: str | None
    nome: str | None = None
    espessura: Valor


class ResistenciasSuperficiais(BaseModel):
    rsi: float | None = None
    rse: float | None = None


class Alteracao(BaseModel):
    quando: str
    alvo: str
    campo: str
    de: float | str | None = None
    para: float | str | None = None


class Ajustes(BaseModel):
    """Parâmetros editados pelo usuário. O IFC original nunca é modificado."""

    versao: int = 1
    materiais: dict[str, dict[str, Valor]] = {}
    materiais_novos: list[Material] = []
    camadas: dict[str, list[CamadaAjustada]] = {}
    aberturas: dict[str, dict[str, Valor]] = {}
    resistencias_superficiais: dict[str, ResistenciasSuperficiais] = {}
    historico: list[Alteracao] = []


class ServicoModelos:
    def __init__(self, pasta: Path, exemplo_ifc: Path):
        self.pasta = Path(pasta)
        self.exemplo_ifc = Path(exemplo_ifc)

    def _dir(self, modelo_id: str) -> Path:
        if not modelo_id.isalnum():  # o id vira nome de pasta: só letras e números
            raise ErroModelo("Identificador de modelo inválido.")
        return self.pasta / modelo_id

    def abrir_exemplo(self) -> ModeloAnalise:
        return self._registrar(self.exemplo_ifc.name, self.exemplo_ifc.read_bytes(), "exemplo")

    def importar(self, nome: str, conteudo: bytes) -> ModeloAnalise:
        if not nome.lower().endswith(".ifc"):
            raise ErroModelo(
                "O arquivo precisa ter a extensão .ifc. Exporte o modelo do Revit em IFC4 (não"
                " compactado) e tente de novo."
            )
        if not conteudo.lstrip().startswith(b"ISO-10303-21"):
            raise ErroModelo(
                "O arquivo não parece ser um IFC em texto (formato STEP). Confira se ele não"
                " está compactado (.ifczip) e exporte de novo em IFC4."
            )
        return self._registrar(Path(nome).name, conteudo, "upload")

    def _registrar(self, nome: str, conteudo: bytes, origem) -> ModeloAnalise:
        modelo_id = hashlib.sha256(conteudo).hexdigest()[:16]
        pasta = self._dir(modelo_id)
        existente = self.obter(modelo_id)
        if existente:
            return existente
        pasta.mkdir(parents=True, exist_ok=True)
        # O nome original fica só no JSON; no disco o arquivo tem nome fixo.
        (pasta / "modelo.ifc").write_bytes(conteudo)
        try:
            bim = ler_modelo_bim(pasta / "modelo.ifc")
        except Exception as erro:  # noqa: BLE001 - qualquer falha de leitura vira mensagem
            log.exception("Falha ao ler o IFC %s", nome)
            (pasta / "modelo.ifc").unlink(missing_ok=True)
            raise ErroModelo(
                "Não foi possível ler o arquivo IFC. Abra-o em um visualizador IFC para"
                f" conferir se está íntegro e exporte de novo. Detalhe técnico: {erro}"
            ) from erro
        bim.arquivo = nome
        analise = ModeloAnalise(
            id=modelo_id, origem=origem, bim=bim, termico=montar_modelo_termico(bim)
        )
        (pasta / "analise.json").write_text(analise.model_dump_json(), encoding="utf-8")
        return analise

    def obter(self, modelo_id: str) -> ModeloAnalise | None:
        arquivo = self._dir(modelo_id) / "analise.json"
        if not arquivo.is_file():
            return None
        dados = json.loads(arquivo.read_text(encoding="utf-8"))
        if dados.get("versao") != VERSAO_DA_ANALISE:
            return None  # análise de uma versão antiga da plataforma: refaz
        return ModeloAnalise.model_validate(dados)

    def caminho_ifc(self, modelo_id: str) -> Path | None:
        arquivo = self._dir(modelo_id) / "modelo.ifc"
        return arquivo if arquivo.is_file() else None

    def obter_ajustes(self, modelo_id: str) -> Ajustes:
        arquivo = self._dir(modelo_id) / "ajustes.json"
        if not arquivo.is_file():
            return Ajustes()
        return Ajustes.model_validate_json(arquivo.read_text(encoding="utf-8"))

    def salvar_ajustes(self, modelo_id: str, ajustes: Ajustes) -> Ajustes:
        (self._dir(modelo_id) / "ajustes.json").write_text(
            ajustes.model_dump_json(indent=1), encoding="utf-8"
        )
        return ajustes


def ler_biblioteca() -> dict:
    return json.loads(BIBLIOTECA.read_text(encoding="utf-8"))
