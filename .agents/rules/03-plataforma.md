# Plataforma

## Estrutura do repositório

```
backend/
  app/api/v1/         rotas HTTP: só validação e chamada de serviços
  app/dominio/        modelo térmico, conversor IFC, epJSON, checagens
                      (sem nenhuma dependência de web)
  app/servicos/       simulação, resultados, cenários, clima
  app/persistencia/   SQLite e arquivos
  app/core/           configuração por variáveis de ambiente, logs
  tests/
frontend/
  src/paginas/  src/componentes/  src/funcionalidades/
  src/api/  src/visualizador3d/
docs/        spec/  decisoes/  capturas/  PROGRESSO.md
exemplos/    IFCs sintéticos e dados do modo demonstração
dados/       uploads e execuções (ignorado pelo git)
.agents/     regras e skills do projeto
.github/workflows/
AGENTS.md  README.md  .gitignore  .env.example  iniciar.ps1
```

## Boas práticas

- Pilha: Python, FastAPI, IfcOpenShell, SQLite; React, TypeScript, Vite e
  Three.js.
- API versionada em `/api/v1`, documentada por OpenAPI; os tipos do front-end
  são **gerados** a partir dela (`npm run gerar-tipos`), nunca escritos à mão.
- Simulação como trabalho em segundo plano, com rota de estado; **nunca
  dentro da requisição**.
- Dependências com versões fixadas (`uv.lock`, `package-lock.json`);
  EnergyPlus e IfcOpenShell com versão registrada em `docs/versoes.md`.
- Lint e formatação automáticos (ruff, eslint, prettier); testes com pytest
  e vitest.
- Interface em português, responsiva, acessível, com estados de
  **carregando, vazio e erro** em todas as telas, e mensagens de erro que
  digam o que fazer.
- Cada decisão de projeto relevante vira uma nota curta em `docs/decisoes/`.
- `app/dominio/` não importa FastAPI, nem nada de web ou de banco.
