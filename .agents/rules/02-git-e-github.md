# Git e GitHub

Repositório: https://github.com/thiagotcg59/ifc-energy (público).
Demonstração: https://thiagotcg59.github.io/ifc-energy/

1. O login no GitHub é feito pelo dono no navegador (`gh auth login`).
   **Nunca gravar token ou senha em arquivo.**
2. O `.gitignore` existe antes do primeiro commit. **Nunca enviar ao GitHub:**
   IFCs reais, a pasta `dados/`, saídas do EnergyPlus, arquivos `.env`,
   arquivos climáticos. Só IFCs sintéticos de referência (em `exemplos/`)
   entram no repositório.
3. Commits pequenos, um por tarefa concluída, com mensagem no padrão
   Conventional Commits em português (`feat:`, `fix:`, `docs:`, `test:`,
   `chore:`, `ci:`, `refactor:`), **somente com os testes passando**.
4. Push para a `main` após cada commit. Trabalho arriscado vai em ramo curto
   e só entra na `main` quando passar.
5. GitHub Actions:
   - `ci.yml`: lint e testes rápidos de backend e front-end em cada push;
   - `pages.yml`: publica o front-end no GitHub Pages em modo demonstração.
6. Modo demonstração: front-end compilado sem backend, lendo dados de exemplo
   versionados em `exemplos/demo/` (modelo térmico e resultados de uma casa
   sintética).
7. Atualizar `docs/PROGRESSO.md` a cada tarefa: o que foi feito, como
   verificar, o que vem depois. Verificar a interface no navegador e salvar
   capturas em `docs/capturas/`.
8. O README traz: o que é, como rodar no Windows, link da demonstração, selo
   do CI e estado das fases.
9. Criar uma tag de versão a cada fase aceita pelo dono (`v0.1.0`, `v0.2.0`…).
10. Ao fim de cada tarefa, passar ao dono o link do commit e o da
    demonstração.
