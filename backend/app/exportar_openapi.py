"""Grava backend/openapi.json (a descrição da API usada para gerar os tipos
do front-end).  Uso:  uv run python -m app.exportar_openapi
"""

import json
from pathlib import Path

from app.main import app

DESTINO = Path(__file__).resolve().parents[1] / "openapi.json"

if __name__ == "__main__":
    DESTINO.write_text(
        json.dumps(app.openapi(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"Gravado: {DESTINO}")
