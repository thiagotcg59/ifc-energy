# 0005 — Biblioteca do visualizador IFC: web-ifc + three.js

**Data:** 16/11/2026 · **Estado:** aceita por delegação; rever com o dono

## Opções avaliadas (dados do npm em 15/11/2026)

| Opção | Licença | Última publicação | Avaliação |
|---|---|---|---|
| **web-ifc 0.0.79** (That Open) + **three 0.187** | MPL-2.0 + MIT | nov/2026 | Motor de leitura IFC do ecossistema That Open, ativo. Dá a geometria por elemento, com o identificador de cada um. **Escolhida.** |
| @thatopen/components 3.6 + fragments 3.6 | MIT | out–nov/2026 | Ativo e completo, mas converte o IFC para um formato próprio (fragments), traz seus próprios componentes de interface e processos auxiliares. Mais peças do que este projeto precisa hoje. |
| web-ifc-three / web-ifc-viewer | MIT | 2024 / 2023 | Abandonados. |
| @xeokit/xeokit-sdk 2.6 | **AGPL-3.0** | set/2026 | A licença obrigaria a abrir qualquer uso em rede sob AGPL; descartado. |
| @ifc-lite | MPL-2.0 | nov/2026 | Novo; o pacote do visualizador está marcado como descontinuado. |

## Decisão

Usar o **web-ifc** diretamente para ler a geometria e o **three.js** para
desenhar, com uma camada própria e pequena (`frontend/src/visualizador3d/`):

- `ifc.worker.ts` abre o IFC em segundo plano (Web Worker), para a tela não
  travar;
- `extrairGeometria.ts` devolve um conjunto de malhas **por elemento**,
  identificado pelo GlobalId;
- `Cena.ts` cuida de câmera, seleção, visibilidade, corte e superfícies
  térmicas; não conhece React nem a API.

## Por quê

- **Seleção exata:** cada elemento do IFC é um objeto separado na cena, então
  clicar em uma parede seleciona aquela parede.
- **Menos dependências:** duas bibliotecas maduras, sem formato intermediário.
- **Suficiente para o alvo:** casas unifamiliares têm centenas a poucos
  milhares de elementos.
- **O IFC não sai do navegador:** a leitura é local.

## Consequências

- Modelos muito grandes (dezenas de milhares de elementos) ficariam pesados
  com um objeto por elemento. Se isso virar necessidade, a troca por
  `@thatopen/fragments` fica restrita à pasta `visualizador3d/`.
- As propriedades **não** são lidas no navegador: vêm do backend
  (IfcOpenShell), que é a única fonte da verdade (decisão 0006). No GitHub
  Pages só a residência de exemplo tem propriedades.
- O corte disponível é o horizontal; cortes em outros planos ficam para depois.
