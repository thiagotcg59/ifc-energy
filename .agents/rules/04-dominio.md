# Regras de domínio

## Entrada

- IFC4 exportado do Revit, residencial unifamiliar.
- **Sem IfcSpace: parar** e mostrar um relatório dizendo o que falta e como
  exportar ambientes e fronteiras de espaço de 2º nível no Revit. Não tentar
  adivinhar zonas.
- Com fronteiras de 2º nível, usá-las; sem elas, calcular as superfícies pela
  geometria dos espaços.
- Propriedades térmicas: usar as do IFC quando existirem; senão, sugerir a
  entrada mais parecida de uma biblioteca local e mostrar uma tela para o
  dono confirmar.
- **Nenhum valor físico inventado**: cada valor da biblioteca tem fonte
  citada, aprovada pelo dono.

## Modelo e geometria

- Conversão: IFC → modelo térmico intermediário (JSON próprio, com GlobalId
  de origem e lista de suposições) → epJSON.
- O modelo intermediário deve permitir gerar um **modelo real** e um
  **modelo de referência** (para as normas, em fase posterior).
- Unidades internas no SI; converter na leitura do IFC.
- Vértices anti-horários vistos de fora da zona.
- Parede entre zonas = duas superfícies pareadas.
- Camadas de construção de fora para dentro.
- Aberturas coplanares e contidas na superfície-mãe.

## EnergyPlus

- Nomes de campos do epJSON conferidos no esquema da versão instalada
  (`Energy+.schema.epJSON`), nunca de memória.
- Validar o epJSON contra o esquema e rodar os dias de projeto **antes** da
  simulação anual.
- Arquivo climático escolhido pela localização do IfcSite entre os EPW de uma
  pasta local, com confirmação do dono. Perguntar antes de baixar EPW.

## Resultados da primeira versão

Consumo anual por uso final, carga térmica de pico, conforto térmico por
ambiente, relatório de confiança e cenários de retrofit comparados com o
caso-base.

## Normas (fase posterior)

- Classificação pela INI-R e avaliação pela NBR 15575.
- **Não implementar método normativo de memória**: o dono fornece o texto
  vigente, escreve-se a especificação em `docs/spec/`, ele aprova, e só então
  se implementa.
