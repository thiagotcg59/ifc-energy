# Progresso

Atualizado a cada tarefa concluída: o que foi feito, como verificar e o que
vem depois. As mais recentes ficam no topo.

- Repositório: https://github.com/thiagotcg59/ifc-energy
- Demonstração: https://thiagotcg59.github.io/ifc-energy/

## Fase 1 — Fundação (em andamento)

### 1.2 Backend com o exemplo do EnergyPlus de ponta a ponta

**Feito**

- API em `/api/v1` (FastAPI): `saude`, `simulacoes/exemplo`, `simulacoes`,
  `simulacoes/{id}` e `simulacoes/{id}/resultados`.
- Simulação em segundo plano: fila no SQLite, uma thread processa
  (decisão [0003](decisoes/0003-fila-de-simulacoes.md)).
- Antes de simular: validação do epJSON contra o esquema da versão instalada
  e simulação dos dias de projeto; só então a simulação anual.
- Leitura do consumo anual por uso final a partir do `eplusout.sql`.
- Dados do modo demonstração gerados pelo backend real em `exemplos/demo/`.
- 25 testes rápidos e 3 testes com o EnergyPlus real.

**Como verificar**

```powershell
cd C:\Projetos\ifc-energy\backend
uv run pytest                 # 25 passam em ~1 s
uv run pytest -m energyplus   # 3 passam em ~15 s (roda o EnergyPlus)
```

### 1.1 Repositório, regras e EnergyPlus

**Feito**

- Pasta `C:\Projetos\ifc-energy` (fora do OneDrive) e repositório público no
  GitHub.
- `.gitignore` criado antes do primeiro commit (bloqueia IFCs reais,
  `dados/`, saídas do EnergyPlus, `.env` e arquivos climáticos).
- Regras gravadas em `AGENTS.md` e `.agents/rules/`.
- EnergyPlus 26.2.0 descompactado em `C:\EnergyPlusV26-2-0`, com o hash do
  arquivo conferido com o publicado ([versões](versoes.md)).
- Decisões [0001](decisoes/0001-pilha-e-ferramentas.md) e
  [0002](decisoes/0002-energyplus-26-2-e-exemplo.md).

**Como verificar**

```powershell
C:\EnergyPlusV26-2-0\energyplus.exe --version   # deve mostrar 26.2.0
cd C:\Projetos\ifc-energy
git log --oneline
```

## O que vem depois

- 1.3 Front-end (tela inicial, botão "Simular exemplo", painel de consumo) e
  modo demonstração.
- 1.4 CI e publicação no GitHub Pages.
- 1.5 `iniciar.ps1` e capturas de tela.
- Aceite da fase 1 e tag `v0.1.0`.
