# F01.3 — Modelo Físico PostgreSQL

**Versão:** 0.1  
**Status:** Proposta técnica para revisão — não é migration e não está aprovada para aplicação  
**Branch:** `docs/f01-domain-model-2026-11-12`  
**Base:** F01.1 Modelo de Domínio; F01.2 Modelo Lógico consolidado; migrations D02 inspecionadas na branch  
**Escopo:** tipos PostgreSQL, chaves, constraints, índices, estratégia de integridade, segurança e sequência de implementação do ciclo financeiro.

> Este documento descreve o schema pretendido. Não cria tabelas, funções, triggers, grants, policies, migrations nem altera o Supabase. O SQL é especificação de implementação, não instrução para execução direta.

## 1. Resultado da inspeção do estado atual

### 1.1 Estruturas confirmadas nas migrations D02 examinadas

As migrations consultadas definem, entre outras, as seguintes estruturas:

- `organizations(id uuid)`;
- `organization_memberships(organization_id uuid, user_id uuid, role rsbuild_member_role)`;
- `financial_accounts`, com chave única `(organization_id,id)` e moeda BRL por padrão;
- `data_sources`, `import_batches` e `source_artifacts`, com identidade tenant-scoped;
- `financial_records`, com `amount_minor bigint`, `currency char(3)`, direção, origem, lote e FKs compostas por organização;
- `audit_events`, com ID identity global, organização, ator, tipo, entidade e metadados.

As migrations também habilitam RLS nas tabelas existentes e usam membership para delimitar acesso por organização. A migration de hardening remove grants inseguros para papéis cliente.

### 1.2 Lacunas confirmadas no conjunto examinado

Não foram encontradas, nas migrations examinadas:

- tabelas persistentes de contrapartes;
- títulos financeiros e parcelas;
- liquidações e suas alocações;
- alocações quantitativas entre movimentação bancária e liquidação;
- ajustes e eventos de estorno;
- decisões persistentes de conciliação;
- configuração/versionamento/aprovação de políticas financeiras.

A tabela `audit_events` não tem UNIQUE `(organization_id,id)`; portanto, este desenho não propõe FKs compostas para ela. O registro de auditoria será escrito pelo backend confiável, usando a tabela existente.

### 1.3 RBAC existente — limite importante

O enum de membership possui `owner`, `admin`, `operator`, `viewer`. `lib/permissions.ts` mapeia owner/admin como executivos para funções de interface e documenta alçadas de gestão. Isso não constitui, isoladamente, uma autorização granular persistida e validada no banco para cada comando financeiro.

**Decisão:** não criar outro sistema genérico de papéis nesta etapa. Os comandos F01 devem validar membership ativa e permissões específicas no backend. A delegação financeira fica modelada em tabela própria, mas sua integração com o mecanismo central de autorização é pré-requisito de implementação. Nenhum cliente/browser pode definir o ator ou a permissão.

## 2. Convenções físicas

| Elemento | Padrão |
|---|---|
| Schema | `public` apenas para tabelas acessíveis pela aplicação; funções privilegiadas, se inevitáveis, em schema não exposto |
| PK | `uuid primary key default gen_random_uuid()` |
| Tenant | `organization_id uuid not null` |
| FK tenant-scoped | `(organization_id, foreign_id)` para UNIQUE correspondente |
| Dinheiro | `bigint` em centavos/unidade menor; nunca float |
| Moeda MVP | `char(3) not null default 'BRL' check (currency = 'BRL')` nas tabelas operacionais do MVP |
| Datas | `date` para datas civis; `timestamptz` para instantes e auditoria |
| Estados | `text + CHECK` inicialmente, para reduzir acoplamento de enum em evolução |
| Payload externo | `jsonb` apenas para snapshot/metadados, não como substituto de colunas de integridade |
| Exclusão | Sem cascade destrutivo para registros financeiros confirmados; cancelamento/estorno por evento |
| Concorrência | `version integer` em agregados editáveis e comandos transacionais para saldos/alocações |

**BRL no MVP:** manter coluna de moeda para rastreabilidade e evolução, mas bloquear qualquer valor diferente de BRL no serviço e em CHECKs operacionais. A habilitação futura de múltiplas moedas exigirá migration deliberada e especificação cambial.

## 3. Mapa das tabelas

| Tabela | Finalidade | Situação |
|---|---|---|
| `financial_counterparties` | Cadastro mestre de clientes/fornecedores | Nova |
| `financial_titles` | Título a pagar/receber | Nova |
| `financial_title_installments` | Parcelas do título | Nova |
| `settlements` | Evento de pagamento/recebimento | Nova |
| `settlement_allocations` | Parte da liquidação aplicada a título/parcela | Nova |
| `settlement_adjustments` | Juros, multa, desconto, tarifa e outros efeitos | Nova |
| `settlement_reversals` | Estorno compensatório total/parcial | Nova |
| `bank_settlement_allocations` | Valor de movimentação bancária consumido por liquidação | Nova |
| `reconciliation_decisions` | Decisão/sugestão de conciliação | Nova |
| `reconciliation_links` | Evidências tipadas de uma decisão | Nova |
| `financial_policy_configurations` | Identidade/estado da configuração por organização | Nova |
| `financial_policy_versions` | Conteúdo imutável de cada versão de política | Nova |
| `financial_policy_approvals` | Decisões append-only de aprovação/rejeição | Nova |
| `financial_policy_delegations` | Delegações de escopo e prazo | Nova, sujeita ao RBAC |

## 4. Definição física por tabela

### 4.1 `financial_counterparties`

Cadastro mestre tenant-scoped. Um registro pode representar cliente, fornecedor ou ambos.

| Coluna | Tipo PostgreSQL | Obrigatório | Regra |
|---|---|---:|---|
| `id` | uuid | Sim | PK |
| `organization_id` | uuid | Sim | FK para organizations |
| `party_kind` | text | Sim | CHECK: `person`, `company`, `other` |
| `display_name` | text | Sim | Nome de exibição |
| `legal_name` | text | Não | Razão/nome legal |
| `tax_identifier` | text | Não | CPF/CNPJ ou identificador estrangeiro; armazenar normalizado e protegido |
| `email` | text | Não | Contato |
| `phone` | text | Não | Contato |
| `external_reference` | text | Não | ID do ERP |
| `status` | text | Sim | `active`, `inactive`, `archived` |
| `created_at`, `updated_at` | timestamptz | Sim | Auditoria técnica |
| `created_by`, `updated_by` | uuid | Não | Derivados no backend |

Constraints/índices:
- PK `id`; UNIQUE `(organization_id,id)`.
- FK `organization_id → organizations(id)`.
- UNIQUE parcial `(organization_id, external_reference)` quando não nulo.
- Não impor unicidade universal por CPF/CNPJ sem validar regra de filial, múltiplos cadastros e qualidade dos dados.
- Índice `(organization_id, lower(display_name))`.
- Snapshot do título preserva nome e identificador fiscal no momento da confirmação; alterações no cadastro não reescrevem títulos anteriores.

**Dependência:** antes de criar esta tabela, verificar se existe cadastro mestre corporativo reutilizável fora das migrations D02 examinadas. Se houver, substituir esta tabela por FK ao domínio existente e manter snapshot histórico no título.

### 4.2 `financial_titles`

| Coluna | Tipo PostgreSQL | Obrigatório | Regra |
|---|---|---:|---|
| `id` | uuid | Sim | PK |
| `organization_id` | uuid | Sim | Tenant |
| `direction` | text | Sim | CHECK `receivable` / `payable` |
| `counterparty_id` | uuid | Não | FK composta para contraparte |
| `counterparty_snapshot` | jsonb | Sim | Snapshot validado pelo backend |
| `document_type` | text | Não | Tipo de documento |
| `document_number` | text | Não | Número apresentado |
| `external_reference` | text | Não | ID estável da origem |
| `description` | text | Sim | Descrição |
| `issue_date` | date | Não | Emissão |
| `competence_date` | date | Não | Competência |
| `due_date` | date | Não | Vencimento quando não parcelado |
| `original_amount_minor` | bigint | Sim | CHECK > 0 |
| `currency` | char(3) | Sim | BRL no MVP |
| `status` | text | Sim | `draft`, `open`, `partially_settled`, `settled`, `cancelled` |
| `source_type` | text | Sim | `manual`, `erp`, `import`, `other` |
| `data_source_id` | uuid | Não | FK composta |
| `import_batch_id` | uuid | Não | FK composta |
| `source_artifact_id` | uuid | Não | FK composta |
| `policy_version_id` | uuid | Não | Versão que regeu a confirmação |
| `created_by` | uuid | Sim | Ator do backend |
| `confirmed_by` | uuid | Não | Ator que confirmou |
| `confirmed_at` | timestamptz | Não | Instante de confirmação |
| `cancelled_by` | uuid | Não | Ator autorizado |
| `cancelled_at` | timestamptz | Não | Instante |
| `cancellation_reason` | text | Não | Justificativa |
| `version` | integer | Sim | Default 1; CHECK > 0 |
| `created_at`, `updated_at` | timestamptz | Sim | Timestamps |

Constraints:
- PK `id`; UNIQUE `(organization_id,id)`.
- FKs compostas para contraparte, `data_sources`, `import_batches`, `source_artifacts` e `financial_policy_versions`.
- CHECK `original_amount_minor > 0`; CHECK moeda BRL no MVP.
- CHECK de coerência: rascunho não confirmado; estados confirmados exigem `confirmed_at` e `confirmed_by`; cancelamento exige ator, instante e motivo.
- Índices: `(organization_id,direction,status,due_date)`, `(organization_id,counterparty_id)`, `(organization_id,created_at desc)`.
- Idempotência externa: UNIQUE parcial `(organization_id,data_source_id,external_reference)` somente quando referência estável existir. Não deduplicar por descrição/valor/data.
- `counterparty_snapshot` deve conter apenas campos permitidos e validados, sem payload arbitrário sensível.

### 4.3 `financial_title_installments`

| Coluna | Tipo PostgreSQL | Obrigatório | Regra |
|---|---|---:|---|
| `id` | uuid | Sim | PK |
| `organization_id` | uuid | Sim | Tenant |
| `financial_title_id` | uuid | Sim | FK composta |
| `installment_number` | integer | Sim | CHECK > 0 |
| `due_date` | date | Sim | Vencimento |
| `scheduled_amount_minor` | bigint | Sim | CHECK > 0 |
| `currency` | char(3) | Sim | Igual ao título |
| `status` | text | Sim | `open`, `partially_settled`, `settled`, `cancelled` |
| `created_at`, `updated_at` | timestamptz | Sim | Timestamps |

Constraints:
- PK `id`; UNIQUE `(organization_id,id)`.
- FK `(organization_id,financial_title_id)` → `financial_titles(organization_id,id)`.
- UNIQUE `(organization_id,financial_title_id,installment_number)`.
- Índice `(organization_id,due_date,status)`.
- A soma das parcelas deve fechar com o valor original antes da confirmação. Esta regra é cross-row e deve ser validada em comando transacional; não tentar implementá-la com CHECK simples.
- Não criar parcela artificial quando o ERP já representa cada parcela como título autônomo.

### 4.4 `settlements`

Representa o evento econômico de pagamento ou recebimento. Não é sinônimo de movimento bancário.

| Coluna | Tipo PostgreSQL | Obrigatório | Regra |
|---|---|---:|---|
| `id` | uuid | Sim | PK |
| `organization_id` | uuid | Sim | Tenant |
| `settlement_type` | text | Sim | `payment` / `receipt` |
| `settled_at` | timestamptz | Sim | Instante efetivo |
| `gross_amount_minor` | bigint | Sim | CHECK > 0 |
| `currency` | char(3) | Sim | BRL no MVP |
| `payment_method` | text | Não | Catálogo evolutivo |
| `financial_account_id` | uuid | Não | FK composta |
| `external_reference` | text | Não | Referência externa |
| `source_type` | text | Sim | `manual`, `erp`, `integration` |
| `source_payload_hash` | text | Não | Hash de payload |
| `idempotency_key` | text | Sim | Única por organização |
| `status` | text | Sim | `draft`, `confirmed`, `reversed` |
| `policy_version_id` | uuid | Não | Obrigatória na confirmação |
| `created_by` | uuid | Sim | Derivado da sessão/backend |
| `confirmed_by` | uuid | Não | Ator confirmador |
| `confirmed_at` | timestamptz | Não | Instante |
| `created_at` | timestamptz | Sim | Timestamp |

Constraints:
- PK `id`; UNIQUE `(organization_id,id)`; UNIQUE `(organization_id,idempotency_key)`.
- FK composta para `financial_accounts` e `financial_policy_versions`.
- CHECK `gross_amount_minor > 0`; moeda BRL no MVP.
- Estado confirmado exige versão de política, ator e timestamp.
- Índices `(organization_id,settled_at desc)`, `(organization_id,status)`.
- Registro confirmado não recebe UPDATE/DELETE pela role cliente.

**Liquidação sem alocação:** não deve ser interpretada como título liquidado. O comando de confirmação deve exigir alocação completa ou política aprovada que permita saldo não alocado, com classificação de adiantamento/crédito. A entidade de crédito/adiantamento ainda precisa de especificação própria; não improvisar uma coluna JSON para representar saldo.

### 4.5 `settlement_allocations`

| Coluna | Tipo PostgreSQL | Obrigatório | Regra |
|---|---|---:|---|
| `id` | uuid | Sim | PK |
| `organization_id` | uuid | Sim | Tenant |
| `settlement_id` | uuid | Sim | FK composta |
| `financial_title_id` | uuid | Sim | FK composta |
| `title_installment_id` | uuid | Não | FK composta |
| `principal_amount_minor` | bigint | Sim | CHECK > 0 |
| `currency` | char(3) | Sim | BRL no MVP |
| `created_at` | timestamptz | Sim | Timestamp |

Constraints:
- PK `id`; UNIQUE `(organization_id,id)`.
- FKs compostas para liquidação, título e parcela.
- CHECK de coerência entre parcela e título: quando parcela for informada, ela deve pertencer ao mesmo título. Requer FK composta ampliada ou validação transacional.
- Índices `(organization_id,settlement_id)`, `(organization_id,financial_title_id)`, `(organization_id,title_installment_id)`.
- Saldo disponível do título/parcela deve ser verificado com bloqueio de linha/controle concorrente no comando de alocação. CHECK não consegue garantir soma de várias linhas.
- A direção da liquidação deve ser compatível com a direção do título (payment/payable; receipt/receivable).

### 4.6 `settlement_adjustments`

| Coluna | Tipo PostgreSQL | Obrigatório | Regra |
|---|---|---:|---|
| `id` | uuid | Sim | PK |
| `organization_id` | uuid | Sim | Tenant |
| `settlement_id` | uuid | Sim | FK composta |
| `allocation_id` | uuid | Não | FK composta |
| `adjustment_type` | text | Sim | `interest`, `fine`, `discount`, `fee`, `rebate`, `other` |
| `effect` | text | Sim | `increase` ou `decrease` |
| `amount_minor` | bigint | Sim | CHECK > 0; magnitude positiva |
| `currency` | char(3) | Sim | BRL no MVP |
| `reason` | text | Sim | Justificativa |
| `source_reference` | text | Não | Referência de origem |
| `created_by` | uuid | Sim | Ator do backend |
| `created_at` | timestamptz | Sim | Timestamp |

Constraints:
- PK `id`; UNIQUE `(organization_id,id)`.
- FK composta para liquidação e, se preenchida, alocação da mesma liquidação.
- CHECK `amount_minor > 0`; CHECK `effect in ('increase','decrease')`.
- Índice `(organization_id,settlement_id)`.
- Composição aritmética: total liquidado = principal alocado + acréscimos − reduções (ou outra fórmula aprovada, documentada e testada). A fórmula final precisa ser única e testada antes da migration.
- Ajustes em liquidação confirmada são proibidos; corrigir por estorno e novo evento.

### 4.7 `settlement_reversals`

Evento compensatório append-only para estorno total/parcial.

| Coluna | Tipo PostgreSQL | Obrigatório | Regra |
|---|---|---:|---|
| `id` | uuid | Sim | PK |
| `organization_id` | uuid | Sim | Tenant |
| `original_settlement_id` | uuid | Sim | Liquidação original |
| `reversal_amount_minor` | bigint | Sim | CHECK > 0 |
| `currency` | char(3) | Sim | Igual à origem |
| `reason` | text | Sim | Motivo |
| `reversed_at` | timestamptz | Sim | Instante |
| `reversed_by` | uuid | Sim | Ator autorizado |
| `idempotency_key` | text | Sim | Única por organização |
| `created_at` | timestamptz | Sim | Timestamp |

Constraints:
- PK `id`; UNIQUE `(organization_id,id)`.
- FK composta para `settlements(organization_id,id)`.
- UNIQUE `(organization_id,idempotency_key)`.
- CHECK `reversal_amount_minor > 0`.
- Soma dos estornos não pode superar o valor reversível da liquidação. Validar em transação com bloqueio da liquidação original.
- Não impor UNIQUE em `original_settlement_id`: estornos parciais podem ser múltiplos, desde que a soma respeite o limite.
- Estorno deve gerar efeitos compensatórios nas alocações e saldo do título, preservando os eventos originais. A implementação deverá definir alocação de reversão por linha de alocação original; não apenas marcar status.

### 4.8 `bank_settlement_allocations`

Esta tabela é necessária para D05. O `reconciliation_links` registra evidência, mas não controla quantidade consumida de uma movimentação.

| Coluna | Tipo PostgreSQL | Obrigatório | Regra |
|---|---|---:|---|
| `id` | uuid | Sim | PK |
| `organization_id` | uuid | Sim | Tenant |
| `financial_record_id` | uuid | Sim | Movimento bancário |
| `settlement_id` | uuid | Sim | Liquidação |
| `allocated_amount_minor` | bigint | Sim | CHECK > 0 |
| `currency` | char(3) | Sim | Deve coincidir |
| `status` | text | Sim | `active`, `reversed` |
| `created_by` | uuid | Sim | Ator do backend |
| `created_at` | timestamptz | Sim | Timestamp |

Constraints:
- PK `id`; UNIQUE `(organization_id,id)`.
- FKs compostas para `financial_records(organization_id,id)` e `settlements(organization_id,id)`.
- CHECK `allocated_amount_minor > 0`.
- Índices por organização + movimento e organização + liquidação.
- Alocações ativas somadas não podem superar o valor conciliável da movimentação. Implementar por comando transacional com bloqueio da linha de `financial_records`.
- Reversões de liquidação devem reverter/ajustar os vínculos bancários correspondentes de modo auditável.
- Não impor UNIQUE simples em `financial_record_id`: split de um movimento entre múltiplas liquidações é permitido.

**Atenção à direção:** a migration D02 representa `financial_records.direction` como enum entrada/saída e valor absoluto em `amount_minor`. A validação deve mapear entrada → recebimento e saída → pagamento, sem comparar sinal inexistente.

### 4.9 `reconciliation_decisions`

| Coluna | Tipo PostgreSQL | Obrigatório | Regra |
|---|---|---:|---|
| `id` | uuid | Sim | PK |
| `organization_id` | uuid | Sim | Tenant |
| `status` | text | Sim | `suggested`, `confirmed`, `rejected`, `undone` |
| `decision_method` | text | Sim | `manual`, `deterministic_rule`, `algorithm`, `integration` |
| `confidence` | numeric(5,4) | Não | 0 a 1; metadado, nunca autorização |
| `rule_version` | text | Não | Versão da regra |
| `reason_code` | text | Não | Código controlado |
| `justification` | text | Não | Motivo |
| `decided_by` | uuid | Não | Obrigatório para decisão humana final |
| `decided_at` | timestamptz | Não | Instante |
| `supersedes_decision_id` | uuid | Não | FK composta auto-referente |
| `policy_version_id` | uuid | Não | Versão aplicada |
| `created_at` | timestamptz | Sim | Timestamp |

Constraints:
- PK `id`; UNIQUE `(organization_id,id)`.
- CHECK confidence entre 0 e 1.
- FK composta auto-referente e para versão de política.
- CHECK: decisão final exige `decided_by`, `decided_at` e justificativa/motivo quando exigido.
- Índices `(organization_id,status,created_at desc)`, `(organization_id,decided_at desc)`.
- Sugestões automáticas podem não ter ator humano; confirmação/rejeição exige ator autenticado e autorizado.

### 4.10 `reconciliation_links`

| Coluna | Tipo PostgreSQL | Obrigatório | Regra |
|---|---|---:|---|
| `id` | uuid | Sim | PK |
| `organization_id` | uuid | Sim | Tenant |
| `reconciliation_decision_id` | uuid | Sim | FK composta |
| `financial_title_id` | uuid | Não | Evidência |
| `title_installment_id` | uuid | Não | Evidência |
| `settlement_id` | uuid | Não | Evidência |
| `financial_record_id` | uuid | Não | Evidência |
| `link_role` | text | Sim | `candidate`, `supporting_evidence`, `matched` |
| `created_at` | timestamptz | Sim | Timestamp |

Constraints:
- PK `id`; UNIQUE `(organization_id,id)`.
- FKs compostas para decisão, título, parcela, liquidação e movimentação.
- CHECK exige exatamente uma das quatro referências de evidência não nula.
- Índices individuais por FK + organização.
- Integridade parcela/título e consumo quantitativo do movimento serão verificados pelos comandos transacionais e pela tabela `bank_settlement_allocations`.
- Esta tabela é de evidência/relacionamento, não substitui a alocação quantitativa.

### 4.11 `financial_policy_configurations`

| Coluna | Tipo PostgreSQL | Obrigatório | Regra |
|---|---|---:|---|
| `id` | uuid | Sim | PK |
| `organization_id` | uuid | Sim | Tenant |
| `module_key` | text | Sim | Default `finance` |
| `status` | text | Sim | `not_started`, `in_progress`, `pending_approval`, `active`, `change_pending`, `suspended` |
| `active_version_id` | uuid | Não | FK composta após versão criada |
| `created_at`, `updated_at` | timestamptz | Sim | Timestamps |

Constraints:
- PK `id`; UNIQUE `(organization_id,id)`; UNIQUE `(organization_id,module_key)`.
- FK para organizations e FK composta diferida para versão ativa, com validação de que versão pertence à configuração.
- Índice por organização + status.

### 4.12 `financial_policy_versions`

| Coluna | Tipo PostgreSQL | Obrigatório | Regra |
|---|---|---:|---|
| `id` | uuid | Sim | PK |
| `organization_id` | uuid | Sim | Tenant |
| `configuration_id` | uuid | Sim | FK composta |
| `version_number` | integer | Sim | Sequencial por configuração |
| `schema_version` | text | Sim | Versão do schema do payload |
| `policy_payload` | jsonb | Sim | JSON validado no servidor |
| `status` | text | Sim | `draft`, `pending_approval`, `approved`, `active`, `rejected`, `superseded` |
| `change_reason` | text | Não | Motivo |
| `created_by` | uuid | Sim | Autor |
| `created_at` | timestamptz | Sim | Timestamp |
| `approved_at` | timestamptz | Não | Timestamp |
| `effective_from` | timestamptz | Não | Vigência |
| `effective_until` | timestamptz | Não | Fim de vigência |

Constraints:
- PK `id`; UNIQUE `(organization_id,id)`; UNIQUE `(organization_id,configuration_id,version_number)`.
- FK composta para configuração.
- CHECK version_number > 0; CHECK effective_until > effective_from quando ambos definidos.
- Payload deve ser validado contra schema_version no backend; JSON Schema/versionamento deve estar no código e coberto por testes.
- Versões aprovadas/ativas são imutáveis. Alteração cria nova versão.
- Ativação futura exige regra de não sobreposição para mesma organização/módulo. A garantia temporal será feita por transação e, se aplicável, exclusion constraint com range após definir a semântica de intervalos.
- Índice para seleção da versão vigente por configuração, status e intervalo de vigência.

### 4.13 `financial_policy_approvals`

| Coluna | Tipo PostgreSQL | Obrigatório | Regra |
|---|---|---:|---|
| `id` | uuid | Sim | PK |
| `organization_id` | uuid | Sim | Tenant |
| `policy_version_id` | uuid | Sim | FK composta |
| `decision` | text | Sim | `approved`, `rejected` |
| `approver_user_id` | uuid | Sim | Usuário autenticado |
| `authority_type` | text | Sim | `direct_role`, `delegation` |
| `delegation_id` | uuid | Não | FK composta se delegação |
| `justification` | text | Não | Motivo |
| `decided_at` | timestamptz | Sim | Timestamp |

Constraints:
- PK `id`; UNIQUE `(organization_id,id)`.
- FK composta para versão e delegação.
- CHECK: authority_type delegation exige delegation_id; direct_role exige delegation_id nulo.
- Índice `(organization_id,policy_version_id,decided_at desc)`.
- Append-only: sem UPDATE/DELETE para papéis cliente.
- A validação de autoridade e segregação ocorre no backend; não confiar no valor de `authority_type` enviado pelo cliente.

### 4.14 `financial_policy_delegations`

| Coluna | Tipo PostgreSQL | Obrigatório | Regra |
|---|---|---:|---|
| `id` | uuid | Sim | PK |
| `organization_id` | uuid | Sim | Tenant |
| `delegated_user_id` | uuid | Sim | Usuário destinatário |
| `granted_by` | uuid | Sim | Concedente autorizado |
| `scope` | text[] | Sim | Escopos permitidos, validado por allowlist |
| `valid_from` | timestamptz | Sim | Início |
| `valid_until` | timestamptz | Não | Fim |
| `revoked_at` | timestamptz | Não | Revogação |
| `reason` | text | Sim | Justificativa |
| `created_at` | timestamptz | Sim | Timestamp |

Constraints:
- PK `id`; UNIQUE `(organization_id,id)`.
- CHECK valid_until > valid_from quando definido.
- CHECK cardinalidade de scope > 0; backend valida valores permitidos (configure, submit, approve, administer_delegations).
- Índice por organização + usuário + vigência.
- Delegação não pode conceder acesso a outro tenant nem exceder autoridade do concedente.
- Se RBAC central já suportar delegações equivalentes, esta tabela não deve ser criada; integrar ao mecanismo existente.

## 5. FKs compostas obrigatórias

Toda entidade nova deve ter UNIQUE `(organization_id,id)` quando referenciada. Todas as relações tenant-scoped usam FKs compostas. A lista física mínima:

| Origem | Colunas | Destino |
|---|---|---|
| counterparties | organization_id | organizations.id |
| financial_titles | organization_id,counterparty_id | financial_counterparties.organization_id,id |
| financial_titles | organization_id,data_source_id | data_sources.organization_id,id |
| financial_titles | organization_id,import_batch_id | import_batches.organization_id,id |
| financial_titles | organization_id,source_artifact_id | source_artifacts.organization_id,id |
| financial_titles | organization_id,policy_version_id | financial_policy_versions.organization_id,id |
| installments | organization_id,financial_title_id | financial_titles.organization_id,id |
| settlements | organization_id,financial_account_id | financial_accounts.organization_id,id |
| settlements | organization_id,policy_version_id | financial_policy_versions.organization_id,id |
| settlement_allocations | organization_id,settlement_id | settlements.organization_id,id |
| settlement_allocations | organization_id,financial_title_id | financial_titles.organization_id,id |
| settlement_adjustments | organization_id,settlement_id | settlements.organization_id,id |
| settlement_reversals | organization_id,original_settlement_id | settlements.organization_id,id |
| bank_settlement_allocations | organization_id,financial_record_id | financial_records.organization_id,id |
| bank_settlement_allocations | organization_id,settlement_id | settlements.organization_id,id |
| reconciliation_decisions | organization_id,policy_version_id | financial_policy_versions.organization_id,id |
| reconciliation_links | organization_id,reconciliation_decision_id | reconciliation_decisions.organization_id,id |
| reconciliation_links | organization_id,financial_record_id | financial_records.organization_id,id |
| policy_versions | organization_id,configuration_id | financial_policy_configurations.organization_id,id |
| policy_approvals | organization_id,policy_version_id | financial_policy_versions.organization_id,id |
| policy_delegations | organization_id | organizations.id |

**FK adicional necessária:** `settlement_allocations` deve garantir que `title_installment_id`, quando preenchido, pertence ao mesmo `financial_title_id`. Recomenda-se UNIQUE `(organization_id,financial_title_id,id)` em installments e FK tripla correspondente, em vez de depender apenas de validação da aplicação.

## 6. Regras que exigem transação/lock — não são CHECKs

As regras abaixo não podem ser garantidas por CHECK simples porque dependem de somas ou estados de outras linhas:

1. Soma das parcelas = valor original do título no momento da confirmação.
2. Soma do principal alocado não excede saldo aberto do título/parcela.
3. Ajustes e principal fecham com valor bruto da liquidação segundo fórmula única.
4. Soma de estornos não excede valor reversível da liquidação.
5. Soma de alocações bancárias ativas não excede valor conciliável de `financial_records`.
6. Não permitir duas versões ativas conflitantes para a mesma organização/módulo.
7. Idempotência de confirmação, estorno e alocação sob chamadas concorrentes.
8. Consistência do estado do título derivado de alocações e estornos.

**Padrão de comando:** iniciar transação; validar ator e membership; bloquear linha(s) agregadora(s) com `SELECT ... FOR UPDATE`; validar versão esperada, saldo e política vigente; gravar eventos/alocações; atualizar projeções de estado/version; gravar auditoria; commit. Em falha, rollback integral.

Não criar trigger genérica que faça cálculos financeiros sem contrato explícito. A lógica de comandos deve ser testável e concentrada em serviço transacional.

## 7. RLS, grants e auditoria

### 7.1 RLS

- Habilitar RLS em todas as novas tabelas expostas no schema public antes de conceder acesso.
- SELECT: membership ativa na organização.
- Escrita: preferir backend confiável para operações financeiras críticas; políticas separadas por comando/ação. Não criar uma policy `FOR ALL` que permita UPDATE/DELETE de eventos confirmados.
- UPDATE policy deve ter USING e WITH CHECK.
- Não confiar em `user_metadata`; derivar identidade por sessão verificada e membership persistida.
- RLS não substitui validação de permissões de negócio nem FKs compostas.

### 7.2 Grants

- Conceder apenas privilégios mínimos necessários a `authenticated` e backend.
- Grants e RLS são controles distintos; revisar ambos por tabela e função.
- Não expor service_role/secret no browser.
- Não conceder DML direto em `settlements` confirmados, reversals, approvals, versões ativas ou audit events.
- Data API exposure deve ser verificada nas configurações do projeto; criar tabela não garante exposição automática.

### 7.3 Funções privilegiadas

- Preferir serviços server-side com identidade verificada e privilégios mínimos.
- Se `SECURITY DEFINER` for inevitável, colocar função em schema não exposto, fixar `search_path`, validar explicitamente `auth.uid()`/tenant e conceder EXECUTE apenas ao papel necessário.
- Não usar função privilegiada para contornar RLS ou autorização.
- Após implementação, executar advisors e testes de acesso.

### 7.4 Auditoria

Reutilizar `public.audit_events` existente. Não criar FK para ela. O backend insere eventos com:
- organization_id;
- actor_id derivado da sessão;
- event_type estável;
- entity_type e entity_id;
- occurred_at;
- correlation_id;
- metadata mínima, sem credenciais, dados bancários integrais ou payload pessoal desnecessário.

A política de append-only deverá ser garantida por grants/policies e escrita server-side. A tabela atual não possui UNIQUE tenant-scoped para ID; não alterar isso sem migration separada e avaliação de impacto.

## 8. Estados e transições físicos

| Agregado | Transição permitida | Observação |
|---|---|---|
| Título | draft → open | Confirmação após validação |
| Título | open → partially_settled → settled | Derivado de alocações válidas |
| Título | draft/open → cancelled | Motivo e autorização |
| Liquidação | draft → confirmed | Comando transacional |
| Liquidação | confirmed → reversed | Projeção do total estornado; eventos de reversão preservados |
| Decisão | suggested → confirmed/rejected | Decisão humana autorizada ou regra aprovada |
| Decisão | confirmed → undone | Motivo e decisão sucessora |
| Política | draft → pending_approval → approved → active | Ativação conforme vigência |
| Política | active → superseded | Nova versão assume vigência |

Os estados materializados são projeções operacionais; eventos financeiros e de aprovação são fonte de histórico. Toda transição deve ser validada no backend.

## 9. Decisões de implementação ainda bloqueadas

| ID | Dependência | Impacto | Resolução necessária |
|---|---|---|---|
| B01 | Cadastro mestre externo ao conjunto D02 | Evitar duplicar contrapartes | Inspecionar repositórios/módulos e escolher owner do cadastro |
| B02 | Permissões granulares no servidor | Aprovação, confirmação, estorno, delegação | Definir serviço/RBAC autoritativo; lib/permissions.ts isoladamente não basta |
| B03 | Fórmula aritmética final | Principal + ajustes = liquidação | Definir tratamento de desconto, tarifa, retenção e pagamentos parciais |
| B04 | Semântica de estorno | Reversão de principal, ajustes e movimento bancário | Definir estorno parcial e alocação de reversão por allocation |
| B05 | Saldo conciliável do movimento | D05 e split | Definir comportamento para movimentos de tarifa, estorno e lançamentos compostos |
| B06 | Fluxo de adiantamentos/créditos | Liquidação sem alocação | Modelar saldo de crédito, titularidade, aplicação e baixa |
| B07 | Integração ERP | Idempotência e atualização | Confirmar chaves e payloads reais por origem |
| B08 | Política temporal | Versões futuras | Fechar semântica de timezone, intervalos e desempate |

Estas dependências não impedem documentar o modelo físico proposto, mas impedem considerar a especificação pronta para migration de produção.

## 10. Plano de migration futuro (não executar nesta etapa)

A implementação deverá ser incremental, revisada e separada por preocupação:

1. **F01.3a — Cadastros e títulos:** counterparties (se necessário), titles, installments, constraints e RLS.
2. **F01.3b — Liquidações:** settlements, allocations, adjustments, reversals e comandos transacionais.
3. **F01.3c — Conciliação quantitativa:** bank_settlement_allocations, decisions, links e concorrência.
4. **F01.3d — Governança:** configurations, versions, approvals, delegations (após RBAC).
5. **F01.3e — Auditoria/segurança:** grants, RLS, funções e hardening final.

Antes de qualquer migration:
- validar todas as dependências B01–B08;
- gerar SQL por ferramenta/CLI Supabase versionada e revisada, nunca improvisar timestamp de migration;
- aplicar somente em ambiente de desenvolvimento autorizado;
- testar isolamento com dois tenants, autorização por operação, concorrência, idempotência, reversões e integridade;
- executar Supabase advisors;
- verificar migrations locais/remotas e documentar evidências;
- obter autorização explícita para qualquer alteração remota.

## 11. Critérios de aceite do F01.3

- [ ] Todas as tabelas novas têm `organization_id`, UNIQUE tenant-scoped e FKs compostas necessárias.
- [ ] Nenhuma entidade de título é confundida com `financial_records`.
- [ ] Parcelas e documentos autônomos de ERP são representados sem duplicação artificial.
- [ ] BRL é enforced no MVP.
- [ ] Estornos são compensatórios e não destrutivos.
- [ ] Split de movimentação tem valor alocado e saldo concorrente protegido.
- [ ] Somas/limites cross-row são validados por transações, não CHECKs falsos.
- [ ] RLS, grants e autorização de negócio são testados separadamente.
- [ ] Ator é sempre derivado de sessão confiável no servidor.
- [ ] Auditoria registra operações críticas sem expor dados sensíveis.
- [ ] Duas organizações não conseguem referenciar ou consultar dados uma da outra.
- [ ] Nenhuma migration é aplicada sem revisão e autorização explícita.

## 12. Fontes internas examinadas

- `supabase/migrations/20261104210850_d02_managed_persistence.sql`
- `supabase/migrations/20261109130004_d02_transactional_imports.sql`
- `supabase/migrations/20261110004255_d02_trusted_import_boundary.sql`
- `supabase/migrations/20261110013000_d02_organization_admin_and_branding.sql`
- `supabase/migrations/20261110120135_d02_organization_slugs.sql`
- `supabase/migrations/20261110212052_security_default_grants_hardening.sql`
- `lib/permissions.ts`
- `lib/finance-persistence.ts`
- `lib/reconciliation.ts`
- `docs/F01_DOMAIN_MODEL.md`
- `docs/F01_LOGICAL_DATA_MODEL.md`

**Rastreabilidade:** este documento é uma especificação proposta baseada na inspeção das migrations existentes na branch. Não comprova schema implantado, não cria migration e não afirma que os testes funcionais foram executados.


---

# 13. Resolução das dependências B01–B08

**Estado:** decisões técnicas de baseline para o MVP F01.  
**Autoridade:** proposta de arquitetura do produto; não equivale à aprovação das políticas financeiras de uma organização.  
**Regra de precedência:** este adendo complementa e, nos pontos explicitados, prevalece sobre as seções anteriores deste documento. Nenhuma decisão autoriza migration ou alteração remota do Supabase.

## 13.1 Registro de decisões

| ID | Decisão fechada | Estado |
|---|---|---|
| B01 — Contrapartes | Cadastro mestre tenant-scoped no domínio de persistência RSBUILD; Core mantém contrato canônico e referência, sem banco próprio | DECIDED |
| B02 — Autorização | Membership é pré-condição, não autoridade suficiente; comandos sensíveis exigem permissão financeira explícita validada no servidor | DECIDED |
| B03 — Fórmula | Separar valor que extingue título do valor efetivamente movimentado; ajustes carregam efeito de caixa e efeito sobre título | DECIDED |
| B04 — Estorno | Estorno compensatório parcial ou total, alocado contra cada alocação original e cada consumo bancário | DECIDED |
| B05 — Split bancário | Uma movimentação pode financiar várias liquidações; soma líquida alocada nunca supera seu valor disponível | DECIDED |
| B06 — Não alocado | Liquidação sem alocação fica desabilitada no MVP; adiantamentos/créditos exigem ledger próprio em fase posterior | DECIDED — MVP BLOCK |
| B07 — ERP | Omie read-only no v0.1; importação de títulos só é idempotente com identificador estável da origem | DECIDED |
| B08 — Tempo | Datas de negócio em DATE; instantes em TIMESTAMPTZ; timezone IANA da organização; vigências em intervalos semiabertos sem sobreposição | DECIDED |

## 13.2 B01 — Cadastro mestre de contrapartes

A inspeção do `symbeon-financial-core` confirma que o domínio canônico prevê `counterparty_reference` em SourceRecord e extensões de papel para contas a pagar/receber com parte, mas não apresenta um cadastro mestre persistente implementado. O Core é uma biblioteca/contrato de semântica, não o dono de um banco multi-tenant.

**Decisão:** `financial_counterparties` pertence ao domínio de persistência do RSBUILD, com escopo obrigatório por organização. O Core define DTOs/semântica portáveis para contraparte e identificadores externos, mas não cria nem mantém registros de cadastro. A integração RSBUILD adapta o contrato do Core para a persistência tenant-scoped.

Regras:
1. Um cadastro pode exercer os papéis `customer`, `supplier` ou ambos; papel é relação/uso, não tipo ontológico da pessoa.
2. A identidade interna é UUID + organização. Identidade externa é composta por organização + source system + external ID.
3. Não impor unicidade global por CPF/CNPJ nem fundir cadastros automaticamente por nome/documento.
4. Título confirmado preserva snapshot de nome, documento normalizado quando permitido e referência de contraparte; alteração posterior no cadastro não reescreve o snapshot.
5. Quando a origem não trouxer ID estável, criar contraparte provisória/revisável ou manter referência textual de origem; nunca fazer merge heurístico automático.
6. Se outro módulo RSBUILD já possuir cadastro mestre corporativo, ele deverá ser identificado antes da migration e assumir o ownership; não manter dois cadastros concorrentes.

**Ajuste físico obrigatório:** adicionar a `financial_counterparties` uma tabela de identificadores externos:

`financial_counterparty_external_ids(id, organization_id, counterparty_id, source_system, external_id, first_seen_at, last_seen_at, created_at)`

- UNIQUE `(organization_id,id)`.
- UNIQUE `(organization_id,source_system,external_id)`.
- FK composta `(organization_id,counterparty_id)` → `financial_counterparties(organization_id,id)`.
- `source_system` e `external_id` são NOT NULL; normalização preserva também o valor bruto na proveniência.
- Não reutilizar `data_source_id` como identidade de negócio se a origem/conta puder ser reconfigurada.

## 13.3 B02 — Autorização granular e segregação de funções

As roles atuais `owner/admin/operator/viewer` permanecem como membership e capacidades gerais de workspace. A descrição visual em `lib/permissions.ts` não é prova de autoridade financeira formal. Em particular, `admin` não será interpretado automaticamente como diretor ou aprovador financeiro.

**Decisão:** toda operação F01 exige (a) membership ativa na organização, (b) permissão financeira específica e (c) validação server-side. A interface pode ocultar ações, mas nunca é o controle de segurança.

Matriz inicial conservadora:

| Ação | Owner/Admin/Operator/Viewer |
|---|---|
| Consultar títulos, contrapartes, liquidações e decisões | Qualquer membro ativo |
| Criar/importar título e contraparte | Owner, Admin, Operator |
| Editar rascunho | Owner, Admin, Operator |
| Propor conciliação | Owner, Admin, Operator |
| Confirmar conciliação sem divergência | Usuário com `reconciliation.confirm` |
| Confirmar conciliação divergente | Usuário com `reconciliation.approve_discrepancy` |
| Confirmar liquidação | Usuário com `settlement.confirm` |
| Estornar liquidação | Usuário com `settlement.reverse` |
| Criar/alterar configuração | Usuário com `policy.configure` |
| Aprovar/ativar versão de política | Usuário com `policy.approve` |
| Administrar delegações | Usuário com `authority.delegate` |

As roles podem fornecer permissões operacionais não críticas por uma matriz central versionada. Permissões de confirmação, divergência, estorno, aprovação de política e delegação exigem concessão explícita por organização, por usuário, com escopo e vigência. Nenhuma role isolada concede automaticamente essas alçadas.

**Segregação default:** o criador de título, liquidação, decisão ou versão de política não pode aprovar/confirmar a mesma operação. Exceção só pode ser habilitada por política aprovada e não pode dispensar trilha de auditoria. Para o MVP, a regra é sempre exigir ator distinto em confirmação de liquidação e aprovação da configuração financeira.

**Persistência:** `financial_authorizations` é a fonte de concessões específicas:

- `id uuid PK`, `organization_id uuid NOT NULL`, `user_id uuid NOT NULL`;
- `permission_key text NOT NULL`;
- `scope jsonb NOT NULL DEFAULT '{}'` (validado por allowlist no backend; não é expressão livre);
- `granted_by uuid NOT NULL`, `granted_at timestamptz NOT NULL`;
- `valid_from timestamptz NOT NULL`, `valid_until timestamptz`, `revoked_at timestamptz`, `reason text NOT NULL`;
- UNIQUE `(organization_id,id)`;
- FK para organizations e membership (garantir que usuário pertence à organização; preferir FK composta após criar UNIQUE adequado em memberships);
- CHECK de vigência;
- índice por `(organization_id,user_id,permission_key,valid_from)`.

Concessões são eventos auditáveis; revogação não apaga histórico. Delegação deve apontar para uma autorização com escopo, prazo, concedente autorizado e cadeia de autoridade verificável. `financial_policy_delegations` pode permanecer como entidade de delegação se necessário, mas não duplica o grant: a autorização aponta para a delegação e a delegação limita a origem/escopo. Se o RBAC central existente vier a suportar esse mesmo contrato, integrar nele e remover a tabela redundante antes da migration.

## 13.4 B03 — Fórmula aritmética e semântica dos ajustes

**Decisão:** separar dois conceitos que não são intercambiáveis:

- **Valor de baixa do título:** quanto da obrigação/direito foi extinto.
- **Valor de caixa:** quanto efetivamente entrou ou saiu da conta bancária associado à liquidação.

Para cada alocação:
- `principal_amount_minor` = parte do principal original que será extinta;
- `title_effect_minor` = efeito do ajuste sobre o total da obrigação/direito extinto;
- `cash_effect_minor` = efeito do ajuste sobre o caixa efetivamente movimentado;
- valores de efeito são inteiros assinados; positivo aumenta o valor, negativo reduz.

Equações canônicas:
- `title_extinguished_minor = principal_amount_minor + SUM(title_effect_minor)`
- `cash_amount_minor = SUM(principal_amount_minor + cash_effect_minor)`
- `settlement.gross_amount_minor = SUM(cash_amount_minor por alocação)`
- `bank_settlement_allocations.allocated_amount_minor` deve reconciliar com o caixa efetivo da liquidação, observadas as regras de split e eventuais diferenças bancárias documentadas.

Convenções iniciais:
- Juros e multa: `cash_effect_minor > 0` e `title_effect_minor > 0`.
- Desconto/abatimento comercial que reduz o pagamento, mas extingue o principal integralmente: `cash_effect_minor < 0`, `title_effect_minor = 0`.
- Desconto que reduz também a obrigação reconhecida: `cash_effect_minor < 0`, `title_effect_minor < 0`; exige tipo/justificativa e regra aprovada.
- Tarifa bancária não é ajuste do título: é movimento bancário/encargo separado, não altera principal nem saldo do título.
- Retenções tributárias, compensações e pagamentos a múltiplos beneficiários ficam fora do MVP até haver modelo fiscal e de múltiplos destinos; não simular como desconto genérico.

A soma dos efeitos deve ser fechada no comando de confirmação, por alocação e por liquidação. A UI deve exibir separadamente principal baixado, ajustes sobre o título e valor de caixa. O saldo do título é reduzido por `title_extinguished_minor`, nunca por mera igualdade com o valor bancário.

## 13.5 B04 — Estornos parciais e totais

**Decisão:** `settlement_reversals` é evento compensatório append-only. Uma liquidação confirmada nunca é editada ou excluída para correção.

Adicionar `settlement_reversal_allocations`:
- `id`, `organization_id`, `reversal_id`, `original_allocation_id`;
- `reversed_title_amount_minor bigint NOT NULL CHECK > 0`;
- `reversed_cash_amount_minor bigint NOT NULL CHECK >= 0`;
- `created_at timestamptz NOT NULL`;
- UNIQUE `(organization_id,id)`;
- FKs compostas para reversão e alocação original;
- UNIQUE idempotente por `(organization_id,reversal_id,original_allocation_id)`.

Adicionar `bank_settlement_allocation_reversals`:
- `id`, `organization_id`, `reversal_id`, `bank_settlement_allocation_id`;
- `released_amount_minor bigint NOT NULL CHECK > 0`;
- `created_at timestamptz NOT NULL`;
- FKs compostas para reversão e alocação bancária original;
- UNIQUE por organização + ID; índice por alocação bancária.

Regras:
1. A soma revertida por alocação original nunca supera o valor originalmente aplicado.
2. A soma liberada de cada alocação bancária nunca supera seu valor ativo.
3. Estorno parcial pode ocorrer em múltiplos eventos; estorno total é o evento que completa o saldo reversível.
4. Uma reversão deve declarar alocações originais afetadas e, quando houve vínculo bancário, a parcela bancária liberada.
5. Reversão de caixa não presume que o banco já devolveu o dinheiro: o evento de estorno financeiro e o novo movimento bancário de retorno são fatos distintos.
6. Recalcular saldo do título e saldo conciliável em uma transação com bloqueios de linha.
7. Idempotência por chave da reversão; repetir comando não duplica efeitos.
8. A decisão de conciliação original permanece no histórico; uma nova decisão pode registrar o estado após estorno.

## 13.6 B05 — Divisão de movimentações bancárias

**Decisão:** uma linha `financial_records` pode ser alocada parcialmente a uma ou várias liquidações. A tabela `bank_settlement_allocations` é o ledger quantitativo dessa relação; `reconciliation_links` permanece apenas evidência/relacionamento.

Definições:
- `available_minor = financial_records.amount_minor - SUM(active allocated_amount_minor) + SUM(released_amount_minor)`.
- `available_minor` nunca pode ser negativo.
- Soma de alocações ativas não supera `amount_minor`.
- Direção `entrada` só financia `receipt`; direção `saída` só financia `payment`.
- A moeda deve coincidir; no MVP, BRL.
- Um movimento pode ser consumido por múltiplas liquidações, mas cada parcela consumida é única e auditável.
- O status de movimento só pode ser `conciliado` quando o saldo disponível chegar a zero conforme a política. Se houver consumo parcial, manter status parcial/pendente (a projeção atual D02 pode precisar de extensão; não reutilizar `conciliado` para parcial).
- Tarifas, estornos bancários, chargebacks e movimentos compostos são registros próprios ou extensões de papel; não subtrair silenciosamente do valor original.

O comando de alocação bloqueia a linha de `financial_records` e as liquidações relacionadas, valida saldo, direção, moeda, organização, política e permissão, grava a alocação e a auditoria na mesma transação.

## 13.7 B06 — Liquidação sem alocação, adiantamentos e créditos

**Decisão de escopo:** liquidação confirmada sem alocação é **proibida no MVP F01**. Não existe ainda ledger de crédito/adiantamento suficientemente especificado no RSBUILD ou no Core.

Consequências:
- `settlements` em rascunho podem ser preparados sem alocações.
- Confirmação exige alocação completa, com composição matemática fechada.
- Saldo excedente não é descartado, não reduz outro título automaticamente e não é marcado como crédito por inferência.
- Pagamento/recebimento excedente ou antecipado deve permanecer em fluxo de exceção não confirmado até a fase de créditos.
- P02/P04 da configuração não podem habilitar uma capacidade que o produto ainda não implementa. No MVP, essas políticas são fixas como `false` para não alocado/adiantamento; a UI deve mostrar “não disponível nesta versão”, não uma opção enganosa.

Fase posterior, fora do F01 MVP: ledger de créditos por contraparte, com origem, saldo, titularidade, aplicação parcial, devolução, expiração quando juridicamente aplicável e auditoria. Só então será possível habilitar `settlement_without_allocation`.

## 13.8 B07 — Identificadores e atualização pelo ERP

**Decisão:** Omie permanece read-only no v0.1 conforme o contrato do Symbeon Financial Core. RSBUILD pode importar arquivos de títulos fornecidos por processo autorizado, mas isso não equivale a conector Omie operacional nem autoriza baixa/write-back.

Identidade:
1. Preferir identificador interno estável do ERP, com origem explícita: `source_system + external_id`.
2. Para Omie, preservar `nCodTitulo` e `cCodIntTitulo` como identificadores distintos quando presentes; a chave de negócio externa deve registrar o campo efetivamente estável e sua semântica após confirmação em amostras/documentação.
3. Não assumir que número de documento, nome de cliente, vencimento e valor formam uma chave única.
4. Sem identificador estável, não fazer deduplicação automática. Encaminhar para revisão/manual matching.
5. Persistir `source_system`, `external_id`, `source_payload_hash`, `mapping_version`, `import_batch_id` e referência ao artefato original.
6. Mesmo ID externo com payload diferente significa atualização/revisão, não duplicata silenciosa.

Política de atualização:
- Título em rascunho: atualização idempotente pode atualizar campos mapeados antes da confirmação.
- Título confirmado: payload de origem não sobrescreve campos financeiros; criar proposta de alteração/revisão com diff e origem.
- Alteração de vencimento, contraparte, principal, moeda ou status requer revisão autorizada e evento auditável.
- Liquidações e conciliações confirmadas nunca são alteradas pelo ERP importador.
- Toda divergência entre estado interno e origem fica registrada como conflito/revisão pendente.
- Nenhuma chamada de escrita ao Omie é permitida no escopo atual.

## 13.9 B08 — Datas, timezone e vigência de política

**Decisão temporal:**
- Datas civis de emissão, competência e vencimento: PostgreSQL `date`; não converter em UTC.
- Instantes de criação, confirmação, pagamento/recebimento efetivo, decisão e auditoria: `timestamptz`, armazenados e comparados como instantes absolutos.
- Cada organização terá `time_zone` IANA obrigatório na configuração operacional. Para o piloto brasileiro, valor inicial sugerido `America/Sao_Paulo`; pode ser alterado por administrador autorizado, com auditoria.
- A data operacional exibida é derivada do instante + timezone da organização. Não usar timezone do navegador como autoridade.
- Payloads externos devem preservar timestamp/offset original quando fornecido e a transformação aplicada.

**Vigência de política:**
- `effective_from` inclusivo e `effective_until` exclusivo: intervalo `[from, until)`.
- `effective_from` é obrigatório em versão aprovada; default de ativação é instante da aprovação/ativação.
- Uma organização/módulo não pode ter duas versões ativas em intervalos sobrepostos.
- Aprovação de versão futura não a torna vigente antes do instante definido.
- Comando financeiro seleciona exatamente uma versão vigente usando o instante efetivo da operação e timezone apenas para converter datas civis, quando aplicável.
- Mudanças de timezone não reescrevem instantes ou datas já persistidos.
- A implementação deve usar exclusion constraint GiST sobre `tstzrange(effective_from,effective_until,'[)')` por organização/configuração, ou serialização transacional equivalente se a constraint não for viável. Não confiar apenas em validação de frontend.

## 13.10 Alterações físicas resultantes

O desenho físico deve incorporar antes da migration:
1. `financial_counterparty_external_ids`.
2. `financial_authorizations` ou integração equivalente com RBAC central, sem duplicar a fonte de autoridade.
3. `cash_effect_minor` e `title_effect_minor` em `settlement_adjustments`, substituindo convenção de sinal implícita.
4. `settlement_reversal_allocations`.
5. `bank_settlement_allocation_reversals`.
6. `time_zone` em configuração da organização ou entidade de configuração operacional já existente.
7. Intervalos de vigência semiabertos e exclusão de sobreposição em versões de política.
8. Estados/projeções para conciliação parcial; não forçar parcial em `conciliado`.

**Remover do escopo físico do MVP:** qualquer caminho que confirme liquidação sem alocação, adiantamento ou crédito não aplicado.

## 13.11 Critérios para considerar B01–B08 fechadas

- [ ] B01: ownership do cadastro e chave de identidade externa definidos; inspeção de outros módulos RSBUILD pendente antes da migration.
- [ ] B02: permissões por ação e segregação definidas; integração concreta ao backend/RBAC ainda exige implementação e testes.
- [ ] B03: fórmulas e convenções de sinal definidas; implementar fixtures aritméticas por tipo de ajuste.
- [ ] B04: estornos parciais/totais e liberação de split definidos; implementar testes concorrentes e idempotentes.
- [ ] B05: split quantitativo e saldo disponível definidos; estado parcial requer extensão de projeção.
- [ ] B06: não alocado/adiantamento explicitamente fora do MVP; não expor toggle configurável que sugira suporte.
- [ ] B07: Omie read-only; chave estável por campo externo exige validação com amostras autorizadas reais.
- [ ] B08: DATE/TIMESTAMPTZ, timezone e intervalos definidos; validar timezone e constraint em testes.

**Conclusão:** B01–B08 deixam de ser perguntas abertas de arquitetura. Permanecem tarefas de verificação e implementação, explicitamente listadas acima. Nenhuma dessas decisões comprova que o código, banco, Core ou Omie já implementam os comportamentos.
