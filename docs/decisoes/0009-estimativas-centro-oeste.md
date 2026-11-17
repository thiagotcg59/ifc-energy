# 0009 — Estimativas opcionais para o Centro-Oeste

Data: 16/11/2026. Plano, tabela e adaptações aprovados pelo dono na conversa.

O dono pediu um botão para estimar dados faltantes de uma residência no
Centro-Oeste. A regra anterior de não sugerir valores passa a ter uma
exceção explícita: o perfil `centro-oeste-v1`, descrito na
[especificação](../spec/estimativas-centro-oeste.md), aplicado voluntariamente
após conferir a prévia. Abrir um IFC continua deixando as lacunas vazias.

As referências combinam um estudo em Cuiabá, hipóteses complementares
aprovadas e sete materiais/vidro dos datasets locais do EnergyPlus. Não são
uma medição de todas as casas da região nem uma classificação normativa.
O município informado serve como registro; não ajusta clima ou propriedades.

Cada valor recebe origem `estimado`, fonte e identificador da aplicação.
Os ajustes guardam os valores anteriores para desfazer somente os campos
que ainda correspondem àquela aplicação. Edições manuais posteriores e
valores existentes, inclusive zero, são preservados. API, arquivos de
parâmetros e demonstração mantêm esse registro, separado do IFC original.

A biblioteca didática permanece com seu estado de aprovação anterior. O
perfil aprovado é separado para não estender a autorização a outras
entradas. Espessuras, materiais incompatíveis, usos sem perfil, geometria,
clima e U/SHGC da janela inteira não recebem valores inventados. Sem
IfcSpace, a operação é bloqueada. O botão não habilita a simulação do IFC.

Os testes foram escritos antes da implementação. Não houve instalação de
dependências nem alteração das fórmulas térmicas compartilhadas em Python
e TypeScript.
