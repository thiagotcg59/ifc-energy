# Estimar dados faltantes — residência no Centro-Oeste

**Data:** 16/11/2026. **Plano:** aprovado pelo dono nesta conversa.
**Aceite das referências:** o dono respondeu “Aprovar a tabela e as
adaptações” nesta conversa, incluindo a hipótese de infiltração.
**Etapa atual:** botão implementado; verificação descrita em
[PROGRESSO.md](../PROGRESSO.md). Falta o aceite da interface pelo dono.

## Objetivo e alcance

Adicionar **Estimar dados faltantes** à barra superior. O botão abre uma
prévia dos campos vazios que podem ser preenchidos, com valor, unidade,
fonte e hipótese. A aplicação acontece depois de **Aplicar estimativas**.

O pedido do dono autoriza estimativas opcionais, como exceção à regra de
não sugerir dados. A importação do IFC continua sem preenchimento automático.
Cada estimativa fica nos ajustes, com origem `estimado`, referência e versão
do perfil. Valores existentes, inclusive zero, são preservados.

Nome do perfil: **Residência — Centro-Oeste (referência: Cuiabá)**.
É um cenário composto a partir de pesquisas e exemplos técnicos, sem
comprovação de que represente estatisticamente todas as casas da região.
O município do projeto deve aparecer separado da cidade de referência;
escolher outro município não transforma os valores de Cuiabá em dados locais.
O arquivo climático e as coordenadas do IFC não são substituídos pelo perfil.

## 1. Dados de uso aprovados

Todos os valores desta seção foram **aprovados para este cenário opcional**. As letras
identificam as fontes detalhadas abaixo.

| Campo | Dormitório | Sala ou sala/cozinha integrada | Base |
|---|---|---|---|
| Pessoas | 2 por dormitório | Soma das pessoas dos dormitórios | A; soma é adaptação do projeto |
| Ocupação: início/fim | 21–8 h | 14–21 h | A, rotina de dias úteis |
| Calor por pessoa | 80 W/pessoa | 110 W/pessoa | B |
| Iluminação | 5 W/m² | 6 W/m² | A |
| Iluminação: início/fim | 21–22 h | 17–21 h | A, rotina de dias úteis |
| Equipamentos | 0 W/m² | 1,5 W/m² | A, equipamentos somente na sala |
| Equipamentos: início/fim | Dispensado com potência zero | 0–24 h | A |
| Aquecimento/resfriamento | 20/26 °C | 20/26 °C | C, cenário de controle térmico |
| Infiltração | 1 troca/h | 1 troca/h | D, hipótese de frestas |

Adaptações aprovadas junto com a tabela:

- **A:** o estudo usa dois dormitórios e quatro pessoas na sala. Somar a
  ocupação dos dormitórios permite adaptar o cenário ao IFC; se algum
  dormitório não tiver ocupação válida nem estimativa aprovada, a sala
  permanece pendente. Uma única sala recebe essa soma; múltiplas salas
  exigem revisão para não duplicar ocupantes simultaneamente.
- A interface atual aceita um único intervalo diário, igual todos os dias.
  Repete-se a rotina de dias úteis de A em todos os dias, marcando
  essa simplificação. Os intervalos são [início, fim): a troca às 21 h não
  conta as mesmas pessoas simultaneamente na sala e no quarto.
- **B:** são valores de um exemplo de habitação em Florianópolis, usados
  aqui somente como aproximação da atividade das pessoas. Não são uma
  medição dos moradores do Centro-Oeste.
- **C:** 20/26 °C são limites de controle de um estudo de demanda térmica,
  inclusive em cidades do Centro-Oeste. A adaptação para quartos e salas
  desta residência é uma hipótese; não comprova a existência de aquecimento
  na casa nem especifica um aparelho split.
- **D:** a referência é uma simulação de outro sistema construtivo e de
  habitação multifamiliar. Usar 1 troca/h em uma casa unifamiliar é uma
  aproximação explícita de cenário, sem calibração ou medição regional.
  Não representa a ventilação natural com janelas abertas.
- Equipamentos zero no dormitório significam a simplificação do cenário A,
  não a constatação de que o cômodo real não possui aparelhos.
- Banheiro, circulação, serviço, cozinha separada, ambientes mistos ou sem
  identificação suficiente permanecem pendentes até existir perfil
  compatível. O nome de um ambiente só pode sugerir a categoria; a prévia
  permite conferi-la antes de aplicar.

### Fontes consultadas em 16/11/2026

**A — Guarda, Durante e Callejas (2020).**
[Impacto das mudanças climáticas no ambiente térmico interno de habitação
unifamiliar em Cuiabá-MT](https://periodicos.sbu.unicamp.br/ojs/index.php/parc/article/download/8657188/25757/89638),
PARC, v. 11, e020031, página 8, seção de simulação e Tabela 4.
DOI: 10.20396/parc.v11i0.8657188. Os números são tomados como cenário da
pesquisa; não se implementa o RTQ-R nem uma classificação normativa.

**B — Mazzaferro, Melo e Lamberts, LabEEE/UFSC.**
[Manual de simulação computacional de edifícios com o uso do objeto Ground
Domain no programa EnergyPlus](https://labeee.ufsc.br/sites/default/files/disciplinas/Manual_Ground_Domain.pdf),
seção 3, páginas 11–12. A unidade de calor já é W/pessoa; não se confunde
com W/m² de superfície corporal ou de piso.

**C — Martins e Schmid (2019).**
[O tratamento da resistência térmica superficial nas normas técnicas
brasileiras e sua influência no consumo energético estimado para
edifícios](https://periodicos.utfpr.edu.br/revistagi/article/download/9288/6630),
Revista Gestão Industrial, v. 15, n. 3, p. 126–147. Premissas de temperatura
na página 132; aplicação em Brasília, Campo Grande e Cuiabá nas páginas
138, 140 e 141. Esta proposta aproveita apenas a faixa do cenário.

**D — IFBQ / PBQP-H, DATec 012-E (setembro de 2020).**
[Painéis pré-fabricados mistos de concreto armado e blocos cerâmicos —
PRECON](https://pbqp-h.mdr.gov.br/wp-content/uploads/2021/09/DATec-12.pdf),
página 15, condição de simulação por frestas. Documento histórico cuja
validade indicada terminou em agosto de 2023; é citado exclusivamente
como registro da hipótese usada, não como certificação vigente.

## 2. Materiais: valores existentes conferidos na origem

A biblioteca atual é didática e todos os itens estão sem aprovação. Foram
conferidos os valores abaixo nos arquivos instalados, sem modificar a
biblioteca nem marcar qualquer item como aprovado.

| Entrada do dataset | Condutividade W/(m·K) | Densidade kg/m³ | Calor específico J/(kg·K) |
|---|---:|---:|---:|
| F07 25mm stucco | 0,72 | 1856 | 840 |
| M01 100mm brick | 0,89 | 1920 | 790 |
| M14a 100mm heavyweight concrete | 1,95 | 2240 | 900 |
| F14 Slate or tile | 1,59 | 1920 | 1260 |
| G05 25mm wood | 0,15 | 608 | 1630 |
| I02 50mm insulation board | 0,03 | 43 | 1210 |

Fonte local: `C:\EnergyPlusV26-2-0\DataSets\ASHRAE_2005_HOF_Materials.idf`.
Estas seis entradas foram aprovadas neste perfil como aproximações de materiais,
sem assumir que são produtos brasileiros específicos. Não se aplica o
tijolo maciço a bloco furado nem a placa isolante a qualquer isolante por
semelhança de nome. A prévia precisa mostrar a correspondência proposta.

Para **CLEAR 3MM**, em
`C:\EnergyPlusV26-2-0\DataSets\WindowGlassMaterials.idf`, foram conferidos:
espessura de 0,003 m; condutividade de 0,9 W/(m·K); transmitância solar de
0,837; refletância solar de 0,075; transmitância visível de 0,898;
refletância visível de 0,081; emissividade de 0,84.
Aplicação aprovada somente a vidro simples incolor de 3 mm compatível.
Transmitância solar não é fator solar (SHGC), e dados do vidro isolado não
preenchem automaticamente o U da janela inteira, incluindo o caixilho.

Continuam pendentes: propriedades do alumínio sem fonte, U/SHGC de janela
sem composição compatível, materiais desconhecidos e espessuras não
informadas. A referência de um material não determina a espessura real da
camada existente. Resistências superficiais já registradas de memória não
ganham aprovação por esta proposta; dependem do texto técnico conferido.

## 3. Comportamento e critérios de aceite da implementação

1. Abrir o botão apresenta quantos campos podem ser estimados, por ambiente
   e material; mostra também o motivo das pendências restantes.
2. A aplicação só considera valores realmente vazios no modelo efetivo
   (IFC mais ajustes). Preserva números zero, valores manuais, do IFC,
   calculados e de estimativas anteriores. Um segundo clique não duplica
   alterações nem histórico.
3. Validar o conjunto mesclado antes de aplicar: horários coerentes,
   aquecimento menor que resfriamento, unidades e limites. Conflitos com
   dados existentes ficam visíveis como pendências.
4. Cada valor aplicado tem origem `estimado`, fonte e identificação da
   hipótese. A interface, API, exportação/importação e persistência local e
   da demonstração precisam manter essa informação.
5. **Desfazer estimativas** remove somente valores da aplicação escolhida
   que não foram editados depois. Preserva o que o dono alterou ou salvou
   manualmente posteriormente.
6. Sem IfcSpace, o botão informa o bloqueio e aponta o diagnóstico.
   Geometria, zonas, fronteiras e clima não são adivinhados.
7. A prontidão distingue campos preenchidos por estimativa de campos
   informados. Não habilita a simulação do IFC enquanto faltar a conversão
   validada para epJSON.

## 4. Verificação depois do aceite dos valores

- Escrever primeiro testes com a residência sintética e ajustes pequenos:
  campos vazios; zeros; dados existentes; quarto reconhecido e banheiro
  sem perfil; conflito de horário/setpoint; segunda aplicação; ausência de
  IfcSpace; salvar/reabrir; desfazer preservando edição posterior.
- Implementar a funcionalidade sem instalar novas dependências.
- Gerar os tipos TypeScript pela API se o esquema mudar. Conferir os dois
  lados dos cálculos e vetores compartilhados caso haja mudança térmica.
- Executar testes/lint existentes, verificar no navegador, salvar capturas
  em `docs/capturas/`, atualizar o progresso e publicar o commit na `main`.

## Registro do aceite e limites

O dono aprovou a tabela de uso, suas adaptações e as sete entradas de
materiais/vidro acima em 16/11/2026. A autorização vale para o perfil
`centro-oeste-v1`, acionado pelo botão e aplicado após a prévia. Não altera
o estado de aprovação da biblioteca didática nem autoriza outras fontes
pendentes. O aceite final da interface é um marco separado.
