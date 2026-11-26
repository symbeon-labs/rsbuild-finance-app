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
