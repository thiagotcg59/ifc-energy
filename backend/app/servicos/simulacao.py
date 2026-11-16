"""Simulação em segundo plano.

A requisição HTTP só coloca a simulação na fila (tabela do SQLite) e responde
na hora. Uma linha de execução separada (``FilaSimulacoes``) pega um item por
vez e chama o EnergyPlus. Decisão registrada em docs/decisoes/0003.
"""

import json
import logging
import threading
from pathlib import Path

from app.dominio.epjson import configurar_saidas, definir_periodo_anual, validar_contra_esquema
from app.persistencia.banco import RegistroSimulacao, RepositorioSimulacoes
from app.servicos.energyplus import EnergyPlusIndisponivel, MotorEnergyPlus
from app.servicos.resultados import ler_consumo_anual

log = logging.getLogger(__name__)


class ServicoSimulacao:
    def __init__(
        self,
        repositorio: RepositorioSimulacoes,
        motor: MotorEnergyPlus,
        pasta_execucoes: Path,
        exemplo_epjson: Path,
    ):
        self.repositorio = repositorio
        self.motor = motor
        self.pasta_execucoes = Path(pasta_execucoes)
        self.exemplo_epjson = Path(exemplo_epjson)

    def criar_exemplo(self) -> RegistroSimulacao:
        if not self.motor.disponivel():
            raise EnergyPlusIndisponivel(
                f"EnergyPlus não encontrado em {self.motor.pasta}. Instale o EnergyPlus ou"
                " informe a pasta na variável IFC_ENERGY_ENERGYPLUS_DIR do arquivo .env."
            )
        return self.repositorio.criar("exemplo")

    def processar(self, sim_id: str) -> None:
        """Roda uma simulação da fila até o fim. Nunca lança exceção."""
        try:
            self._processar(sim_id)
        except Exception as erro:  # noqa: BLE001 - a fila não pode morrer
            log.exception("Falha inesperada na simulação %s", sim_id)
            self.repositorio.atualizar(
                sim_id,
                estado="falhou",
                mensagem="Erro inesperado ao simular. Veja o detalhe abaixo e o terminal"
                " do backend; se persistir, guarde a mensagem para investigarmos.",
                detalhes=[f"{type(erro).__name__}: {erro}"],
            )

    def _processar(self, sim_id: str) -> None:
        atualizar = self.repositorio.atualizar
        pasta = self.pasta_execucoes / sim_id
        pasta.mkdir(parents=True, exist_ok=True)

        # 1) Validar o epJSON contra o esquema da versão instalada.
        atualizar(sim_id, estado="validando", mensagem="Validando o arquivo de entrada.")
        original = json.loads(self.exemplo_epjson.read_text(encoding="utf-8"))
        epjson = configurar_saidas(definir_periodo_anual(original))
        erros = validar_contra_esquema(epjson, self.motor.carregar_esquema())
        if erros:
            atualizar(
                sim_id,
                estado="falhou",
                mensagem="O arquivo de entrada não passou na validação do esquema do"
                " EnergyPlus. Corrija os campos listados abaixo.",
                detalhes=erros,
            )
            return
        entrada = pasta / "entrada.epJSON"
        entrada.write_text(json.dumps(epjson, indent=1), encoding="utf-8")
        clima = self.motor.clima_do_exemplo()

        # 2) Dias de projeto (rápido): pega erros antes da simulação longa.
        atualizar(sim_id, estado="dias_de_projeto", mensagem="Simulando os dias de projeto.")
        previa = self.motor.executar(entrada, clima, pasta / "dias_de_projeto", "dias_de_projeto")
        if not previa.sucesso:
            atualizar(
                sim_id,
                estado="falhou",
                mensagem="O EnergyPlus encontrou erros nos dias de projeto; a simulação"
                " anual não foi iniciada. Veja os erros abaixo.",
                detalhes=previa.mensagens,
            )
            return

        # 3) Simulação anual.
        atualizar(sim_id, estado="anual", mensagem="Simulando o ano inteiro.")
        anual = self.motor.executar(entrada, clima, pasta / "anual", "anual")
        if not anual.sucesso:
            atualizar(
                sim_id,
                estado="falhou",
                mensagem="O EnergyPlus encontrou erros na simulação anual. Veja os erros abaixo.",
                detalhes=anual.mensagens,
            )
            return

        # 4) Resultados.
        consumo = ler_consumo_anual(pasta / "anual" / "eplusout.sql")
        atualizar(
            sim_id,
            estado="concluida",
            mensagem=f"Simulação concluída com {anual.avisos} aviso(s) do EnergyPlus.",
            resultado=consumo.model_dump(),
        )


class FilaSimulacoes:
    """Linha de execução que processa a fila, uma simulação por vez."""

    def __init__(self, servico: ServicoSimulacao, intervalo_s: float = 1.0):
        self.servico = servico
        self.intervalo_s = intervalo_s
        self._acordar = threading.Event()
        self._parar = threading.Event()
        self._linha: threading.Thread | None = None

    def iniciar(self) -> None:
        self._linha = threading.Thread(target=self._laco, name="fila-simulacoes", daemon=True)
        self._linha.start()

    def avisar(self) -> None:
        """Chamado quando entra algo novo na fila, para não esperar o intervalo."""
        self._acordar.set()

    def parar(self) -> None:
        self._parar.set()
        self._acordar.set()
        if self._linha:
            self._linha.join(timeout=5)

    def _laco(self) -> None:
        while not self._parar.is_set():
            registro = self.servico.repositorio.proxima_na_fila()
            if registro is None:
                self._acordar.wait(self.intervalo_s)
                self._acordar.clear()
                continue
            log.info("Iniciando simulação %s", registro.id)
            self.servico.processar(registro.id)
