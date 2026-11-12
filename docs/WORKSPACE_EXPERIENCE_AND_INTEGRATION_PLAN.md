# RSBUILD Finance — Auditoria de integração e plano Workspace Experience

**Data da auditoria:** 2026-11-10  
**Base examinada:** `main` em `c5b78fd6915cdab3dfda586fd628879b308f82c1`  
**Integração D02 candidata:** PR #24, head `a52d9007f157173d00eb6c09d7f0bdce4c490aea`  
**Status deste documento:** plano técnico e de produto; não autoriza merge, deploy ou aplicação de migrations remotas.

---

## 1. Decisão executiva

Manter a PR #24 como única linha candidata de integração da fundação D02, condicionada à conclusão da persistência operacional multi-tenant, à recuperação seletiva de correções da PR #20 e à homologação ponta a ponta.

Em paralelo, aprovar a direção de produto **Workspace Experience** com três perspectivas sobre a mesma plataforma e a mesma fonte de verdade:

- **Execution Workspace:** execução de tarefas e tratamento de pendências.
- **Management Workspace:** acompanhamento de equipes, controles, aprovações e indicadores.
- **Executive Workspace:** leitura financeira, riscos, resultados e decisões.

Não criar três aplicações nem três bases de dados. As perspectivas compartilham domínio, dados, autorização e trilha de auditoria; variam navegação, densidade de informação e ações permitidas.

## 2. Evidências da auditoria

### 2.1 Estado da PR #24

- PR #24: https://github.com/symbeon-labs/rsbuild-finance-app/pull/24
- Branch: `integration/d02-main-reconciled-2026-11-09`
- Head auditado: `a52d9007f157173d00eb6c09d7f0bdce4c490aea`
- Base `main`: `c5b78fd6915cdab3dfda586fd628879b308f82c1`
- Comparação GitHub: 48 commits à frente, 0 atrás; status `ahead`.
- CI no head auditado: concluído com sucesso (run 42734995789).
- Database Tests no head auditado: concluído com sucesso (run 42734995581).

Os resultados de CI e Database Tests são evidência dos workflows executados nesse SHA. Não substituem teste de fluxo real, teste de isolamento entre organizações, validação de convite por e-mail ou aceite operacional.

O corpo da PR declara que permanece Draft e que não há autorização para merge/deploy. A metadata consultada anteriormente indicava `draft=false`. Resolver essa inconsistência administrativa antes da revisão final; o estado da PR não altera os gates técnicos.

### 2.2 Persistência e isolamento ainda incompletos

A leitura de `app/enterprise-workspace.tsx` na `main` confirmou estado operacional inicializado por amostras e persistido em `localStorage`, incluindo as chaves:

- `rsbuild_session_records`
- `rsbuild_session_titles`
- `rsbuild_session_proofs`
- `rsbuild_session_orders`

A hidratação e os watchers de autosave usam essas chaves sem escopo organizacional. A seleção de organização não transforma esse armazenamento local em persistência isolada. O workspace ainda contém ações que atualizam estado local e notificam que dados foram adicionados à sessão.

A PR #24 acrescenta autenticação SSR, membership gate, endpoints server-side de importação, convite e branding, migrations e testes. Contudo, o próprio corpo da PR registra como pendentes a passagem do tenant context por todos os módulos, a substituição do estado operacional local, a integração da UI de importação e a hidratação dos registros persistidos.

**Conclusão:** não aprovar a integração como entrega de persistência operacional completa. A fundação D02 está avançada, mas a aplicação ainda não opera integralmente sobre uma fonte de verdade multi-tenant.

### 2.3 Recuperação seletiva da PR #20

PR #20: https://github.com/symbeon-labs/rsbuild-finance-app/pull/20

A PR #20 contém contribuições corretivas relevantes:

- identidade OFX estável com atributos de origem, em vez de depender apenas do hash do arquivo/posição;
- carregamento paginado de registros para evitar indicadores e conciliação calculados sobre uma página parcial;
- filtros de período aplicados às agregações e à listagem;
- documentação de consolidação e plano de implementação.

A PR #24 não deve ser substituída pela antiga `FinanceWorkspace` da #20. A #24 preserva a `EnterpriseWorkspace`, que contém os módulos comerciais e operacionais existentes. Recuperar e adaptar apenas as correções de domínio e paginação, com testes no contexto da arquitetura preservada.

A identidade OFX deve incluir os identificadores estáveis disponíveis do banco/conta e FITID, com política documentada para FITID reutilizado. Não presumir que `sourceRecordId` isolado seja globalmente único.

### 2.4 Convites, papéis e branding

A PR #24 implementa endpoint de convite que verifica membership do solicitante e restringe concessão de Admin ao Owner. A rota também cria membership e registro de convite.

Pendências de homologação e robustez:

- comportamento com endereço que já possui usuário Auth;
- aceitação do convite e callback PKCE em fluxo real;
- falha parcial entre envio do convite, criação de membership e auditoria;
- transição de status para aceito/expirado/revogado;
- SMTP customizado para entrega externa;
- revogação de membership e efeito imediato na sessão;
- prevenção de autoaprovação e segregação de funções para operações financeiras.

O banner organizacional usa bucket público. O arquivo pode ser acessado por URL pública. Essa decisão deve ser aceita conscientemente; se imagens puderem conter conteúdo confidencial, mudar para bucket privado e URLs assinadas antes do uso.

### 2.5 Migrations Supabase: afirmações que não podem ser confundidas

A PR #23 declara que `20261109130004_d02_transactional_imports` foi aplicada ao projeto Supabase vinculado e registrada no histórico remoto. A PR #24 adiciona outras migrations, incluindo `20261110013000_d02_organization_admin_and_branding.sql`.

Essas afirmações dizem respeito a migrations distintas. A evidência textual da PR #23 não comprova que as migrations posteriores da #24 estejam aplicadas. O estado remoto atual não foi consultado nesta auditoria; portanto, não afirmar que o conjunto da #24 está aplicado ou pendente no projeto remoto sem uma verificação autorizada do histórico de migrations.

Não aplicar migrations remotas como parte deste plano sem autorização explícita.

---

## 3. Matriz de destino das PRs

| PR | Decisão | Tratamento |
|---|---|---|
| #24 | Linha principal candidata | Manter como integração D02; concluir persistência, tenant isolation e homologação antes de merge |
| #20 | Recuperação seletiva | Portar identidade OFX, paginação e filtros de período para a EnterpriseWorkspace; não incorporar a FinanceWorkspace inteira |
| #21 | Não integrar | Linha histórica divergente; usar como referência documental e recuperar apenas correção exclusiva ainda ausente |
| #19 | Não integrar | Linha histórica anterior; não criar segunda integração concorrente |
| #12 | Não integrar | Fonte histórica de hardening; comparar somente correções exclusivas e já não cobertas pela #24 |
| #23 | Reconciliar documentação | Reaplicar documentos sobre a main pós-D02; revisar afirmações de migrations e limites arquiteturais |
| #13 | Avaliar após fundação | Preservar identidade visual do login se ainda não estiver na main; validar sobre auth SSR atual |
| #14 | Consolidar documentação | Incorporar baseline de execução e contratos sem duplicar documentos obsoletos |
| #15 | Adiar/reavaliar | Console técnico restrito; manter separado da experiência operacional e executiva, com allowlist server-side e revisão de necessidade |

Não fechar branches históricas antes de verificar e registrar o destino de cada contribuição exclusiva.

---

## 4. Arquitetura-alvo do Workspace Experience

### 4.1 Camadas

1. **Identity & Access:** sessão autenticada, membership, papel, escopo e política de ação.
2. **Organization Context:** organização ativa resolvida e validada no servidor; nunca confiar em organizationId fornecido pelo cliente sem revalidar membership.
3. **Domain & Persistence:** registros financeiros, títulos, comprovantes, pedidos, importações, aprovações e auditoria persistidos com chave de organização.
4. **Application Services:** casos de uso e APIs autorizadas; regras de negócio fora de componentes de apresentação.
5. **Workspace Experience:** Execution, Management e Executive como perspectivas da mesma aplicação.

### 4.2 Papéis iniciais

| Papel | Capacidades |
|---|---|
| Owner | Administração máxima da organização; gerencia Admins e configurações críticas; transfere propriedade por fluxo explícito |
| Admin | Gerencia usuários e configurações permitidas; não concede Owner nem transfere propriedade |
| Operator | Executa rotinas operacionais dentro do escopo atribuído; sem administração de membros |
| Viewer | Consulta dados e relatórios; sem escrita operacional |

O papel não é a única dimensão de autorização. Cada decisão deve considerar **papel + organização + escopo (unidade/centro de custo) + ação + estado do workflow**.

A autorização deve ser aplicada no servidor e no banco (RLS/RPC). Ocultar botões no cliente é apenas UX, nunca controle de segurança.

### 4.3 Matriz inicial de ações

| Ação | Owner | Admin | Operator | Viewer |
|---|---:|---:|---:|---:|
| Consultar dados da organização | Sim | Sim | Sim | Sim |
| Criar/importar registros | Sim | Sim | Sim | Não |
| Editar operação permitida | Sim | Sim | Sim, no escopo | Não |
| Aprovar operação | Conforme alçada | Conforme alçada | Não aprova a própria | Não |
| Convidar Viewer/Operator | Sim | Sim | Não | Não |
| Convidar Admin | Sim | Não | Não | Não |
| Alterar branding/configuração | Sim | Sim | Não | Não |
| Alterar papéis administrativos | Sim | Limitado | Não | Não |
| Conceder/transferir Owner | Fluxo explícito | Não | Não | Não |

Essa matriz é baseline de produto, não substitui regras de alçada, segregação de funções e escopo por unidade. Ações financeiras de alto impacto devem suportar aprovação independente e trilha de auditoria.

---

## 5. Três perspectivas de experiência

### 5.1 Execution Workspace — Operação

Objetivo: concluir tarefas com baixo atrito e estado explícito.

Áreas:
- Visão de trabalho: fila pessoal, pendências, prazos e prioridades.
- Movimentações: consulta, registro e classificação.
- Importações: envio, validação, processamento, duplicatas e falhas.
- Conciliação: correspondências, divergências e resolução.
- Títulos e baixas: workflow de conferência e execução.
- Comprovantes e pedidos: registro, validação e acompanhamento.

Cada tarefa deve mostrar status, responsável, prazo, evidência, motivo de bloqueio e próxima ação. Evitar dashboards densos como tela inicial do operador.

### 5.2 Management Workspace — Gestão

Objetivo: controlar execução e equipe.

Áreas:
- indicadores operacionais por período e unidade;
- fila de exceções e gargalos;
- responsáveis e distribuição de trabalho;
- aprovações pendentes e alçadas;
- qualidade dos dados e importações;
- auditoria de alterações e ações críticas.

Gestores precisam identificar desvios, delegar trabalho e acompanhar resolução sem executar manualmente cada rotina.

### 5.3 Executive Workspace — Diretoria

Objetivo: apoiar decisões, não replicar telas operacionais.

Áreas:
- posição financeira e fluxo de caixa;
- realizado versus previsto;
- receitas, despesas, custos e inadimplência;
- variações por período, unidade e centro de custo;
- riscos, exceções e compromissos críticos;
- decisões e aprovações que exigem alçada executiva;
- prestação de contas com drill-down até a evidência de origem.

Os KPIs devem ser derivados dos mesmos registros persistidos usados pela operação. Cada indicador deve ter definição, fórmula, período, escopo, data de atualização e possibilidade de rastrear a origem. Não apresentar dado de demonstração como dado real.

---

## 6. Plano de execução por fases

### Fase 0 — Governança da integração

- Confirmar o SHA atual da main e o head de todas as PRs.
- Resolver a inconsistência Draft metadata/body da #24.
- Mapear migrations por arquivo, ordem e histórico remoto em ambiente autorizado.
- Comparar #20/#21/#19/#12 com #24 e registrar destino de cada contribuição exclusiva.
- Não mesclar PRs históricas em cadeia.

**Gate:** ledger de integração revisado e uma única linha D02 definida.

### Fase 1 — Persistência operacional e tenant isolation

Inventariar todos os estados e mutações de:
- FinancialRecord / movimentações;
- títulos a receber e baixas;
- comprovantes/canhotos;
- pedidos e logística;
- categorias, configurações, filtros e preferências;
- importações, artefatos e proveniência.

Para cada entidade definir:
- schema e migration;
- organization_id obrigatório;
- relacionamentos e chaves estrangeiras compostas quando necessário;
- RLS para SELECT/INSERT/UPDATE/DELETE;
- serviço/API server-side;
- estados de loading/empty/error;
- política de paginação e agregação;
- auditoria e ator responsável.

Remover persistência operacional global em localStorage. localStorage pode permanecer para preferências não sensíveis e não autoritativas (tema, densidade, filtros locais), sem guardar dados financeiros ou substituir a fonte de verdade.

**Gate:** usuário de uma organização não consegue ler, alterar, importar, exportar ou inferir dados de outra; dados persistem após logout/login e troca de dispositivo.

### Fase 2 — Importação e integridade

- Conectar UI ao endpoint server-side de importação.
- Exibir preview, validação, progresso, contagens de inseridos/duplicados/rejeitados e erros acionáveis.
- Recuperar identidade OFX robusta da #20 e validar colisões FITID.
- Implementar idempotência, proveniência, retry seguro e compensação de Storage.
- Paginar consultas e garantir que indicadores usem todo o conjunto do período ou agregações do servidor.
- Não calcular totais executivos sobre apenas uma página parcial.

**Gate:** importação CSV/OFX homologada com amostras representativas, repetição do mesmo arquivo, OFX regenerado/reordenado, falha parcial e volume alto.

### Fase 3 — RBAC, convites e governança

- Consolidar enum de papéis e matriz de permissões.
- Implementar ciclo de convite: criado, enviado, aceito, expirado, revogado e falho.
- Tratar usuário Auth existente e convites duplicados.
- Garantir atomicidade ou compensação para convite/membership/auditoria.
- Implementar revogação e revalidação de sessão/membership.
- Criar trilha de auditoria para concessão, alteração e revogação.
- Definir escopo futuro por unidade e centro de custo.
- Aplicar segregação de funções e alçadas para aprovação financeira.

**Gate:** Owner/Admin/Operator/Viewer testados em duas organizações, com tentativa de acesso cruzado, revogação e convite real em ambiente de homologação.

### Fase 4 — Workspace Experience

- Definir shell de navegação comum e seletor de organização validado.
- Implementar Execution Workspace.
- Implementar Management Workspace.
- Implementar Executive Workspace.
- Aplicar menus, ações e densidade de informação por capacidade efetiva, não apenas por rótulo de papel.
- Garantir acessibilidade, responsividade e estados vazios/erro/carregamento.
- Usar componentes e tokens compartilhados; evitar duplicar lógica de domínio.

**Gate:** jornadas representativas de operador, gestor e diretoria aprovadas em desktop e mobile.

### Fase 5 — Release controlado

- CI completa no SHA final.
- Database Tests/pgTAP no conjunto final de migrations.
- Revisão de RLS, Security Advisor e Storage policies.
- Testes ponta a ponta multi-tenant e de papéis.
- Verificação de backups, rollback e runbook de migração.
- Homologação funcional e aceite do responsável pelo produto.
- Só então solicitar aprovação de merge e planejar deploy separado.

**Gate:** evidências anexadas à PR, SHA validado, migrations reconciliadas e aceite explícito.

---

## 7. Critérios de aceite transversais

1. Nenhum dado financeiro operacional depende de localStorage como fonte de verdade.
2. Toda entidade operacional tem escopo organizacional explícito.
3. Toda consulta e mutação verifica membership e autorização no servidor/banco.
4. Mudança de organização não reaproveita estado de outra organização.
5. Revogação de membership impede novas operações e invalida acesso conforme política de sessão.
6. Operador não aprova a própria operação quando houver segregação exigida.
7. Indicadores executivos são rastreáveis até registros e evidências de origem.
8. Importações são idempotentes e auditáveis.
9. A interface diferencia dado real, demonstração, incompleto e desatualizado.
10. Testes automatizados e homologação manual têm evidências separadas.

## 8. Fora de escopo nesta etapa

- Microservices: manter modular monolith até que limites operacionais justifiquem separação.
- BI genérico ou métricas sem fonte de verdade.
- Escrita automática em ERP sem contrato, autorização e homologação.
- Acesso de diretoria a segredos, logs sensíveis ou Developer Console.
- Aplicação de migrations remotas, merge ou deploy sem autorização explícita.
- Criar papéis ilimitados ou RBAC configurável antes de estabilizar os quatro papéis iniciais.

## 9. Próxima sequência recomendada

1. Fechar ledger de PRs e reconciliar contribuições exclusivas.
2. Mapear entidades e mutações da EnterpriseWorkspace para contratos persistidos multi-tenant.
3. Definir migrations e APIs para títulos, comprovantes e pedidos, além das movimentações já cobertas pela D02.
4. Recuperar paginação e identidade OFX da #20.
5. Homologar isolamento e RBAC.
6. Só então implementar as três perspectivas de experiência sobre a mesma base.

**Decisão final:** estabilizar a fundação e a fonte de verdade primeiro; especificar e preparar a experiência em paralelo; construir as perspectivas depois que persistência, tenant isolation e autorização tiverem evidência verificável.
