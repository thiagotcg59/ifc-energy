# ifc-energy

[![CI](https://github.com/thiagotcg59/ifc-energy/actions/workflows/ci.yml/badge.svg)](https://github.com/thiagotcg59/ifc-energy/actions/workflows/ci.yml)

Aplicação web que recebe o arquivo IFC de uma casa unifamiliar e faz a
simulação termoenergética com o [EnergyPlus](https://energyplus.net/).
Roda no seu próprio computador com Windows (localhost): **o IFC nunca sai da
máquina**.

**Demonstração (sem backend, com dados de exemplo):**
https://thiagotcg59.github.io/ifc-energy/

## Estado das fases

| Fase | Conteúdo | Estado |
|---|---|---|
| 1 | Repositório, CI, Pages e um exemplo do EnergyPlus de ponta a ponta | 🔧 aguardando aceite |
| 2 | IFC de um único ambiente → modelo térmico → epJSON | ⏳ |
| 3 | Casa completa: adjacências, aberturas e materiais | ⏳ |
| 4 | Interface, visualizador 3D e formulários | ⏳ |
| 5 | Cenários de retrofit | ⏳ |
| 6 | Ventilação natural | ⏳ |
| 7 | Split real | ⏳ |
| 8 | Normas (INI-R e NBR 15575) | ⏳ |

O andamento detalhado fica em [docs/PROGRESSO.md](docs/PROGRESSO.md).

## Como rodar no Windows

Pré-requisitos (versões em [docs/versoes.md](docs/versoes.md)):

- [Git](https://git-scm.com/download/win)
- [uv](https://docs.astral.sh/uv/) (gerencia o Python do projeto)
- [Node.js](https://nodejs.org/) 24
- [EnergyPlus 26.2.0](https://github.com/NatLabRockies/EnergyPlus/releases/tag/v26.2.0)
  em `C:\EnergyPlusV26-2-0`

No PowerShell:

```powershell
git clone https://github.com/thiagotcg59/ifc-energy.git
cd ifc-energy
.\iniciar.ps1
```

O `iniciar.ps1` instala as dependências do projeto (só dentro da pasta do
projeto), inicia o backend e o front-end e abre http://localhost:5173 no
navegador. Para parar, pressione `Ctrl+C` na janela do PowerShell.

Se o PowerShell recusar o script, rode uma vez:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Se o EnergyPlus estiver em outra pasta, copie `.env.example` para `.env` e
ajuste `IFC_ENERGY_ENERGYPLUS_DIR`.

## Testes

```powershell
cd backend
uv run pytest                 # rápidos (não precisam do EnergyPlus)
uv run pytest -m energyplus   # rodam o EnergyPlus de verdade (~15 s)
cd ..\frontend
npm test
```

## Organização

```
backend/    API (FastAPI), domínio, serviços, persistência e testes
frontend/   Interface (React + TypeScript + Vite)
docs/       Especificações, decisões, capturas de tela e PROGRESSO.md
exemplos/   IFCs sintéticos e dados do modo demonstração
dados/      Uploads e execuções — fica só no seu computador
.agents/    Regras do projeto para assistentes de programação
```

A documentação interativa da API fica em http://localhost:8000/api/v1/docs
quando o backend está rodando.
