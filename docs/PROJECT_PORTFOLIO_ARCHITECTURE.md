# Portfólio de projetos e sprints — RSBUILD OS

**Status:** implementação inicial em revisão (feature branch)
**Escopo:** workspace central da RSBUILD com visibilidade de projetos autorizados por organização.

## Decisão de arquitetura

A RSBUILD opera um portfólio central de projetos. Cada projeto referencia:
- a organização que administra a execução (managing_organization_id);
- a organização cliente (client_organization_id);
- um snapshot do nome de exibição do cliente;
- sprints, atividades e entregáveis.

O projeto é uma relação operacional entre organizações, não uma fusão dos seus workspaces. Dados financeiros, usuários, convites, branding e demais recursos do tenant continuam sujeitos às políticas de sua própria organização.

## Acesso

- Membros da organização RSBUILD podem consultar o portfólio administrado por ela, respeitando suas alçadas.
- A gestão de projetos é restrita a Owner/Admin da RSBUILD.
- A criação e manutenção de sprints, atividades e entregáveis é restrita a Owner/Admin/Operator da RSBUILD.
- A organização cliente recebe uma concessão explícita em project_organization_access; assim, seus próprios membros visualizam o projeto dentro do workspace da empresa.
- Concessões individuais em project_memberships podem ser usadas futuramente para colaboradores externos específicos.
- O nível de acesso do cliente é viewer ou contributor; nesta primeira versão, ambos são somente leitura. Escrita permanece sob responsabilidade da equipe RSBUILD.
- Nenhuma política concede acesso aos dados financeiros de outro tenant.

## Modelo de dados

| Entidade | Responsabilidade |
|---|---|
| projects | Relação entre organização gestora e cliente |
| project_organization_access | Concessão da organização cliente ao seu próprio projeto |
| project_memberships | Concessão individual de acesso ao projeto |
| project_sprints | Objetivos, janela e estado de cada sprint |
| project_tasks | Atividades, prioridade, critérios de conclusão e responsável |
| project_dependencies | Insumos, acessos, decisões e dependências externas |

| project_deliverables | Entregáveis, evidências e estado de submissão/aceite |

## Fluxo operacional

1. A RSBUILD abre seu workspace e acessa Projetos e Sprints. A antiga Zona das Sprints na Torre de Controle funciona como atalho para essa mesma visão, sem manter um segundo painel estático.
2. A equipe seleciona Mundo do Sabor ou Hub Açaí.
3. O projeto contém suas sprints, atividades e entregáveis.
4. A equipe registra progresso e mantém os critérios de aceite.
5. A organização cliente recebe acesso somente ao seu próprio projeto por uma concessão de escopo organizacional; não é necessário adicionar seus usuários ao workspace RSBUILD.
6. O cliente acessa apenas o projeto explicitamente liberado, sem obter associação geral ao workspace RSBUILD ou aos demais clientes.

## Dados iniciais

A migração cria dois registros de portfólio e concede a cada organização acesso de leitura somente ao seu projeto, resolvendo organizações pelos slugs canônicos:
- mundo_sabor → Mundo do Sabor;
- hub_acai → Hub Açaí.

Os registros começam em planning. Nenhuma sprint ou atividade fictícia é criada. O conteúdo aprovado deve ser importado a partir da matriz oficial vigente do Ciclo 01 (v2.2); materiais anteriores de mobilização/alinhamento servem como referência, não como substitutos silenciosos da versão aprovada.

## Referências de escopo consultadas

- RSBUILD Plano de Sprints Ciclo 01 v2.2 (matriz oficial de planejamento; conteúdo a importar sem reinterpretação).
- CICLO_01_PLANO_DE_MOBILIZACAO_v1.0.pdf (governança, seis entregáveis, marcos e critérios gerais).
- 04_ATA-01_ALINHAMENTO_EXECUTIVO_CICLO_01_v1.4.pdf (priorização e dependências registradas em edição anterior).

## Limites desta entrega

- A interface lista projetos, sprints, atividades, dependências e entregáveis; permite à equipe RSBUILD criar sprints e atividades, atualizar seus estados de execução, registrar dependências e vincular entregáveis por URL HTTPS. O progresso exibido é calculado pelas atividades marcadas como concluídas.
- O cadastro de usuários clientes, aprovação formal de entregáveis, comentários, anexos e histórico detalhado de alterações ficam para etapas posteriores.
- A migração ainda precisa ser aplicada em ambiente de validação e passar pelos testes RLS antes de qualquer uso operacional ou liberação de convites.
- O campo de status do entregável ainda não representa aceite formal do cliente. A aprovação/rejeição pelo cliente, comentários, anexos e histórico de decisões exigem fluxo próprio antes de qualquer aceite contratual.

## Critérios de aceite

- Usuário RSBUILD autorizado enxerga os dois projetos iniciais.
- Usuário cliente só enxerga projetos com grant explícito.
- Usuário cliente não consegue criar ou alterar sprints/atividades.
- Usuário sem grant não consegue consultar projeto, sprint, tarefa ou entregável.
- Dados financeiros de tenants continuam isolados pelas políticas existentes.
- Build, typecheck e testes SQL passam antes do merge.