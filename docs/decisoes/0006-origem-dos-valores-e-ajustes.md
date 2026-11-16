# 0006 — Origem de cada valor e parâmetros separados do IFC

**Data:** 16/11/2026 · **Estado:** aceita por delegação; rever com o dono

## Decisão

1. **Uma única leitura do IFC, no backend** (`app/dominio/modelo_bim.py`, com
   IfcOpenShell). O front-end recebe o resultado pronto pela API; a geometria
   3D é ligada às propriedades pelo GlobalId.
2. **Todo valor físico carrega a origem**, no formato
   `{ valor, unidade, origem, fonte }`:

   | Origem | Significado |
   |---|---|
   | `ifc` | Lido do arquivo; a fonte diz de onde (ex.: `Pset_MaterialThermal.ThermalConductivity`) |
   | `calculado` | Obtido da geometria ou de outros valores |
   | `manual` | Informado pelo usuário no inspetor |
   | `biblioteca` | Valor da biblioteca técnica (com a fonte e o estado de aprovação) |
   | `ausente` | Não informado — a interface mostra "Não informado" e nunca preenche |

3. **O IFC nunca é alterado.** O que o usuário edita vai para um conjunto de
   **ajustes** separado (`dados/modelos/<id>/ajustes.json`): propriedades de
   materiais, camadas das composições, parâmetros de janelas, resistências
   superficiais e um histórico (quando, onde, o quê, de, para).
4. **Modelo efetivo = IFC + ajustes**, montado no front-end
   (`src/dominio/modeloEfetivo.ts`), que recalcula R, U e capacidade térmica
   a cada edição.
5. **Edições valem para a composição**, não para um elemento isolado: alterar
   a "Parede externa 15 cm" altera as quatro paredes que a usam, e a tela diz
   isso.
6. **Persistência:** com o backend local, em arquivo no computador; na
   demonstração (GitHub Pages), no armazenamento do navegador, com exportar e
   importar em JSON. A tela diz qual dos dois está valendo.

## Por quê

- Rastreabilidade: nenhum número aparece sem dizer de onde veio.
- Reversibilidade: "Restaurar valores do IFC" é só apagar os ajustes.
- O mesmo desenho serve depois para os cenários de retrofit (um cenário é um
  conjunto de ajustes sobre o caso-base).

## Consequências

- O cálculo térmico existe em duas linguagens (Python e TypeScript). Para não
  divergirem, os dois são conferidos pelos mesmos casos de resposta
  conhecida, em `exemplos/testes/vetores_termicos.json`.
- Condição de contorno não é editável: vem das fronteiras de espaço.
