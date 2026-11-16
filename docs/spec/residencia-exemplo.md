# Especificação — residência de exemplo (IFC4 sintético)

Arquivo: `exemplos/ifc/residencia_exemplo.ifc` · gerador:
`backend/ferramentas/gerar_residencia_ifc.py` · relatório de entidades:
`exemplos/ifc/RELATORIO.md`.

> **Modelo didático.** Serve para testar a plataforma. Os valores térmicos
> vêm de conjuntos de dados genéricos e **não comprovam atendimento** à
> NBR 15220, à NBR 15575 nem à INI-R.

## Geometria

Casa térrea retangular, **10,00 m × 7,00 m** por fora (70 m²), pé-direito
**2,80 m**. Origem no canto externo sudoeste; X = leste, Y = norte, Z = para
cima; norte verdadeiro = +Y. Unidades em metros.

```
        N
   ┌───────────────J1────────────┬──────J4──┐ y = 7,00
   │                              │ 03       │
   │                              P2 Banheiro│
 J2│  01 Sala e cozinha           ├──────────┤ y = 4,60 a 4,72 (parede PI-2)
   │                              │ 02       │J3
   │                              P1 Quarto  │
   └──P0──────J5─────────────────┴──────────┘ y = 0
  x = 0                    x = 6,00 a 6,12 (parede PI-1)      x = 10,00
```

| Ambiente | Faces internas (x; y) | Área | Volume |
|---|---|---|---|
| 01 Sala e cozinha | 0,15 a 6,00; 0,15 a 6,85 | 5,85 × 6,70 = **39,195 m²** | × 2,80 = **109,746 m³** |
| 02 Quarto | 6,12 a 9,85; 0,15 a 4,60 | 3,73 × 4,45 = **16,5985 m²** | **46,4758 m³** |
| 03 Banheiro | 6,12 a 9,85; 4,72 a 6,85 | 3,73 × 2,13 = **7,9449 m²** | **22,24572 m³** |

| Abertura | Onde | Largura × altura | Peitoril |
|---|---|---|---|
| P0 Porta de entrada | parede sul, x 1,00 a 1,90 | 0,90 × 2,10 | 0 |
| J5 Janela da sala (sul) | parede sul, x 3,50 a 5,00 | 1,50 × 1,20 | 1,00 |
| J2 Janela da sala (oeste) | parede oeste, y 2,50 a 4,00 | 1,50 × 1,20 | 1,00 |
| J1 Janela da sala (norte) | parede norte, x 2,00 a 4,00 | 2,00 × 1,20 | 1,00 |
| J4 Janela do banheiro (norte) | parede norte, x 7,50 a 8,10 | 0,60 × 0,60 | 1,60 |
| J3 Janela do quarto (leste) | parede leste, y 1,50 a 3,00 | 1,50 × 1,20 | 1,00 |
| P1 Porta do quarto | parede PI-1, y 1,00 a 1,80 | 0,80 × 2,10 | 0 |
| P2 Porta do banheiro | parede PI-1, y 5,20 a 5,90 | 0,70 × 2,10 | 0 |

## Composições (camadas de fora para dentro)

| Elemento | Camadas |
|---|---|
| Parede externa (15 cm) | argamassa 2,5 cm · tijolo cerâmico 10 cm · argamassa 2,5 cm |
| Parede interna (12 cm) | argamassa 1,5 cm · tijolo cerâmico 9 cm · argamassa 1,5 cm |
| Piso (11 cm) | concreto 10 cm · revestimento cerâmico 1 cm |
| Cobertura (12,5 cm) | concreto 10 cm · argamassa 2,5 cm |
| Portas | madeira 3,5 cm |
| Janelas | vidro incolor 3 mm + caixilho de alumínio (constituintes) |

## Propriedades dos materiais gravadas no IFC

Gravadas em `Pset_MaterialThermal`, `Pset_MaterialCommon` e
`Pset_MaterialOptical`. Fonte: pasta `DataSets` do EnergyPlus 26.2.0 —
`ASHRAE_2005_HOF_Materials.idf` (ASHRAE Handbook of Fundamentals 2005,
cap. 30, tabelas 19 e 22) e `WindowGlassMaterials.idf`.

| Material | Nome na fonte | λ W/(m·K) | ρ kg/m³ | c J/(kg·K) |
|---|---|---|---|---|
| Argamassa de reboco | F07 25mm stucco | 0,72 | 1856 | 840 |
| Alvenaria de tijolo cerâmico | M01 100mm brick | 0,89 | 1920 | 790 |
| Concreto | M14a 100mm heavyweight concrete | 1,95 | 2240 | 900 |
| Revestimento cerâmico | F14 Slate or tile | 1,59 | 1920 | 1260 |
| Madeira | G05 25mm wood | 0,15 | 608 | 1630 |
| Vidro incolor 3 mm | CLEAR 3MM | 0,9 | — | — |

Vidro (CLEAR 3MM): transmitância solar 0,837; refletância solar 0,075;
transmitância luminosa 0,898; refletância luminosa 0,081; emissividade 0,84.

**Deixado ausente de propósito**, para exercitar o tratamento de dados
faltantes: absortância solar dos materiais opacos (a fonte não traz) e todas
as propriedades do alumínio do caixilho.

## Estrutura BIM

`IfcProject` → `IfcSite` (São Paulo, localização didática) → `IfcBuilding` →
`IfcBuildingStorey` → 3 `IfcSpace`; 6 `IfcWall`, 2 `IfcSlab` (BASESLAB e
ROOF), 5 `IfcWindow`, 3 `IfcDoor`, 8 `IfcOpeningElement`; tipos
(`IfcWallType` etc.) com `IfcMaterialLayerSet`; quantidades `Qto_*`.

## Fronteiras de espaço (`IfcRelSpaceBoundary2ndLevel`) — 30 no total

- Ficam na **face interna** dos elementos, com vértices anti-horários vistos
  de fora do ambiente (normal para fora).
- Externas ao ar (`EXTERNAL`): 7 trechos de parede + 3 de cobertura; ao solo
  (`EXTERNAL_EARTH`): 3 de piso.
- Internas (`INTERNAL`) com par (`CorrespondingBoundary`): 3 pares de parede
  e 2 pares de porta.
- Um trecho **2b** de 12 cm na face da sala, onde a parede PI-2 encosta na
  PI-1: não há ambiente do outro lado; o modelo térmico o trata como
  adiabático e registra a suposição.
- Janelas e portas são fronteiras-filhas (`ParentBoundary`) da parede; a
  fronteira da parede tem a área bruta.

## Como regenerar e conferir

```powershell
cd C:\Projetos\ifc-energy\backend
uv run python -m ferramentas.gerar_residencia_ifc   # regrava o IFC e o relatório
uv run pytest tests/test_residencia_ifc.py          # conferências do IFC, da leitura e do modelo térmico
```

Para abrir em um visualizador independente, use por exemplo o
[Bonsai/BlenderBIM](https://bonsaibim.org/) ou o BIMvision, que rodam no seu
computador.
