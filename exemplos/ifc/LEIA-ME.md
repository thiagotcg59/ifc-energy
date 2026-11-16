# IFC de exemplo: residência térrea

| Arquivo | O que é |
|---|---|
| `residencia_exemplo.ifc` | IFC4 sintético de uma casa térrea de 70 m² com sala/cozinha, quarto e banheiro |
| `RELATORIO.md` | Entidades, ambientes, composições, elementos e fronteiras (gerado junto com o IFC) |

É o único tipo de IFC que entra no repositório: **sintético, sem dados de
ninguém**. A descrição completa (dimensões, camadas, materiais e fontes) está
em [docs/spec/residencia-exemplo.md](../../docs/spec/residencia-exemplo.md).

> **Modelo didático.** Os valores térmicos vêm dos conjuntos de dados que
> acompanham o EnergyPlus (ASHRAE Handbook of Fundamentals 2005) e não
> comprovam atendimento à NBR 15220, à NBR 15575 nem à INI-R.

## Como usar

- Na plataforma: botão **Explorar residência de exemplo** (na tela inicial ou
  em "Modelo de exemplo", na barra superior).
- Na demonstração: https://thiagotcg59.github.io/ifc-energy/

## Como inspecionar fora da plataforma

Qualquer visualizador IFC abre o arquivo; por exemplo o
[Bonsai (BlenderBIM)](https://bonsaibim.org/) ou o BIMvision, instalados no
seu computador. Para ver as fronteiras de espaço, procure as entidades
`IfcRelSpaceBoundary2ndLevel`.

Pelo PowerShell, com o IfcOpenShell do projeto:

```powershell
cd C:\Projetos\ifc-energy\backend
uv run python -c "import ifcopenshell; f = ifcopenshell.open('../exemplos/ifc/residencia_exemplo.ifc'); print(f.schema, [(s.Name, s.LongName) for s in f.by_type('IfcSpace')])"
```

## Como regenerar

O arquivo **não deve ser editado à mão**. Ele é produzido por um script e um
teste confere que o arquivo versionado é idêntico ao que o script gera:

```powershell
cd C:\Projetos\ifc-energy\backend
uv run python -m ferramentas.gerar_residencia_ifc
uv run python -m app.gerar_demo        # regrava os dados da demonstração
uv run pytest
```

## Conferências feitas

- Validação contra o esquema IFC4, incluindo as regras do esquema
  (`ifcopenshell.validate`): nenhum problema.
- Geometria recalculada pelo IfcOpenShell: volumes dos ambientes e das
  paredes iguais às contas feitas à mão.
- Leitura por um segundo leitor, independente (web-ifc): os mesmos 16
  elementos e 3 ambientes, com os mesmos GlobalIds e dimensões.
- Modelo térmico: zonas fechadas, normais para fora, pares entre zonas e
  aberturas contidas na superfície-mãe.
