"""Registros (logs) no terminal, em formato simples."""

import logging


def configurar_logs(nivel: str = "INFO") -> None:
    logging.basicConfig(
        level=nivel.upper(),
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
