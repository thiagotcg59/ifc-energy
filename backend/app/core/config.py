"""Configuração lida de variáveis de ambiente (ou do arquivo .env da raiz).

Todas as variáveis começam com IFC_ENERGY_ ; veja o arquivo .env.example.
"""

from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

RAIZ = Path(__file__).resolve().parents[3]


class Configuracao(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="IFC_ENERGY_", env_file=RAIZ / ".env", extra="ignore"
    )

    energyplus_dir: Path = Path(r"C:\EnergyPlusV26-2-0")
    dados_dir: Path = Path("dados")
    clima_dir: Path = Path("dados/clima")
    exemplo_epjson: Path = Path("exemplos/energyplus/casa_unifamiliar_eua.epJSON")
    exemplo_ifc: Path = Path("exemplos/ifc/residencia_exemplo.ifc")
    nivel_log: str = "INFO"

    @model_validator(mode="after")
    def _caminhos_relativos_partem_da_raiz(self):
        for campo in ("dados_dir", "clima_dir", "exemplo_epjson", "exemplo_ifc"):
            valor = getattr(self, campo)
            if not valor.is_absolute():
                setattr(self, campo, RAIZ / valor)
        return self

    @property
    def banco(self) -> Path:
        return self.dados_dir / "ifc-energy.sqlite"

    @property
    def modelos_dir(self) -> Path:
        return self.dados_dir / "modelos"

    @property
    def execucoes_dir(self) -> Path:
        return self.dados_dir / "execucoes"
