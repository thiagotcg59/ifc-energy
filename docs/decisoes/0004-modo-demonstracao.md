# 0004 — Modo demonstração no GitHub Pages

**Data:** 15/11/2026 · **Estado:** aceita

## Decisão

- O front-end fala com os dados por uma única interface (`src/api/`), que
  tem duas implementações: a **real** (chama o backend em `/api/v1`) e a de
  **demonstração** (lê arquivos JSON versionados em `exemplos/demo/`).
- A escolha é feita na compilação, pela variável `VITE_MODO_DEMO=true`.
- Os arquivos de `exemplos/demo/` têm exatamente o formato das respostas da
  API e são gerados pelo backend real
  (`uv run python -m app.gerar_demo`), nunca escritos à mão.
- O fluxo `pages.yml` compila em modo demonstração e publica em
  https://thiagotcg59.github.io/ifc-energy/ a cada push na `main`.

## Por quê

- Permite acompanhar telas e painéis pelo link, sem instalar nada.
- Como os dados de exemplo vêm do backend real, a demonstração não mostra
  números inventados.

## Consequências

- No modo demonstração nada é simulado: o botão "Simular" reproduz os
  estados com uma pequena espera e mostra o resultado gravado. A tela avisa
  isso com uma faixa.
- Ao mudar o formato da API é preciso regerar os dados de exemplo.
