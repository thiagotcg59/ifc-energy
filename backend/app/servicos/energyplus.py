"""Acesso ao EnergyPlus instalado no Windows (roda como programa separado)."""

import json
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

Modo = Literal["dias_de_projeto", "anual"]
_OPCAO_DO_MODO = {"dias_de_projeto": "--design-day", "anual": "--annual"}
TEMPO_LIMITE_S = 60 * 60


class EnergyPlusIndisponivel(RuntimeError):
    pass


@dataclass
class ResultadoExecucao:
    sucesso: bool
    avisos: int
    erros_graves: int
    mensagens: list[str] = field(default_factory=list)


class MotorEnergyPlus:
    def __init__(self, pasta: Path):
        self.pasta = Path(pasta)

    @property
    def executavel(self) -> Path:
        return self.pasta / ("energyplus.exe" if sys.platform == "win32" else "energyplus")

    def disponivel(self) -> bool:
        return self.executavel.is_file()

    def versao(self) -> str | None:
        """Ex.: '26.2.0' (lido de ``energyplus --version``)."""
        if not self.disponivel():
            return None
        saida = self._rodar([str(self.executavel), "--version"], tempo=30).stdout
        achado = re.search(r"Version (\d+\.\d+\.\d+)", saida)
        return achado.group(1) if achado else None

    def carregar_esquema(self) -> dict:
        caminho = self.pasta / "Energy+.schema.epJSON"
        return json.loads(caminho.read_text(encoding="utf-8"))

    def clima_do_exemplo(self) -> Path:
        """Clima de Chicago que acompanha a instalação (usado só pelo exemplo)."""
        return self.pasta / "WeatherData" / "USA_IL_Chicago-OHare.Intl.AP.725300_TMY3.epw"

    def executar(
        self, entrada: Path, clima: Path, pasta_saida: Path, modo: Modo
    ) -> ResultadoExecucao:
        if not self.disponivel():
            raise EnergyPlusIndisponivel(f"EnergyPlus não encontrado em {self.pasta}")
        pasta_saida.mkdir(parents=True, exist_ok=True)
        comando = [
            str(self.executavel),
            _OPCAO_DO_MODO[modo],
            "--weather",
            str(clima),
            "--output-directory",
            str(pasta_saida),
            str(entrada),
        ]
        try:
            self._rodar(comando, tempo=TEMPO_LIMITE_S, cwd=pasta_saida)
        except subprocess.TimeoutExpired:
            return ResultadoExecucao(
                sucesso=False,
                avisos=0,
                erros_graves=1,
                mensagens=[f"O EnergyPlus passou do tempo limite de {TEMPO_LIMITE_S // 60} min."],
            )
        return ler_resultado_da_execucao(pasta_saida)

    @staticmethod
    def _rodar(comando: list[str], tempo: int, cwd: Path | None = None):
        sem_janela = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        return subprocess.run(
            comando,
            capture_output=True,
            text=True,
            errors="replace",
            timeout=tempo,
            cwd=cwd,
            creationflags=sem_janela,
        )


def ler_resultado_da_execucao(pasta_saida: Path) -> ResultadoExecucao:
    """Interpreta eplusout.end (resumo) e eplusout.err (mensagens)."""
    fim = pasta_saida / "eplusout.end"
    resumo = fim.read_text(encoding="utf-8", errors="replace") if fim.is_file() else ""
    contagem = re.search(r"(\d+) Warning; (\d+) Severe Errors", resumo)
    avisos, graves = (int(contagem.group(1)), int(contagem.group(2))) if contagem else (0, 0)
    sucesso = "Completed Successfully" in resumo and graves == 0

    mensagens: list[str] = []
    err = pasta_saida / "eplusout.err"
    if err.is_file():
        for linha in err.read_text(encoding="utf-8", errors="replace").splitlines():
            if "** Severe  **" in linha or "**  Fatal  **" in linha:
                mensagens.append(linha.strip())
    if not sucesso and not mensagens:
        mensagens.append(resumo.strip() or "O EnergyPlus terminou sem gravar o arquivo de resumo.")
    return ResultadoExecucao(
        sucesso=sucesso, avisos=avisos, erros_graves=graves, mensagens=mensagens[:30]
    )
