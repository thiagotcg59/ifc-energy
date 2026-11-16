# AGENTS.md — regras do projeto ifc-energy

Aplicação web local (Windows, localhost) que recebe um IFC4 de uma casa
unifamiliar e faz a simulação termoenergética com o EnergyPlus.

O dono do projeto trabalha sozinho e tem nível básico de programação.
**Explique cada decisão em português simples e dê comandos prontos para
PowerShell.** Prefira sempre o simples: sem Docker, SQLite, um único comando
para iniciar tudo (`iniciar.ps1`).

As regras completas estão em [.agents/rules/](.agents/rules/):

| Arquivo | Assunto |
|---|---|
| [01-como-trabalhar.md](.agents/rules/01-como-trabalhar.md) | Fases, testes antes do código, aceite |
| [02-git-e-github.md](.agents/rules/02-git-e-github.md) | Commits, CI, Pages, o que nunca enviar |
| [03-plataforma.md](.agents/rules/03-plataforma.md) | Estrutura, API, interface, dependências |
| [04-dominio.md](.agents/rules/04-dominio.md) | Regras físicas e geométricas, entrada IFC, normas |

## As regras que mais importam

1. **Nada de código antes do plano aprovado.** Cada fase tem um marco
   verificável e termina com o aceite do dono.
2. **Testes antes do código**, com IFCs de referência pequenos e resposta
   conhecida. **Nunca altere o valor esperado de um teste para fazê-lo
   passar**; se achar que está errado, pare e explique.
3. **Nenhum valor físico inventado.** Cada valor da biblioteca tem fonte
   citada e aprovada pelo dono.
4. **Sem IfcSpace: pare** e mostre o relatório do que falta. Não adivinhe
   zonas.
5. **Normas (INI-R, NBR 15575) nunca de memória**: o dono fornece o texto,
   escreve-se a especificação, ele aprova, só então se implementa.
6. **O IFC nunca sai do computador.** Nunca enviar ao GitHub: IFCs reais,
   `dados/`, saídas do EnergyPlus, `.env`. Nunca gravar token ou senha em
   arquivo.
7. **Pergunte antes de instalar qualquer coisa** no computador.
8. Commits pequenos, Conventional Commits em português, só com testes
   passando, push para a `main` após cada commit. Trabalho arriscado em ramo
   curto.
9. A cada tarefa: atualizar `docs/PROGRESSO.md`, verificar a interface no
   navegador, salvar capturas em `docs/capturas/` e passar ao dono o link do
   commit e o da demonstração.
10. Climatização nesta ordem, só avançando com a anterior validada:
    cargas ideais → ventilação natural → split real.

## Comandos do dia a dia (PowerShell)

```powershell
.\iniciar.ps1                         # inicia backend + front-end
cd backend; uv run pytest             # testes rápidos do backend
cd backend; uv run pytest -m energyplus   # testes que rodam o EnergyPlus
cd backend; uv run ruff check .; uv run ruff format --check .
cd frontend; npm test; npm run lint
cd frontend; node scripts/e2e.mjs         # navegador de verdade (iniciar.ps1 aberto)
cd backend; uv run python -m ferramentas.gerar_residencia_ifc   # regenera o IFC de exemplo
cd backend; uv run python -m app.gerar_demo                     # regenera os dados da demonstração
```

## Regras que valem para a interface e os dados térmicos

- Todo valor físico mostra a origem (IFC, calculado, manual, biblioteca,
  não informado). Valor ausente fica ausente; nunca preencher.
- O IFC original nunca é alterado; edições vão para os "ajustes".
- Dados de uso (ocupação, iluminação, equipamentos, setpoints, infiltração)
  só existem quando o dono informa: nenhum valor padrão, nem sugerido.
- Não prometer simulação do IFC enquanto a conversão para epJSON não existir
  e não estiver validada.
- O cálculo térmico existe em Python e em TypeScript; ao mudar um, mudar o
  outro e os casos de `exemplos/testes/vetores_termicos.json`.

## Versões registradas

Ver [docs/versoes.md](docs/versoes.md).
