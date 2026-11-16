# 0003 — Simulação em segundo plano com fila no SQLite

**Data:** 15/11/2026 · **Estado:** aceita

## Decisão

- `POST /api/v1/simulacoes/...` só grava uma linha na tabela `simulacoes`
  (estado `na_fila`) e responde na hora com o código 202.
- Dentro do próprio backend, uma linha de execução separada (thread) pega
  uma simulação por vez e chama o EnergyPlus, que roda como outro programa.
- O front-end consulta `GET /api/v1/simulacoes/{id}` a cada segundo.
- Estados: `na_fila` → `validando` → `dias_de_projeto` → `anual` →
  `concluida` (ou `falhou`, com mensagem e detalhes).
- Se o servidor for fechado no meio, ao reiniciar a simulação é marcada como
  `falhou` com a mensagem "foi interrompida".

## Por quê

- Não exige nenhum serviço extra (Redis, Celery etc.): continua sendo um
  único comando para iniciar.
- O trabalho pesado é do EnergyPlus, em processo separado; a thread só
  espera. Para um único usuário, uma simulação por vez é suficiente.

## Consequências

- No plano inicial eu havia falado em "processo separado" para a fila; ficou
  uma thread dentro do backend, que é mais simples e atende igual.
- Se um dia for preciso rodar simulações em paralelo, basta iniciar mais de
  uma thread.
