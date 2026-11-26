# RSBUILD Controlled AI — V1

## Objetivo

Estabelecer uma camada institucional para registrar configurações de provedores e credenciais vinculadas a um agente e a uma organização, sem conceder execução autônoma de operações.

## Escopo desta versão

- Configurar conexões para OpenAI, Anthropic, Google, xAI, API personalizada e servidor MCP.
- Vincular cada conexão a um par agente/organização que já possua concessão ativa.
- Registrar modalidade `internal`, `beta` ou `contractual`.
- Restringir o uso da concessão a `qa`, `sandbox` e/ou `production`.
- Exigir modalidade contratual quando o ambiente `production` for incluído.
- Armazenar credenciais com AES-256-GCM usando o mecanismo criptográfico server-only já utilizado pelas integrações ERP.
- Retornar apenas dica mascarada da credencial; nunca retornar o segredo ou o ciphertext.
- Desativar conexões sem apagar o histórico da configuração.
- Registrar configuração e desativação na trilha de auditoria institucional.
- Restringir gerenciamento global ao privilégio explícito `is_platform_administrator()`.

## Modelo de dados

### `agent_organization_grants`

A migration acrescenta:

- `access_mode`: `internal | beta | contractual`.
- `entitled_environments`: lista explícita de ambientes.
- `expires_at`: validade opcional.

Concessões preexistentes recebem `internal` e `qa` como padrão seguro. A inclusão de `production` exige `contractual`.

### `agent_integrations`

Armazena provedor, nome, endpoint HTTPS opcional, modelo, credencial criptografada, dica mascarada, estado e metadados de auditoria. A chave estrangeira composta exige uma concessão agente/organização existente.

As roles `anon` e `authenticated` não recebem privilégios diretos nessa tabela. O acesso é feito por rotas server-side com sessão autenticada, verificação de `is_platform_administrator()` e Service Role.

## Limites explícitos

Esta versão **não**:
- testa conectividade com o provedor;
- executa chamadas a modelos ou servidores MCP;
- disponibiliza credenciais ao browser;
- executa propostas HITL;
- concede grants novos para agentes sem concessão previamente provisionada;
- substitui a homologação de segurança ou a validação de cada conector.

A interface informa que uma conexão está configurada, mas ainda não verificada.

## Critérios de aceite

1. Usuário sem privilégio de plataforma recebe 403 nas rotas administrativas.
2. Conexões só podem ser criadas para concessões ativas.
3. Credenciais são criptografadas no servidor e a API retorna apenas uma dica mascarada.
4. A tabela de integrações não concede SELECT/INSERT/UPDATE/DELETE às roles de cliente.
5. Concessões existentes ficam restritas a QA por padrão.
6. Produção só pode ser concedida na modalidade contratual.
7. Desativar conexão altera seu estado sem apagar o registro.
8. Decisões HITL continuam limitadas a administrador de plataforma ou owner do tenant correspondente.
9. A autoridade de governança global não é inferida de membership owner da organização RSBUILD.


## Governança de inteligências — camada de atribuição

A evolução V1 adiciona uma separação explícita entre catálogo, atribuição, conexão e concessão:

- `intelligence_registry` é o catálogo canônico de identidades de inteligências.
- `legacy_agent_id` mantém vínculo 1:1 com registros existentes em `agents`; os registros antigos são tratados como projeção de compatibilidade do runtime. A migration faz o backfill sem apagar nem alterar os agentes existentes.
- `intelligence_assignments` registra a atribuição de uma inteligência a uma organização, com estado, modalidade, ambientes, validade e aprovador.
- `intelligence_connections` guarda conexões por identidade canônica e organização, inclusive LLMs e motores de decisão; `agent_integrations` permanece como compatibilidade do runtime legado. Salvar credenciais não altera modalidade comercial, ambientes ou validade de uma concessão.
- `agent_organization_grants` continua sendo a concessão legada exigida pelo runtime atual. A camada de atribuição não cria nem modifica grants legados automaticamente.

### Aprovação e auditoria

A criação/aprovação e revogação de atribuições ocorre por funções SQL com verificação independente de `is_platform_administrator()`. A alteração da atribuição e o respectivo evento em `audit_events` são executados na mesma transação: se a auditoria falhar, a alteração também é revertida.

### Contratos

O campo `config_schema_version` versiona o contrato JSON não secreto. O banco exige um objeto JSON e, quando presentes, `input` e `output` devem ser objetos. A validação semântica específica por tipo/provedor deverá evoluir por versões de contrato; esta etapa não executa nem interpreta os contratos.

### Limites e migração gradual

- Não há execução de inteligências nesta etapa.
- Uma atribuição não cria credenciais, não cria um grant legado e não habilita produção no runtime.
- Os agentes legados continuam disponíveis como projeção de compatibilidade, vinculados ao catálogo pelo campo `legacy_agent_id`.
- Cadastro, desativação, atribuição, revogação e configuração/desativação de conexões canônicas usam RPCs transacionais: a mutação e o evento de auditoria confirmam ou revertem juntos.
- Implementações privilegiadas ficam no schema não exposto `private`; funções públicas são wrappers `SECURITY INVOKER`, com execução concedida somente a `authenticated`. Cada implementação privada revalida sessão e autoridade de plataforma.
- Configurar credenciais só é permitido depois de uma atribuição ativa em QA ou Sandbox. Revogar uma atribuição ou desativar a inteligência desativa automaticamente as conexões correspondentes.
- O cadastro no Registry não aceita mais credenciais. Elas só entram na etapa de conexão, após a autorização.
- Nenhuma migration deve ser aplicada em produção antes da homologação de banco, API e regressão.


### Fluxo homologável nesta versão

1. Cadastrar a identidade no Registry sem credenciais.
2. Aprovar uma atribuição para uma organização em QA ou Sandbox.
3. Configurar uma conexão vinculada à identidade canônica e à organização; a API e a função SQL exigem atribuição ativa e não expirada.
4. Consultar apenas metadados e hint mascarado; o segredo cifrado nunca é devolvido.
5. Revogar a atribuição ou desativar a identidade; conexões são desativadas automaticamente.
6. Nenhuma etapa verifica conectividade, invoca o provedor ou executa a inteligência.

O fluxo canônico usa `intelligence_connections`; o endpoint antigo `agent-integrations` foi endurecido para exigir atribuição ativa quando opera sobre agentes legados. A camada de execução ainda não consome as novas conexões.
