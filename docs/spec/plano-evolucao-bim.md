# Plano — evolução para plataforma BIM de análise termoenergética

**Estado:** aprovado por delegação do dono do projeto em 15/11/2026 ("pode
aprovar o plano por mim, faça tudo") e executado na mesma noite. Este
documento registra o que foi planejado, para conferência posterior.

## Objetivo

O coração da aplicação passa a ser um visualizador 3D do IFC ligado a um
inspetor de propriedades físicas e térmicas, com parâmetros editáveis e
rastreáveis, preparando o caminho IFC → modelo térmico → epJSON → EnergyPlus.

## Ordem dos marcos (e por que mudou)

O pedido listava A (interface e 3D) antes de B (IFC sintético). A ordem
executada foi **B → A → C → D**, porque o visualizador precisa de um IFC real
para mostrar: fazer a interface antes obrigaria a usar geometria de mentira,
o que o próprio pedido proíbe.

| Marco | Conteúdo | Critério de aceite (verificável) |
|---|---|---|
| **B. IFC sintético** | Casa térrea IFC4 gerada por script reproduzível; ambientes, camadas, materiais, fronteiras de 2º nível | Validação do esquema IFC4 sem nenhum problema; volumes e áreas iguais às contas feitas à mão; lido igualmente por dois leitores independentes (IfcOpenShell e web-ifc) |
| **A. Interface e 3D** | Área de trabalho com barra, navegador BIM, visualizador, inspetor e painel inferior | Abrir o exemplo, clicar em uma parede no 3D e ver o inspetor abrir essa parede; árvore e 3D sincronizados; teste em navegador de verdade |
| **C. Inspetor paramétrico** | Seis abas; camadas; R, U e capacidade térmica; edição com recálculo; origem de cada valor; persistência | U da parede externa = 2,842 W/(m²·K) pela conta à mão; mudar a espessura do tijolo para 20 cm leva a 2,154; salvar, recarregar e o valor continua |
| **D. Preparação energética** | Modelo térmico intermediário com checagens; superfícies no 3D por condição de contorno; prontidão | Cinco checagens passando no exemplo; "Executar simulação" desabilitado enquanto a conversão para epJSON não existir |

## O que ficou de fora, de propósito

- **Conversão do modelo térmico para epJSON e simulação do IFC.** O pedido
  diz para não prometer simulação antes de existir conversão validada. A
  interface mostra isso como "ainda não implementado".
- **Formulário de ocupação, iluminação, equipamentos e setpoints.**
- **Superfícies pela geometria dos ambientes** (IFC sem fronteiras de 2º
  nível): hoje a plataforma avisa e orienta a exportar as fronteiras.
- **Escolha de composição da biblioteca para elementos sem material.**

## Relação com as fases originais

| Fase original | Situação |
|---|---|
| 1. Fundação | Aceita (tag `v0.1.0`) |
| 2. IFC de um ambiente e 3. casa completa | Leitura, modelo térmico e checagens feitos (marcos B e D); falta a conversão para epJSON com cargas ideais |
| 4. Interface, 3D e formulários | Interface e 3D feitos (marcos A e C); faltam os formulários de uso e a escolha do clima |
| 5 em diante | Sem mudança |

## Pontos que dependem da aprovação do dono

1. **Biblioteca de materiais** (`backend/app/dominio/dados/biblioteca_materiais.json`):
   valores copiados dos conjuntos de dados que acompanham o EnergyPlus
   (ASHRAE Handbook of Fundamentals 2005). Todos marcados `aprovado: false`.
   Um teste confere que cada valor está de fato no arquivo citado.
2. **Resistências superficiais** (R_si = 0,13; R_se = 0,04; cobertura com
   fluxo descendente R_si = 0,17 m²·K/W): valores usuais da ISO 6946 /
   NBR 15220-2 **citados de memória**. Precisam ser conferidos com o texto
   vigente. Aparecem na interface como "Biblioteca técnica", com a fonte e o
   aviso, e são editáveis.
3. **Localização do exemplo** (São Paulo) e as dimensões da casa: escolhas
   didáticas.
