# RSBUILD — Release & Environment Control V1

**Status:** baseline operacional  
**Updated:** 2026-11-26  
**Repository:** `symbeon-labs/rsbuild-finance-app`

## 1. Objetivo

Garantir rastreabilidade entre código, implantação e homologação por organização. O controle separa quatro fatos que não podem ser tratados como equivalentes:

1. **IMPLEMENTED** — código existe no repositório.
2. **DEPLOYED** — commit está presente na implantação identificada.
3. **TECHNICALLY_VALIDATED** — CI, testes, typecheck e build passaram.
4. **FUNCTIONALLY_VALIDATED** — fluxo foi exercitado por usuário autenticado no workspace/organização correspondente, com evidência registrada.
5. **APPROVED** — responsável autorizado aceitou o resultado.
6. **RELEASED** — funcionalidade foi liberada para uso operacional segundo entitlement, ambiente e autorização.

CI verde não é aceite funcional. Deploy READY não prova que cada organização validou o fluxo.

## 2. Modelo de implantação confirmado

O RSBUILD OS atual usa **um projeto Vercel compartilhado** (`rsbuild-finance-app`) ligado ao repositório `symbeon-labs/rsbuild-finance-app`. O código da aplicação é implantado uma vez e atende os workspaces multi-tenant. Mundo do Sabor, Hub Açaí e RSBUILD não são, no modelo atual, três projetos Vercel independentes.

Consequências:

- Um novo deploy de `main` entrega a mesma versão de código aos workspaces atendidos pelo projeto compartilhado.
- Isso **não** concede automaticamente módulos, permissões ou acesso a dados. Essas decisões continuam dependentes de memberships, capabilities, entitlements, ambiente e RLS.
- A validação funcional continua sendo por organização: um teste no Mundo do Sabor QA não aprova o Hub Açaí QA nem a produção.
- Os manifests em `deployment/clients/*.example.json` são exemplos de deployments standalone; não representam os tenants do projeto multi-tenant compartilhado.

## 3. Ambientes e organizações

| Camada | Identificador | Finalidade | Regra de aceite |
|---|---|---|---|
| Engenharia | DEV | Construção e CI | testes automatizados, typecheck e build |
| Laboratório | SANDBOX | Experimentos internos isolados e dados sintéticos | evidência técnica; nunca equivale a aceite do cliente |
| Homologação | `mundo_sabor_qa` | Primeiro ambiente de referência | testes funcionais autenticados e evidências por fluxo |
| Homologação | `hub_acai_qa` | Segundo ambiente; prova de generalização | repetir os testes aplicáveis com contexto e dados próprios |
| Institucional | RSBUILD | Governança, administração e operação central | validar superfícies institucionais e limites de autoridade |
| Operação | Mundo do Sabor / Hub Açaí | Produção de cada organização | liberar somente capabilities aprovadas e licenciadas |

## 4. Matriz de release por organização

Cada release que altera um fluxo deve atualizar a matriz abaixo em uma PR de release ou registro de QA. Não preencher como aprovado sem evidência reproduzível.

| Área / fluxo | Mundo do Sabor QA | Hub Açaí QA | RSBUILD | Produção |
|---|---|---|---|---|
| Login, troca de workspace e identidade do tenant | PENDENTE por release | PENDENTE por release | PENDENTE por release | smoke test pós-deploy |
| Navegação e capabilities | PENDENTE por release | PENDENTE por release | validar catálogo institucional | validar entitlement de produção |
| Financeiro e movimentações | REFERÊNCIA inicial | PENDENTE independente | validar se aplicável | smoke test sem escrita destrutiva |
| Importações CSV/OFX/XLSX e Data Intake | PENDENTE por release | PENDENTE independente | validar governança | bloqueado até aceite funcional |
| Centro de Operações em Lote | PENDENTE por release | PENDENTE independente | validar se habilitado | smoke test após liberação |
| Conciliação e baixas | PENDENTE por release | PENDENTE independente | validar governança | bloqueado até aceite funcional |
| Torre de Controle e auditoria | PENDENTE por release | PENDENTE independente | PENDENTE por release | validar acesso e escopo |
| Responsividade desktop/mobile | PENDENTE por release | PENDENTE independente | PENDENTE por release | smoke test visual |
| Isolamento entre organizações (RLS/API) | obrigatório | obrigatório | obrigatório | obrigatório |

**Referência histórica:** a PR #152 registra homologação de sete planilhas reais do Mundo do Sabor e 168/168 testes automatizados naquele ciclo. Isso é evidência daquele ciclo específico, não aprovação automática de mudanças posteriores. A PR #159 registra validações técnicas de Data Intake, mas também informa que o job de homologação funcional autenticada entre organizações foi skipped; portanto, Data Intake continua sem aceite funcional multi-tenant registrado.

## 5. Gate técnico de produção

A integração nativa Git do Vercel é responsável por criar a implantação de produção a partir de `main`. O workflow `.github/workflows/deploy-production.yml` deve:

1. executar `npm ci`, `npm test` e `npm run typecheck`;
2. consultar a API Vercel para encontrar a implantação de produção cujo `githubCommitSha` seja exatamente `GITHUB_SHA`;
3. concluir com sucesso somente quando essa implantação estiver `READY`;
4. falhar se a implantação terminar em `ERROR`, `CANCELED` ou `BLOCKED`, ou se não aparecer dentro da janela de espera.

O workflow **não deve criar uma segunda implantação** com `vercel deploy`. Isso evita consumir quota de deployments duplicados quando a integração Git já publicou o mesmo commit.

## 6. Gate funcional por release

Para cada mudança visível ou operacional:

- registrar o SHA implantado;
- identificar organização, ambiente, capability e usuário de teste;
- usar dados sintéticos ou dados autorizados para QA;
- executar os fluxos afetados em Mundo do Sabor QA e Hub Açaí QA separadamente;
- testar tentativa de acesso cruzado entre tenants quando houver alteração de API, RLS, membership ou entitlement;
- registrar resultado, observação, impacto e referência de evidência no QA Evaluation Registry;
- obter aceite do responsável antes de marcar APPROVED.

Se uma organização não usa determinado módulo, registrar **N/A com justificativa**, nunca marcar como aprovado por herança do outro tenant.

## 7. Regras de segurança e promoção

- Nenhuma PR de feature deve aplicar migrations remotas ou alterar dados operacionais como efeito colateral de CI.
- Nenhum deploy de código deve ampliar capabilities ou memberships.
- QA e Sandbox nunca concedem acesso à produção.
- Falha de consulta de entitlement deve continuar fail-closed.
- Dados de QA/Sandbox não devem ser copiados para outro tenant.
- Nenhum teste de conciliação ou baixa deve executar decisão financeira automática sem confirmação humana e trilha de auditoria.
- Não promover Data Intake, conciliação, baixas ou integrações externas para operação real sem aceite funcional explícito e revisão de segurança.
- Deploy compartilhado significa distribuição de código; não significa ativação comercial nem homologação de todos os tenants.

## 8. Baseline observado em 2026-11-26

- `main`: `958926329d01640c2ac3ab45b1dca97024833d68`.
- Vercel production deployment: `READY`, vinculado ao mesmo SHA e aos aliases `rsbuild-os.vercel.app` e `rsbuild-finance-app.vercel.app`.
- CI `validate`: sucesso; 168 testes passaram e typecheck passou.
- O workflow antigo de deploy manual falhou ao executar `vercel deploy --prebuilt --prod` com `api-deployments-free-per-day` (limite de 100 deployments/dia). O deploy nativo Git já estava READY; a falha foi a tentativa duplicada de publicar.
- A alteração deste ciclo remove a publicação duplicada e transforma o workflow em verificação da implantação nativa. A correção precisa passar pelo CI de PR antes de entrar em `main`.

## 9. Critério de conclusão

Considerar o controle operacional estabelecido somente quando:

- o workflow novo passar em PR e em um push de `main`;
- a implantação Vercel confirmada corresponder exatamente ao SHA do commit;
- a matriz de QA for preenchida com evidências independentes para Mundo do Sabor QA e Hub Açaí QA;
- o aceite institucional RSBUILD estiver registrado;
- nenhuma capability ou dado de produção tiver sido alterado sem autorização explícita.
