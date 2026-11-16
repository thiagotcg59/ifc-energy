"""Gera os dados do modo demonstração em exemplos/demo/.

Roda a simulação de exemplo com o EnergyPlus real e grava as respostas da
API exatamente como o front-end as recebe.

Uso:  uv run python -m app.gerar_demo
"""

import json
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import RAIZ, Configuracao
from app.main import criar_app

DESTINO = RAIZ / "exemplos" / "demo"


def _gravar(nome: str, dados) -> None:
    caminho = DESTINO / nome
    caminho.write_text(json.dumps(dados, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Gravado: {caminho}")


def main() -> None:
    DESTINO.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as pasta:
        app = criar_app(Configuracao(dados_dir=Path(pasta)), iniciar_fila=False)
        with TestClient(app) as cliente:
            saude = cliente.get("/api/v1/saude").json()
            resposta = cliente.post("/api/v1/simulacoes/exemplo")
            resposta.raise_for_status()
            sim_id = resposta.json()["id"]
            app.state.servico_simulacao.processar(sim_id)
            simulacao = cliente.get(f"/api/v1/simulacoes/{sim_id}").json()
            if simulacao["estado"] != "concluida":
                raise SystemExit(f"A simulação de exemplo falhou: {simulacao}")
            resultados = cliente.get(f"/api/v1/simulacoes/{sim_id}/resultados").json()
            modelo = cliente.post("/api/v1/modelos/exemplo").json()
            biblioteca = cliente.get("/api/v1/biblioteca").json()

    simulacao["id"] = "demonstracao"
    _gravar("saude.json", saude)
    _gravar("simulacao.json", simulacao)
    _gravar("resultados.json", resultados)
    _gravar("modelo.json", modelo)
    _gravar("biblioteca.json", biblioteca)


if __name__ == "__main__":
    main()
