"""Banco SQLite: guarda a fila e o histórico das simulações."""

import json
import sqlite3
import uuid
from contextlib import closing
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

TABELAS = """
CREATE TABLE IF NOT EXISTS simulacoes (
    ordem          INTEGER PRIMARY KEY AUTOINCREMENT,
    id             TEXT NOT NULL UNIQUE,
    tipo           TEXT NOT NULL,
    estado         TEXT NOT NULL,
    mensagem       TEXT NOT NULL DEFAULT '',
    detalhes_json  TEXT NOT NULL DEFAULT '[]',
    resultado_json TEXT,
    criado_em      TEXT NOT NULL,
    atualizado_em  TEXT NOT NULL
);
"""

ESTADOS_EM_ANDAMENTO = ("validando", "dias_de_projeto", "anual")


@dataclass
class RegistroSimulacao:
    id: str
    tipo: str
    estado: str
    mensagem: str
    detalhes: list[str]
    resultado: dict | None
    criado_em: str
    atualizado_em: str


def _agora() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


class RepositorioSimulacoes:
    def __init__(self, caminho: Path):
        self.caminho = Path(caminho)
        self.caminho.parent.mkdir(parents=True, exist_ok=True)
        self._executar(TABELAS)

    def _conectar(self) -> sqlite3.Connection:
        con = sqlite3.connect(self.caminho, timeout=10)
        con.row_factory = sqlite3.Row
        return con

    def _executar(self, sql: str, parametros: tuple = ()) -> None:
        with closing(self._conectar()) as con, con:
            con.execute(sql, parametros)

    def _consultar(self, sql: str, parametros: tuple = ()) -> list[RegistroSimulacao]:
        with closing(self._conectar()) as con:
            linhas = con.execute(sql, parametros).fetchall()
        return [
            RegistroSimulacao(
                id=linha["id"],
                tipo=linha["tipo"],
                estado=linha["estado"],
                mensagem=linha["mensagem"],
                detalhes=json.loads(linha["detalhes_json"]),
                resultado=json.loads(linha["resultado_json"]) if linha["resultado_json"] else None,
                criado_em=linha["criado_em"],
                atualizado_em=linha["atualizado_em"],
            )
            for linha in linhas
        ]

    def criar(self, tipo: str) -> RegistroSimulacao:
        sim_id = uuid.uuid4().hex[:12]
        agora = _agora()
        self._executar(
            "INSERT INTO simulacoes (id, tipo, estado, mensagem, criado_em, atualizado_em)"
            " VALUES (?, ?, 'na_fila', 'Aguardando na fila.', ?, ?)",
            (sim_id, tipo, agora, agora),
        )
        return self.obter(sim_id)

    def obter(self, sim_id: str) -> RegistroSimulacao | None:
        achados = self._consultar("SELECT * FROM simulacoes WHERE id = ?", (sim_id,))
        return achados[0] if achados else None

    def listar(self, limite: int = 20) -> list[RegistroSimulacao]:
        return self._consultar("SELECT * FROM simulacoes ORDER BY ordem DESC LIMIT ?", (limite,))

    def proxima_na_fila(self) -> RegistroSimulacao | None:
        achados = self._consultar(
            "SELECT * FROM simulacoes WHERE estado = 'na_fila' ORDER BY ordem LIMIT 1"
        )
        return achados[0] if achados else None

    def atualizar(
        self,
        sim_id: str,
        *,
        estado: str,
        mensagem: str = "",
        detalhes: list[str] | None = None,
        resultado: dict | None = None,
    ) -> None:
        self._executar(
            "UPDATE simulacoes SET estado = ?, mensagem = ?, detalhes_json = ?,"
            " resultado_json = ?, atualizado_em = ? WHERE id = ?",
            (
                estado,
                mensagem,
                json.dumps(detalhes or [], ensure_ascii=False),
                json.dumps(resultado, ensure_ascii=False) if resultado is not None else None,
                _agora(),
                sim_id,
            ),
        )

    def marcar_interrompidas(self) -> None:
        """Ao iniciar o servidor: o que estava rodando foi cortado no meio."""
        marcas = ",".join("?" for _ in ESTADOS_EM_ANDAMENTO)
        self._executar(
            f"UPDATE simulacoes SET estado = 'falhou', atualizado_em = ?,"
            f" mensagem = 'A simulação foi interrompida porque o servidor foi fechado."
            f" Inicie uma nova simulação.' WHERE estado IN ({marcas})",
            (_agora(), *ESTADOS_EM_ANDAMENTO),
        )
