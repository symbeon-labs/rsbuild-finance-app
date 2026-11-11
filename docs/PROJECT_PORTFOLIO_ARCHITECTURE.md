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
- Usuários de organizações clientes só visualizam projetos quando recebem uma linha explícita em project_memberships.
- O nível de acesso do cliente é viewer ou contributor; nesta primeira versão, ambos são somente leitura. Escrita permanece sob responsabilidade da equipe RSBUILD.
- Nenhuma política concede acesso aos dados financeiros de outro tenant.

## Modelo de dados

| Entidade | Responsabilidade |
|---|---|
| projects | Relação entre organização gestora e cliente |
| project_memberships | Concessão individual de acesso ao projeto |
| project_sprints | Objetivos, janela e estado de cada sprint |
| project_tasks | Atividades, prioridade, critérios de aceite e responsável |
| project_deliverables | Entregáveis e estado de submissão/aceite |

## Fluxo operacional

1. A RSBUILD abre seu workspace e acessa Projetos e Sprints.
2. A equipe seleciona Mundo do Sabor ou Hub Açaí.
3. O projeto contém suas sprints, atividades e entregáveis.
4. A equipe registra progresso e mantém os critérios de aceite.
5. Quando o projeto estiver pronto para compartilhamento, a RSBUILD concede acesso individual aos usuários do cliente.
6. O cliente acessa apenas o projeto explicitamente liberado, sem obter associação geral ao workspace RSBUILD ou aos demais clientes.

## Dados iniciais

A migração cria dois registros de portfólio, resolvendo organizações pelos slugs canônicos:
- mundo_sabor → Mundo do Sabor;
- hub_acai → Hub Açaí.

Os registros começam em planning. Nenhuma sprint ou atividade fictícia é criada. O conteúdo aprovado das sprints deve ser importado/cadastrado a partir dos documentos oficiais de cada empresa.

## Limites desta entrega

- A interface inicial lista projetos, sprints e atividades, e permite à equipe RSBUILD criar sprints e atividades.
- O cadastro de usuários clientes, aprovação formal de entregáveis, comentários, anexos e histórico detalhado de alterações ficam para etapas posteriores.
- A migração ainda precisa ser aplicada em ambiente de validação e passar pelos testes RLS antes de qualquer uso operacional ou liberação de convites.
- A interface não deve ser tratada como prova de aceite contratual até que o fluxo de aceite seja implementado.

## Critérios de aceite

- Usuário RSBUILD autorizado enxerga os dois projetos iniciais.
- Usuário cliente só enxerga projetos com grant explícito.
- Usuário cliente não consegue criar ou alterar sprints/atividades.
- Usuário sem grant não consegue consultar projeto, sprint, tarefa ou entregável.
- Dados financeiros de tenants continuam isolados pelas políticas existentes.
- Build, typecheck e testes SQL passam antes do merge.