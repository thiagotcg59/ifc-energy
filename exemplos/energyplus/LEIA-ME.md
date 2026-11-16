# Exemplo do EnergyPlus usado na fase 1

`casa_unifamiliar_eua.epJSON` é o arquivo de exemplo
`SingleFamilyHouse_TwoSpeed_ZoneAirBalance.idf`, que acompanha o EnergyPlus
26.2.0, convertido para epJSON sem nenhuma alteração:

```powershell
C:\EnergyPlusV26-2-0\energyplus.exe --convert-only `
  C:\EnergyPlusV26-2-0\ExampleFiles\SingleFamilyHouse_TwoSpeed_ZoneAirBalance.idf
```

- **O que é:** casa térrea de 186 m² nos EUA, com 3 zonas (área de estar
  condicionada, garagem e ático), bomba de calor de duas velocidades e
  aquecedor suplementar a gás.
- **Para que serve aqui:** provar que a plataforma roda o EnergyPlus de ponta
  a ponta (fila, validação, dias de projeto, simulação anual, leitura de
  resultados). **Não representa uma casa brasileira** e será substituído
  pela casa sintética gerada a partir de IFC nas fases 2 e 3.
- **Clima:** Chicago (arquivo `USA_IL_Chicago-OHare.Intl.AP.725300_TMY3.epw`
  da pasta `WeatherData` da instalação; não é copiado para o repositório).
- **Antes de simular**, a plataforma troca os dois períodos curtos do arquivo
  por um ano inteiro e pede a saída em SQLite (ver
  `backend/app/dominio/epjson.py`).

## Licença

O arquivo de exemplo é distribuído com o EnergyPlus, Copyright (c)
1996-presente, The Board of Trustees of the University of Illinois, The
Regents of the University of California (Lawrence Berkeley National
Laboratory), Oak Ridge National Laboratory, Alliance for Sustainable Energy
e outros contribuidores. Todos os direitos reservados. Texto completo da
licença: https://energyplus.net/licensing
