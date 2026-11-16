# 0007 — Cálculo térmico de camadas e convenções pendentes de aprovação

**Data:** 16/11/2026 · **Estado:** método aceito por delegação; **valores
pendentes de aprovação do dono**

## Método (regime permanente, camadas homogêneas em série)

| Grandeza | Fórmula | Unidade |
|---|---|---|
| Resistência de cada camada | R_i = e_i / λ_i | m²·K/W |
| Resistência de superfície a superfície | R_t = Σ R_i | m²·K/W |
| Resistência total | R_T = R_si + R_t + R_se | m²·K/W |
| Transmitância térmica | U = 1 / R_T | W/(m²·K) |
| Capacidade térmica por área | C_T = Σ e_i · ρ_i · c_i | J/(m²·K) |

- **R_si e R_se não são propriedades das camadas.** São uma convenção de
  cálculo, mostrada à parte na interface, com fonte, e editável.
- **Parede entre dois ambientes internos:** ar interno dos dois lados
  (usa-se R_si nos dois).
- **Piso em contato com o solo:** a plataforma mostra só R_t e C_T. A
  transmitância depende de um modelo de solo, ainda não implementado — o
  valor não é inventado.
- **Janelas:** o IFC traz propriedades do vidro. U e fator solar da janela
  completa ficam "Não informado" (o EnergyPlus os calcula na simulação), a
  menos que o usuário informe valores do fabricante.
- Camadas não homogêneas (tijolo furado com câmaras de ar, por exemplo) não
  são tratadas: cada camada é considerada homogênea.

## Conferência

Parede externa do exemplo (argamassa 2,5 + tijolo 10 + argamassa 2,5 cm):
R_t = 0,025/0,72 + 0,10/0,89 + 0,025/0,72 = 0,1818 m²·K/W;
com R_si = 0,13 e R_se = 0,04: U = 1/0,3518 = **2,842 W/(m²·K)**;
C_T = 2·(0,025·1856·840) + 0,10·1920·790 = **229,6 kJ/(m²·K)**.

## Pendente de aprovação

| Item | Valor adotado | Situação |
|---|---|---|
| R_si / R_se de paredes | 0,13 / 0,04 m²·K/W | Citado de memória (ISO 6946 / NBR 15220-2). **Conferir com o texto vigente.** |
| R_si / R_se de coberturas | 0,17 / 0,04 m²·K/W (fluxo descendente) | Idem; a escolha do sentido do fluxo também precisa de confirmação. |
| Biblioteca de materiais | ASHRAE HOF 2005, via DataSets do EnergyPlus | Valores conferidos por teste contra os arquivos; falta o dono aprovar o uso (ou trocar por fonte brasileira). |

Enquanto não forem aprovados, a interface e a API marcam esses valores como
pendentes. Isto **não** é uma implementação da NBR 15220, da NBR 15575 nem
da INI-R.
