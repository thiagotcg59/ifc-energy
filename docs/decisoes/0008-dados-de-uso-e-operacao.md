# 0008 — Dados de uso e operação dos ambientes

**Data:** 16/11/2026 · **Estado:** aguardando aceite do dono

## Decisão

1. Os dados de uso são informados **por ambiente** (IfcSpace) e guardados nos
   ajustes, no campo `operacao` (`GlobalId do ambiente → parâmetro → valor`),
   com o mesmo formato `{ valor, unidade, origem, fonte }` dos outros valores.
   A origem é sempre `manual`.
2. **Não há valores padrão nem sugeridos.** O IFC não traz esses dados e a
   regra do projeto proíbe valor físico sem fonte aprovada. Os limites dos
   campos servem só para barrar erro de digitação.
3. Parâmetros e o objeto do EnergyPlus que cada grupo vai alimentar na
   conversão futura (os nomes dos campos serão conferidos no esquema
   instalado quando a conversão for escrita):

   | Grupo | Parâmetros | Objeto |
   |---|---|---|
   | Ocupação | pessoas; calor por pessoa (W/pessoa); início e fim (h) | `People` |
   | Iluminação | potência (W/m²); início e fim (h) | `Lights` |
   | Equipamentos | potência (W/m²); início e fim (h) | `ElectricEquipment` |
   | Setpoints | aquecimento e resfriamento (°C) | `ThermostatSetpoint:DualSetpoint` |
   | Infiltração | trocas de ar por hora | `ZoneInfiltration:DesignFlowRate` |

4. Um ambiente está **completo** quando todos os parâmetros foram informados.
   Se o número de pessoas (ou a potência) for zero, os demais campos daquele
   grupo não são exigidos.
5. A definição dos parâmetros fica no front-end
   (`frontend/src/dominio/operacao.ts`); o backend só guarda. Quando a
   conversão para epJSON for feita, a definição passa a ser compartilhada.

## Simplificações desta versão

- Horários iguais todos os dias, com um único intervalo por dia. De 0 a 24 é
  o dia inteiro; início maior que o fim atravessa a meia-noite.
- Setpoints valem o dia inteiro.
- Sem distinção entre calor sensível e latente das pessoas, nem fração
  radiante de luzes e equipamentos: esses valores terão de vir de fonte
  aprovada antes da conversão.

## O que isso não faz

Não libera a simulação do IFC. Método de norma (INI-R, NBR 15575) para perfis
de uso só entra com o texto fornecido pelo dono e especificação aprovada.
