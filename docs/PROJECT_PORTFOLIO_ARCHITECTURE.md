# Portfólio de projetos, governança e evolução modular — RSBUILD OS

**Status:** diretriz arquitetural consolidada; implementação inicial em revisão na PR #40.  
**Escopo imediato:** preservar a experiência do RSBUILD OS e integrar a governança de acesso à estrutura de projetos já implementada.

## 1. Princípio central

O RSBUILD OS deve evoluir sua infraestrutura sem descaracterizar a interface nem substituir o conceito de produto originalmente definido.

A interface continua sendo o ambiente de trabalho. As funcionalidades existentes continuam organizadas pela experiência do usuário. Identidade, autorização e governança operam transversalmente, por trás dessas experiências.

**Princípio:** a interface define a experiência; os módulos definem as capacidades funcionais; a camada de autorização define quem pode utilizar cada capacidade, em qual contexto e sob quais condições.

Esta diretriz não autoriza remover, renomear ou redesenhar funcionalidades existentes por conveniência arquitetural.

## 2. Visão de produto

O RSBUILD OS é concebido como um workspace operacional extensível para organizações, equipes e projetos. Seu valor está em oferecer um ambiente coerente no qual funcionalidades e módulos especializados possam coexistir, mantendo limites claros entre organizações e contextos de trabalho.

A evolução pretendida não é transformar o RSBUILD em um ERP monolítico nem em um simples painel de administração. É construir um núcleo organizacional confiável que permita incorporar novas capacidades sem recriar, a cada módulo, identidade, estrutura organizacional, controle de acesso e auditoria.

## 3. Três responsabilidades que trabalham juntas

### 3.1 Experiência — interface e workspace

Preserva a navegação, os espaços de trabalho e as funcionalidades escolhidas para o conceito original do produto. O usuário continua acessando as áreas operacionais familiares; a autorização apenas determina quais dados e ações estão disponíveis para seu contexto.

### 3.2 Capacidades — funcionalidades e módulos

As funcionalidades atuais permanecem parte do produto. No futuro, módulos especializados poderão ser habilitados e integrados por contratos explícitos, sem criar workspaces paralelos ou duplicar a experiência principal.

Exemplos de domínios futuros incluem capacidades financeiras, fiscais, jurídicas, operacionais e analíticas. Esses exemplos representam possibilidades de evolução, não funcionalidades declaradas como já implementadas.

### 3.3 Governança — identidade, escopo e autorização

A autorização é transversal e deve considerar:
- identidade autenticada;
- organização e vínculo organizacional;
- papel do usuário;
- projeto e associação explícita;
- capacidade/ação solicitada;
- limites de dados e contexto.

A interface pode ocultar ações indisponíveis para melhorar a experiência, mas isso nunca substitui a validação no servidor e as políticas RLS.

## 4. Estrutura organizacional e isolamento

A RSBUILD pode administrar um portfólio central de projetos sem fundir os workspaces das organizações clientes.

Cada projeto representa uma relação operacional entre uma organização gestora e uma organização cliente. A concessão de acesso a um projeto não deve conceder acesso geral ao workspace RSBUILD, a outros clientes ou aos dados financeiros de outro tenant.

Uma pessoa pode ter papéis diferentes em organizações e projetos diferentes. O acesso deve ser concedido por escopo explícito, não inferido apenas pela existência de uma conta ou vínculo em outra organização.

## 5. Estado da implementação na PR #40

A PR #40 implementa a primeira base do portfólio:
- projetos associados à organização gestora e à organização cliente;
- concessão de acesso organizacional ao projeto;
- concessões individuais por projeto como estrutura de associação;
- sprints, tarefas, dependências e entregáveis;
- políticas RLS e APIs autenticadas para as operações descritas na PR;
- workspace “Projetos e Sprints” integrado à navegação existente;
- redirecionamento da antiga Zona das Sprints para a visão central, evitando um segundo painel estático.

Os projetos iniciais são Mundo do Sabor e Hub Açaí, em estado `planning`. Não se devem criar sprints ou tarefas fictícias. A matriz oficial aprovada do Ciclo 01 v2.2 deve ser importada preservando seu conteúdo.

### Limites conhecidos desta etapa

- A interface/fluxo de gestão de concessões de acesso a usuários específicos ainda precisa ser implementado e validado antes de afirmar que o gerenciamento completo de membros está pronto.
- O acesso organizacional do cliente e as concessões individuais são mecanismos distintos; não presumir que um substitui o outro.
- O estado de um entregável não equivale a aceite formal ou contratual do cliente.
- Cadastro/convidamento de usuários clientes, aprovação formal, comentários, anexos e histórico detalhado de decisões permanecem fora do escopo implementado até que sejam especificados e construídos.
- A migração não deve ser considerada aplicada em produção sem execução e evidência explícitas.
- A PR não deve ser considerada pronta para merge apenas com base na existência do código; build, typecheck, testes RLS/pgTAP e validação visual precisam ser confirmados no head atual.

## 6. Próxima entrega: gestão de acessos integrada à interface

A próxima evolução deve acrescentar uma área administrativa discreta de **Acessos e Permissões**, mantendo a navegação e as funcionalidades operacionais do conceito original.

Escopo funcional inicial:
1. Listar usuários elegíveis já existentes, sem criar convites implicitamente.
2. Consultar a organização e os projetos aos quais cada pessoa pode receber acesso.
3. Conceder acesso a um projeto com escopo e papel explícitos.
4. Revogar a concessão sem excluir a identidade ou o vínculo organizacional.
5. Exibir o estado atual da concessão e registrar quem realizou a alteração e quando, conforme suporte do modelo de auditoria.
6. Validar autorização no servidor e RLS; não confiar em controles visuais como barreira de segurança.

Antes de implementar, confirmar o modelo atual de identidade e membership no repositório e no schema de validação. Não presumir que todos os usuários de uma organização são automaticamente elegíveis ou que existe um mecanismo de convite pronto.

## 7. Evolução posterior — sem antecipar escopo

Depois de estabilizar a gestão de acessos, a arquitetura poderá evoluir incrementalmente para:
- **Module Registry:** catálogo e habilitação de módulos;
- **Agent Registry:** registro e escopo de agentes;
- **Integration Contracts:** contratos para integração entre módulos e sistemas;
- **Audit Trail:** trilha consistente de concessões, operações e decisões.

Esses componentes são direções arquiteturais futuras. Não devem ser introduzidos como dependências do MVP nem justificar uma reestruturação prematura.

Agentes e módulos devem obedecer ao mesmo princípio: capacidade técnica não equivale a autoridade. Cada execução deve respeitar identidade, escopo e autorização explícita.

## 8. Regras de decisão para a evolução

Toda mudança futura deve responder afirmativamente a estes critérios:
- Preserva as funcionalidades e a experiência escolhidas para o RSBUILD?
- Mantém isolamento entre organizações e projetos?
- Valida ações no backend e no banco, além da interface?
- Evita duplicar identidade, navegação ou gestão de acesso em cada módulo?
- É necessária para a entrega atual ou pode ficar para uma etapa posterior?
- Pode ser testada com usuários autorizados, usuários sem concessão e organizações distintas?

## 9. Critério de sucesso

O RSBUILD mantém uma experiência operacional unificada, enquanto pessoas e organizações acessam somente os recursos e dados autorizados. Novas funcionalidades podem ser incorporadas gradualmente sem descaracterizar a interface, quebrar o isolamento entre tenants ou reconstruir a governança a cada integração.
