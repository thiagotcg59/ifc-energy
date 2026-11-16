# Relatório do IFC de exemplo

Gerado por `backend/ferramentas/gerar_residencia_ifc.py`. Não editar à mão.

- Esquema: IFC4
- Total de entidades: 1466

## Entidades por classe

| Classe | Quantidade |
|---|---|
| IfcProject | 1 |
| IfcSite | 1 |
| IfcBuilding | 1 |
| IfcBuildingStorey | 1 |
| IfcSpace | 3 |
| IfcWall | 6 |
| IfcSlab | 2 |
| IfcWindow | 5 |
| IfcDoor | 3 |
| IfcOpeningElement | 8 |
| IfcWallType | 2 |
| IfcSlabType | 2 |
| IfcWindowType | 1 |
| IfcDoorType | 1 |
| IfcMaterial | 7 |
| IfcMaterialLayerSet | 5 |
| IfcMaterialConstituentSet | 1 |
| IfcMaterialProperties | 12 |
| IfcPropertySet | 17 |
| IfcElementQuantity | 19 |
| IfcRelSpaceBoundary2ndLevel | 30 |

## Ambientes

| Nº | Nome | Área (m²) | Volume (m³) | GlobalId |
|---|---|---|---|---|
| 01 | Sala e cozinha | 39.1950 | 109.7460 | `0cZajB0DfPYeBAW5lbHjJO` |
| 02 | Quarto | 16.5985 | 46.4758 | `0dqFX5Na5VbRxVyW1Tj4hZ` |
| 03 | Banheiro | 7.9449 | 22.2457 | `1qLoJhAODSEQkDZLnhnGZv` |

## Composições (camadas de fora para dentro)

**Parede externa de alvenaria rebocada 15 cm**

1. Argamassa de reboco — 2.5 cm
2. Alvenaria de tijolo cerâmico — 10 cm
3. Argamassa de reboco — 2.5 cm

**Parede interna de alvenaria rebocada 12 cm**

1. Argamassa de reboco — 1.5 cm
2. Alvenaria de tijolo cerâmico — 9 cm
3. Argamassa de reboco — 1.5 cm

**Piso de concreto com revestimento cerâmico 11 cm**

1. Concreto — 10 cm
2. Revestimento cerâmico — 1 cm

**Laje de cobertura de concreto rebocada 12,5 cm**

1. Concreto — 10 cm
2. Argamassa de reboco — 2.5 cm

## Elementos

| Classe | Etiqueta | Nome | GlobalId |
|---|---|---|---|
| IfcWall | PE-S | Parede externa sul | `2pI$ffWzbLfAi1XirhtfxF` |
| IfcWall | PE-L | Parede externa leste | `1$bzMErJ5Nbg0DgiiT3qKx` |
| IfcWall | PE-N | Parede externa norte | `2h8nI6mB9QexGaFosubl0x` |
| IfcWall | PE-O | Parede externa oeste | `1Ccr9izyPVkeDqWbK8_T3W` |
| IfcWall | PI-1 | Parede interna sala / quarto e banheiro | `0uiEKYUJTGIRvZPm4FkSnR` |
| IfcWall | PI-2 | Parede interna quarto / banheiro | `2gTZsfzt1GrvOukXfbuscp` |
| IfcSlab | PISO | Piso térreo | `1_p2nQjZ5UpOJIZhifSnE2` |
| IfcSlab | COBERTURA | Laje de cobertura | `1q2DG$Zi9R0A03vtlIhjwR` |
| IfcWindow | J5 | Janela da sala (sul) | `0yPaCqE6jL0BmWS90erBJM` |
| IfcWindow | J3 | Janela do quarto (leste) | `1a_dGFZ8fQmxzb7AmI3y2X` |
| IfcWindow | J1 | Janela da sala (norte) | `1X$pOlEMbSB9UHwLxd6XeW` |
| IfcWindow | J4 | Janela do banheiro (norte) | `1KKQh6OFbGAx9zxXJsVmrn` |
| IfcWindow | J2 | Janela da sala (oeste) | `3TfK_sJ5DGs8k0aY8v8vDd` |
| IfcDoor | P0 | Porta de entrada | `0eV9oBLD9MtviYHQUjiM4M` |
| IfcDoor | P1 | Porta do quarto | `0xZJ2NZuzO_x9mfNqEszaF` |
| IfcDoor | P2 | Porta do banheiro | `1TgXJObAnTd8agfAyLPYDg` |

## Fronteiras de espaço (2º nível)

- Total: 30
- Externas (ar): 16
- Externas (solo): 3
- Internas: 11
- Com fronteira correspondente (pares): 10
- Aberturas (com fronteira-mãe): 10
