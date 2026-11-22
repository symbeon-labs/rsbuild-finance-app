# OIDA-03 — Standalone Runtime Decoupling Roadmap

**Status:** planejado; não implementado  
**Depends on:** OIDA-01 (Deployment Identity Core) and OIDA-02 (Server Deployment Resolver)  
**Target:** permitir que o Product Runtime opere sem dependência obrigatória da identidade, dos serviços ou da disponibilidade institucional da RSBUILD.

## 1. Objective

Remover do caminho crítico de inicialização e operação do cliente as dependências exclusivas do Control Plane RSBUILD, preservando a autorização por usuário, membership, RBAC, entitlements e RLS.

OIDA-03 deve tornar o runtime capaz de operar em dois modos explícitos:
- `managed_shared`: implantação multi-organização gerenciada, mantendo os fluxos institucionais existentes quando habilitados;
- `standalone`: implantação do cliente sem exigir organização `rsbuild`, Access Directory, RPC de administrador da plataforma ou credenciais administrativas centrais.

OIDA-03 não provisiona infraestrutura nem declara uma implantação independente pronta. Provisionamento, releases e handover pertencem à OIDA-04/OIDA-05.

## 2. Workstreams

### A. Runtime dependency inventory
- Inventariar referências a slug `rsbuild`, `is_platform_administrator()`, Access Directory, grants institucionais e clientes Supabase administrativos.
- Classificar cada ocorrência como Product Runtime, Control Plane, compatibilidade legada ou teste.
- Mapear rotas, layouts, Server Actions, middleware e componentes que falham se o Control Plane estiver indisponível.
- Registrar dependências externas e integrações que ainda assumem recursos compartilhados.

**Deliverable:** inventário rastreável com arquivo, símbolo, fluxo afetado, modo aplicável e risco.

### B. Explicit runtime boundary
- Definir interfaces server-side para identidade de deployment, organização atual, capabilities e acesso opcional ao Control Plane.
- Injetar o `DeploymentContext` validado do OIDA-02 nos serviços de runtime por composição server-side.
- Proibir resolução de identidade por query string, cookies não confiáveis, body, headers ou metadados de usuário.
- Evitar imports de módulos Control Plane em caminhos de execução standalone.
- Manter contratos de domínio independentes de detalhes de implantação.

**Deliverable:** boundary e composição documentados, com dependências verificáveis e sem fallback silencioso para `rsbuild`.

### C. Organization and authorization resolution
- Substituir allowlists/slugs fixos usados como identidade operacional por resolução explícita vinculada ao deployment.
- Em `managed_shared`, resolver a organização configurada e validar membership do usuário autenticado.
- Em `standalone`, usar a organização local do deployment sem consultar diretório institucional.
- Preservar Auth, membership, RBAC, entitlements e RLS como autoridades de autorização.
- Não aceitar `organization_id` fornecido pelo cliente sem validação server-side.
- Revisar RPCs e políticas para garantir que nenhuma rota standalone dependa de privilégios cross-tenant.

**Deliverable:** matriz de autorização por modo e testes negativos de isolamento.

### D. Control Plane isolation
- Tornar Access Directory, portfolio administration, institutional grants e funções de plataforma explicitamente opcionais.
- Bloquear ou omitir essas superfícies quando `controlPlane.mode = disabled`.
- Quando `remote`, tratar indisponibilidade do Control Plane como falha apenas das funções institucionais, não do núcleo operacional do cliente.
- Garantir que nenhuma service-role key central seja exigida pelo Product Runtime standalone.
- Não converter ausência de Control Plane em bypass de autorização.

**Deliverable:** rotas e navegação separadas por capability/control-plane mode, com falha segura.

### E. Supabase client boundaries
- Fazer os clientes de Auth/Database/Storage consumirem a configuração do deployment resolvida no servidor.
- Preservar o padrão SSR e a separação entre publishable key e secret key.
- Isolar qualquer cliente administrativo em módulo server-only e restringi-lo ao caso de uso estritamente necessário.
- Não expor segredos em componentes client, respostas HTTP, logs ou bundles.
- Evitar alterar schema/RLS nesta etapa sem uma proposta e aprovação específicas.

**Deliverable:** mapa de clientes por contexto e testes que provem a ausência de credenciais centrais no bundle/runtime standalone.

### F. Compatibility and migration path
- Representar a implantação compartilhada atual como `managed_shared`, sem mudar silenciosamente sua identidade ou seus dados.
- Criar caminho de compatibilidade explícito para slugs e configurações legadas durante a transição.
- Não renomear organizações, reescrever IDs, mover dados ou remover tabelas/RPCs como parte automática da refatoração.
- Planejar eventual limpeza de compatibilidade como etapa separada, após evidência de uso e aceite.

**Deliverable:** plano de migração reversível e matriz de compatibilidade.

## 3. Suggested implementation sequence

1. **OIDA-03A — Inventory and dependency map:** levantamento estático completo e baseline de testes.
2. **OIDA-03B — Runtime composition boundary:** interfaces e injeção do contexto validado, sem mudar comportamento de produção.
3. **OIDA-03C — Organization resolver:** resolução por deployment e membership, com compatibilidade managed_shared.
4. **OIDA-03D — Control Plane isolation:** separar Access Directory e funções institucionais do caminho operacional.
5. **OIDA-03E — Supabase client isolation:** clientes por deployment, SSR, Storage e administração server-only.
6. **OIDA-03F — Standalone acceptance:** harness de testes e validação em ambiente isolado, sem apontar para produção.

As etapas podem ser agrupadas em PRs pequenas conforme o risco e a dependência entre arquivos. Não presumir que OIDA-03 precisa ser uma única PR.

## 4. Acceptance gates

OIDA-03 só poderá ser considerada concluída quando todos os gates abaixo tiverem evidência:

- [ ] Nenhum caminho crítico standalone exige slug `rsbuild`.
- [ ] Nenhuma rota ou serviço standalone consulta Access Directory ou RPC de administrador institucional.
- [ ] Operações essenciais continuam disponíveis com Control Plane desabilitado e indisponível.
- [ ] Usuários sem membership/role/entitlement apropriado continuam bloqueados.
- [ ] Testes negativos comprovam isolamento entre organizações e ausência de acesso cross-tenant.
- [ ] Nenhum segredo central ou service-role key aparece em bundles client, respostas ou logs.
- [ ] O modo `managed_shared` preserva os fluxos atuais validados, sem regressão.
- [ ] O modo `standalone` passa por testes de integração com infraestrutura isolada e dados descartáveis.
- [ ] Typecheck, lint, testes, build e runtime QA passam no SHA candidato.
- [ ] Evidências de QA e plano de rollback são anexados antes de qualquer promoção.

## 5. Explicit non-goals

OIDA-03 não deve:
- criar ou migrar projetos Supabase;
- aplicar migrations ou DDL em produção;
- alterar dados reais de clientes;
- criar/rotacionar secrets ou credenciais;
- configurar domínios, projetos Vercel ou pipelines de release;
- executar cutover de Mundo do Sabor ou Hub Açaí;
- remover mecanismos de autorização para facilitar o desacoplamento;
- declarar independência operacional apenas com base em configuração ou testes unitários.

Esses itens dependem de planejamento e autorização próprios, especialmente OIDA-04 e OIDA-05.

## 6. Risks and controls

| Risk | Control |
|---|---|
| Regressão no workspace compartilhado | Testes de caracterização e regressão managed_shared antes de cada refatoração |
| Bypass de autorização ao remover dependência RSBUILD | Membership/RBAC/RLS permanecem obrigatórios; testes negativos |
| Vazamento de service-role key | Módulos server-only, inspeção de bundles e testes de resposta/log |
| Fallback silencioso para organização padrão | Falha fechada; proibir default institucional implícito |
| Quebra de integrações e Storage | Inventário de dependências e testes por deployment |
| Cutover prematuro | OIDA-03 termina em ambiente isolado; OIDA-04/05 e aceite explícito precedem migração |

## 7. Exit criteria and next phase

A saída de OIDA-03 é um Product Runtime comprovadamente independente do Control Plane RSBUILD, exercitado em ambiente standalone isolado e mantendo compatibilidade managed_shared.

Após esse aceite:
- **OIDA-04:** provisionamento por deployment, Supabase/Auth/Storage, secrets, domínios e pipelines de release independentes.
- **OIDA-05:** backup/restore, exportação, retenção, handover operacional e evidência de recuperação por cliente.

**Decision rule:** nenhuma alteração em Supabase remoto, migrations, QA compartilhado ou produção sem plano específico, evidência de teste e autorização explícita.
