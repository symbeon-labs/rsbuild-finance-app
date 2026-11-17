# ADR-001 — RSBUILD OS Core Workspace v1.0

- **Status:** Aprovada — baseline de navegação congelada
- **Data:** 2026-11-17
- **Atualizado:** 2026-11-22 — baseline mantida
- **Escopo:** Navegação principal do Workspace RSBUILD

## Decisão

Estabelecer sete núcleos como espinha dorsal de navegação do RSBUILD OS, nesta ordem:

| Ordem | Núcleo | Responsabilidade |
|---:|---|---|
| 01 | Visão Geral | Observabilidade e visão consolidada |
| 02 | Projetos e Sprints | Planejamento, execução e acompanhamento |
| 03 | Sandbox | Experimentação, testes e validação |
| 04 | Agentes & IA | Gestão e supervisão operacional de agentes |
| 05 | Auditoria & Governança | Rastreabilidade, supervisão e controle transversal |
| 06 | Identidades & Permissões | Usuários, papéis e autorização |
| 07 | Central de Leads | Entrada institucional e relacionamento comercial |

## Princípios de evolução

1. A ordem e os nomes constituem a baseline da versão 1.0.
2. Novas funcionalidades devem ser incorporadas a um dos sete núcleos existentes.
3. Novos módulos internos podem ser criados sem ampliar automaticamente a navegação de primeiro nível.
4. A inclusão, remoção ou reorganização de um núcleo exige revisão arquitetural e nova versão desta decisão.
5. Auditoria & Governança é transversal: não se limita à supervisão de agentes.
6. A Central de Leads é uma capacidade de relacionamento comercial e intake institucional, não uma caixa de mensagens genérica.

## Limite da decisão

Este ADR congela a arquitetura de navegação, não declara os sete núcleos integralmente implementados ou concluídos. Capacidades e permissões permanecem condicionadas ao estágio de implementação e às políticas de acesso de cada área.

## Critério de aceite da implementação

- Menu da RSBUILD apresenta os sete núcleos na ordem definida.
- O item comercial aparece como **Central de Leads**, por último.
- O título da página de atendimento também apresenta **Central de Leads**.
- A mudança não altera rotas internas, identificadores de seção, regras de autorização ou disponibilidade por organização.
