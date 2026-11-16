# 0001 — Pilha e ferramentas

**Data:** 15/11/2026 · **Estado:** aceita

## Decisão

- **Backend:** Python 3.11, FastAPI, SQLite (módulo `sqlite3` da própria
  linguagem), IfcOpenShell (a partir da fase 2).
- **Front-end:** React, TypeScript, Vite; Three.js entra na fase 4.
- **Ambiente Python:** `uv`, com versões exatas travadas em `uv.lock`.
- **Pasta do projeto:** `C:\Projetos\ifc-energy`, fora do OneDrive.
- Sem Docker; um único comando (`iniciar.ps1`) inicia tudo.

## Por quê

- É a pilha sugerida pelo dono do projeto; todas as peças já estavam
  instaladas no computador (Python 3.11, uv, Node 24).
- Python 3.11 é a versão com compatibilidade mais segura com o IfcOpenShell.
- O OneDrive tentaria sincronizar milhares de arquivos de dependências e pode
  travar o banco SQLite e as saídas do EnergyPlus durante uma simulação.

## Consequências

- Quem clonar o repositório precisa de `uv` e Node; o `iniciar.ps1` confere
  isso e diz o que falta.
