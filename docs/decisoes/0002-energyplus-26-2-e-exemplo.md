# 0002 — EnergyPlus 26.2.0 e o exemplo da fase 1

**Data:** 15/11/2026 · **Estado:** aceita

## Decisão

- Usar o **EnergyPlus 26.2.0** (versão estável mais recente em 15/11/2026),
  na distribuição ".zip" oficial, descompactada em `C:\EnergyPlusV26-2-0`.
- A plataforma chama o `energyplus.exe` como programa separado e lê os
  resultados do arquivo `eplusout.sql` (tabelas em kWh).
- A entrada é sempre **epJSON**, validada contra o
  `Energy+.schema.epJSON` da própria instalação antes de rodar.
- Na fase 1 o modelo simulado é um exemplo que acompanha o EnergyPlus (casa
  unifamiliar nos EUA, clima de Chicago). Ver `exemplos/energyplus/LEIA-ME.md`.

## Por quê

- O ".zip" não precisa de instalador nem de permissão de administrador, e
  para remover basta apagar a pasta.
- Ler o SQLite é mais confiável do que interpretar HTML ou CSV.
- O exemplo já vem pronto e testado; serve para provar o encanamento
  (fila → validação → dias de projeto → anual → resultados) antes de existir
  o conversor de IFC.

## Consequências

- O exemplo **não é uma casa brasileira** e usa um sistema de climatização
  real (bomba de calor), não cargas ideais. Ele sai de cena quando a casa
  sintética em IFC existir (fases 2 e 3).
- Trocar a versão do EnergyPlus exige seguir `docs/versoes.md`.
