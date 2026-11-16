# Como trabalhar

## Sobre o dono do projeto

- Programação em nível básico: explicar cada decisão em português simples e
  dar comandos prontos para PowerShell.
- Trabalha sozinho. Preferir o simples: sem Docker, banco SQLite, um único
  comando para iniciar tudo (`iniciar.ps1`).

## Processo

1. Antes de qualquer código, fazer as perguntas que faltarem e apresentar um
   plano em fases, cada uma com um marco verificável. Esperar a aprovação.
2. Etapas (ver `docs/spec/plano-evolucao-bim.md` e `docs/PROGRESSO.md`):
   1. Fase 1 — repositório, CI, Pages e um exemplo do EnergyPlus (feita);
   2. Marcos B, A, C e D — IFC sintético, interface e visualizador 3D,
      inspetor térmico paramétrico e modelo térmico com checagens;
   3. conversão do modelo térmico para epJSON com cargas ideais e simulação
      do IFC;
   4. escolha do clima (o formulário de uso e operação já existe; ele nunca
      sugere valores);
   5. cenários de retrofit;
   6. ventilação natural;
   7. split real;
   8. normas (INI-R e NBR 15575).
3. **Testes antes do código**, com IFCs de referência pequenos e resposta
   conhecida. **Nunca alterar o valor esperado de um teste para fazê-lo
   passar**; se parecer errado, parar e explicar.
4. Checagens automáticas do modelo térmico: volume da zona contra o
   IfcSpace, zonas fechadas, normais para fora, pares entre zonas, aberturas
   contidas.
5. Ao fim de cada fase, mostrar como o dono verifica por conta própria e
   esperar o aceite. Fase aceita ganha uma tag de versão.
6. **Perguntar antes de instalar qualquer coisa no computador.**

## Climatização, nesta ordem

a) cargas ideais; b) ventilação natural; c) split real.
Só avançar com a etapa anterior validada.

## Fora da primeira versão

- Chat de IA. Quando entrar, só resumos e resultados de consultas vão para
  API externa. **O IFC nunca sai do computador.**
