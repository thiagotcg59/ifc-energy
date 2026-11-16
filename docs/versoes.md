# Versões registradas

Ferramentas externas com que o projeto foi testado. As bibliotecas Python e
JavaScript têm a versão exata travada em `backend/uv.lock` e
`frontend/package-lock.json`.

| Ferramenta | Versão | Onde fica | Observação |
|---|---|---|---|
| EnergyPlus | 26.2.0 (build 4bd7a1f26f) | `C:\EnergyPlusV26-2-0` | Versão ".zip" oficial, só descompactada. SHA-256 do zip: `15ab698803f459444ec3e97ee52ab9f99db93a583819c7821b17dfcd7b4461e7` |
| Python | 3.11 | gerenciado pelo `uv` | Fixado em `backend/.python-version` |
| uv | 0.12.10 | — | |
| Node.js | 24.15.0 | — | Fixado em `frontend/.nvmrc` |
| IfcOpenShell | 0.9.0.post1 | `backend/uv.lock` | Leitura do IFC e geração do IFC de exemplo |
| web-ifc | 0.0.79 | `frontend/package-lock.json` | Leitura da geometria IFC no navegador (MPL-2.0) |
| three.js | 0.187.0 | `frontend/package-lock.json` | Desenho 3D (MIT) |

A versão do EnergyPlus também está em `backend/app/core/versoes.py`; a tela
inicial avisa se a versão instalada for diferente.

## Como trocar a versão do EnergyPlus

1. Descompactar a nova versão em `C:\EnergyPlusVxx-x-x`.
2. Ajustar `IFC_ENERGY_ENERGYPLUS_DIR` no `.env`.
3. Atualizar `ENERGYPLUS_VERSAO` em `backend/app/core/versoes.py` e esta
   tabela.
4. Reconverter o exemplo (ver `exemplos/energyplus/LEIA-ME.md`).
5. Rodar `uv run pytest -m energyplus` na pasta `backend`.
