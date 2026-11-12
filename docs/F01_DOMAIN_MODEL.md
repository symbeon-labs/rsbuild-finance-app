# F01.1 — Modelo de Domínio Financeiro

**Versão:** 0.1  
**Status:** Proposta para revisão — não aprovada para implementação  
**Base de análise:** `main` do RSBUILD Finance, referência consultada em 2026-11-12  
**Escopo:** modelagem conceitual de contas a pagar/receber, liquidações e decisões de conciliação.

> Este documento especifica o domínio. Não cria tabelas, migrations, endpoints, políticas RLS ou alterações no Supabase. Nenhuma decisão de negócio pendente deve ser inferida como aprovada.

## 1. Objetivo e fronteiras

F01 introduz um ciclo financeiro persistente sem confundir quatro conceitos:

1. **Título financeiro:** direito a receber ou obrigação a pagar, originado por contrato, nota, fatura, folha, lançamento manual ou integração.
2. **Movimentação bancária:** fato observado em extrato/importação, já representado em `financial_records`.
3. **Liquidação:** evento financeiro que registra quanto de um ou mais títulos foi efetivamente pago/recebido, quando e por qual meio.
4. **Decisão de conciliação:** decisão auditável que relaciona evidências (título, liquidação, movimentação) ou registra que a relação não pôde ser confirmada.

A existência de uma movimentação não liquida automaticamente um título. Uma sugestão algorítmica não é uma decisão confirmada. Exportar um arquivo para ERP não equivale a executar uma baixa no ERP.

### Fora do escopo desta etapa

- DRE, classificação contábil e regras fiscais.
- Integração operacional de escrita com Omie ou bancos.
- Contabilização por competência, plano de contas e partidas dobradas.
- Cálculo automático de juros/multas segundo legislação ou contrato.
- Multi-moeda operacional, câmbio e hedge.
- Migrações e alterações de banco.

## 2. Evidência atual e implicações

A estrutura existente em `main` inclui organizações/memberships, contas financeiras, fontes, lotes de importação, artefatos, movimentações em `financial_records`, execuções/linhas de integração e `audit_events`. Valores de movimentações são persistidos em unidades menores inteiras (centavos), com moeda.

A lógica de títulos em `lib/reconciliation.ts` define atualmente um tipo transitório de título a receber e calcula sugestões contra registros bancários. A tela de baixas informa que títulos e decisões são temporários na sessão; a confirmação marca títulos como baixados somente na sessão e a exportação gera CSV. Não foi identificado, nesta análise de código, um ciclo persistente equivalente para títulos, liquidações e alocações.

Consequência: o modelo proposto deve integrar-se às entidades existentes por chaves compostas de organização, preservando `financial_records` como fonte de movimentações. Não duplicar extratos dentro da entidade de título.

## 3. Modelo conceitual

```mermaid
erDiagram
  ORGANIZATION ||--o{ FINANCIAL_TITLE : owns
  FINANCIAL_TITLE ||--o{ TITLE_INSTALLMENT : schedules
  FINANCIAL_TITLE ||--o{ SETTLEMENT_ALLOCATION : allocated
  SETTLEMENT ||--|{ SETTLEMENT_ALLOCATION : contains
  SETTLEMENT ||--o{ SETTLEMENT_ADJUSTMENT : explains
  FINANCIAL_RECORD ||--o{ RECONCILIATION_LINK : candidate
  FINANCIAL_TITLE ||--o{ RECONCILIATION_LINK : relates
  SETTLEMENT ||--o{ RECONCILIATION_LINK : relates
  RECONCILIATION_DECISION ||--o{ RECONCILIATION_LINK : records
  ORGANIZATION ||--o{ RECONCILIATION_DECISION : owns
  ORGANIZATION ||--o{ AUDIT_EVENT : records
```

A relação entre liquidação e título é resolvida por **alocação**. Isso permite pagamentos parciais, um pagamento para vários títulos e múltiplas liquidações para um mesmo título. O vínculo com movimentação bancária fica na conciliação, não é pressuposto obrigatório da liquidação (por exemplo, pagamento em caixa ou liquidação manual documentada).

## 4. Entidades propostas

### 4.1 FinancialTitle — título financeiro

Representa um direito ou obrigação original.

Campos conceituais:
- `id`, `organization_id`: identidade e escopo tenant.
- `direction`: `receivable` ou `payable`.
- `document_type`, `document_number`, `external_reference`: identificação da origem, quando houver.
- `counterparty_id` ou snapshot de contraparte: cliente/fornecedor; a estratégia de cadastro mestre precisa ser decidida.
- `description`, `issue_date`, `competence_date`, `due_date`.
- `original_amount_minor`, `currency`: valor original em centavos inteiros e moeda ISO.
- `status`: estado operacional derivado/controlado.
- `source_type`, `data_source_id`, `import_batch_id`, `source_artifact_id`: proveniência opcional.
- `created_by`, `created_at`, `updated_at`, `version`.

O título é imutável quanto à sua origem econômica após confirmação, salvo correção auditada. Alterações de saldo devem decorrer de liquidações, ajustes autorizados ou cancelamento/estorno — não de sobrescrita silenciosa do valor original.

### 4.2 TitleInstallment — parcela / vencimento

Representa a obrigação ou direito com vencimento próprio. Um título pode ter uma parcela ou várias.

Campos conceituais:
- `id`, `organization_id`, `financial_title_id`.
- `installment_number`, `due_date`, `scheduled_amount_minor`, `currency`.
- `status` (aberta, parcialmente liquidada, liquidada, cancelada).
- `created_at`, `updated_at`.

Se o negócio decidir que cada parcela importada do ERP já é um título independente, essa entidade poderá ser dispensada inicialmente. Não assumir essa decisão sem validar os arquivos reais de origem.

### 4.3 Settlement — liquidação

Evento confirmado de pagamento ou recebimento. Não é sinônimo de baixa exportada nem de movimentação bancária.

Campos conceituais:
- `id`, `organization_id`.
- `settlement_type`: pagamento ou recebimento.
- `settled_at`: instante/data efetiva.
- `gross_amount_minor`, `currency`.
- `payment_method`, `financial_account_id` (opcionais, conforme meio).
- `external_reference`, `source_type`, `source_payload_hash`.
- `status`: rascunho, confirmado, estornado.
- `confirmed_by`, `confirmed_at`, `reversal_of_id`.
- `created_at`, `created_by`.

Uma liquidação confirmada é append-only no sentido de negócio. Correção ocorre por estorno/reversão e novo evento, preservando a história.

### 4.4 SettlementAllocation — alocação da liquidação

Liga o valor liquidado ao título/parcela que foi satisfeito.

Campos conceituais:
- `id`, `organization_id`, `settlement_id`.
- `financial_title_id` e opcionalmente `title_installment_id`.
- `principal_amount_minor`, `discount_amount_minor`, `interest_amount_minor`, `fine_amount_minor`, `other_adjustment_minor`.
- `currency`, `created_at`.

A soma das alocações deve ser consistente com o total da liquidação, segundo uma regra de composição aprovada. Não misturar desconto/juros com principal sem discriminação. A semântica exata de sinal e composição será fechada antes da implementação.

### 4.5 SettlementAdjustment — ajuste discriminado

Opcional no MVP, mas recomendado se houver múltiplos tipos de acréscimo/desconto com origem e justificativa distintas.

Campos conceituais:
- `id`, `organization_id`, `settlement_id`, `allocation_id` opcional.
- `adjustment_type`: desconto, juros, multa, tarifa, abatimento, outro.
- `amount_minor`, `currency`, `reason`, `source_reference`, `created_at`.

Não calcular valores legais/contratuais nesta camada sem regra de negócio versionada.

### 4.6 ReconciliationDecision — decisão de conciliação

Registra a decisão humana ou automatizada sobre uma relação candidata.

Campos conceituais:
- `id`, `organization_id`.
- `status`: sugerida, confirmada, rejeitada, desfeita.
- `decision_method`: manual, regra determinística, algoritmo, integração.
- `confidence` e `rule_version` quando houver sugestão automatizada.
- `reason_code`, `justification`.
- `decided_by`, `decided_at`, `supersedes_decision_id`.
- `created_at`.

Uma sugestão nunca deve marcar título como liquidado. Confirmação exige autorização e evidência suficiente; decisões rejeitadas/desfeitas permanecem consultáveis.

### 4.7 ReconciliationLink — evidência relacionada

Associa uma decisão a uma ou mais entidades de origem: título, parcela, liquidação e/ou movimentação `financial_records`.

A implementação deve preferir FKs explícitas e restrições que impeçam referências cruzadas entre organizações. Evitar uma coluna polimórfica sem integridade referencial. A cardinalidade e as restrições de unicidade serão especificadas na etapa F01.3.

### 4.8 AuditEvent — trilha de auditoria

Reutilizar o conceito/tabela `audit_events` existente, após confirmar a política de escrita e imutabilidade. Cada criação, confirmação, estorno, alocação, decisão ou mudança de estado deve registrar ator, organização, entidade, instante, correlação e metadados mínimos. O cliente não escolhe livremente `actor_id`; o servidor deriva o ator da sessão autenticada.

## 5. Estados e transições

### Título / parcela
- `draft` → `open` após validação e confirmação de origem.
- `open` → `partially_settled` quando há alocação confirmada inferior ao saldo.
- `open | partially_settled` → `settled` quando saldo chega a zero dentro da regra de tolerância aprovada.
- `draft | open` → `cancelled` com motivo e autorização.
- `settled` não volta diretamente a `open`; exige estorno/reversão rastreável.

### Liquidação
- `draft` → `confirmed` com validação de valores, alocações, organização e permissão.
- `confirmed` → `reversed` somente por evento de reversão com ator, data e motivo.
- Não editar ou apagar liquidação confirmada para corrigir histórico.

### Conciliação
- `suggested` → `confirmed` ou `rejected` por decisão autorizada.
- `confirmed` → `undone` apenas com motivo; nova decisão substitutiva preserva a anterior.
- A confiança é metadado da sugestão, não permissão nem prova financeira.

Os nomes finais de enum e transições são decisão técnica posterior; o significado acima é a regra de domínio proposta.

## 6. Invariantes obrigatórias

1. Toda entidade financeira pertence a exatamente uma organização.
2. Toda FK entre entidades tenant-scoped valida a mesma `organization_id`.
3. Valores monetários são inteiros em centavos (`bigint` no banco), moeda explícita; não usar ponto flutuante para persistência/cálculo.
4. Não somar moedas diferentes sem conversão explícita e taxa versionada — fora do MVP.
5. Valor original do título não é sobrescrito por pagamento; saldo é calculado a partir de alocações válidas.
6. Alocação confirmada não pode exceder saldo aberto do título/parcela, salvo regra formal para crédito/adiantamento.
7. Uma liquidação confirmada deve ter uma ou mais alocações ou uma justificativa de não alocação aprovada (decisão pendente).
8. Total de alocações e ajustes deve fechar com o valor liquidado segundo composição formal definida.
9. Um mesmo movimento bancário não pode ser consumido duas vezes por conciliações confirmadas incompatíveis, salvo split explícito e modelado.
10. Sugestão automática não altera estado financeiro.
11. Estorno preserva o evento original e reverte seus efeitos uma única vez.
12. Operações críticas são transacionais, idempotentes e auditadas.
13. `organization_id`, ator e permissões são validados no servidor; não confiar em IDs enviados pelo browser.
14. Importação repetida deve ser idempotente por chave de origem dentro da organização, sem fundir registros de origens distintas por heurística fraca.

## 7. Permissões propostas

| Ação | Owner | Admin | Operator | Viewer |
|---|---:|---:|---:|---:|
| Consultar títulos/liquidações/decisões | Sim | Sim | Sim | Sim |
| Criar/importar título | Sim | Sim | Sim | Não |
| Editar título em rascunho | Sim | Sim | Sim | Não |
| Cancelar título confirmado | Sim | Sim, conforme política | Não por padrão | Não |
| Registrar liquidação em rascunho | Sim | Sim | Sim | Não |
| Confirmar liquidação | Sim | Sim, conforme alçada | Pendente de decisão | Não |
| Estornar liquidação | Sim | Pendente de alçada | Não | Não |
| Confirmar/rejeitar conciliação | Sim | Sim | Pendente por valor/risco | Não |
| Gerir membros/permissões | Conforme política existente | Conforme política existente | Não | Não |

Esta matriz é proposta de domínio e não substitui nem altera `lib/permissions.ts` ou RLS. Aprovação por valor, dupla aprovação e segregação entre criador/aprovador precisam de decisão do negócio.

## 8. Cenários de aceite para F01.1

- Criar um título a receber e um a pagar em organizações distintas; confirmar isolamento.
- Representar um título parcelado sem perder o valor total original.
- Receber parcialmente um título e calcular saldo restante sem alterar o principal.
- Liquidar vários títulos com um pagamento agrupado, preservando a alocação por título.
- Registrar juros, multa e desconto separadamente, com fechamento matemático.
- Tentar alocar acima do saldo e receber rejeição transacional.
- Tentar relacionar entidades de organizações diferentes e receber rejeição.
- Confirmar que uma sugestão de conciliação não liquida o título.
- Estornar liquidação e restaurar saldo de forma idempotente e auditada.
- Repetir uma operação com a mesma chave idempotente sem duplicar liquidação/alocação.
- Verificar autoria derivada da sessão e trilha de auditoria.

## 9. Configuração financeira e governança da empresa

As decisões operacionais listadas abaixo devem ser resolvidas pela diretoria (ou responsável formalmente delegado) durante a implantação do módulo financeiro, antes de a organização iniciar sua operação. Elas não devem ser fixadas universalmente pelo código nem exigir uma nova entrega de engenharia para cada empresa.

O produto deve oferecer uma etapa de **Configuração Inicial do Módulo Financeiro**, com opções explicadas, valores padrão seguros, validação, registro de aprovação e possibilidade de revisão controlada. A configuração deve ser vinculada à organização, versionada e auditável. Alterações posteriores não podem reescrever eventos financeiros passados: cada operação deve preservar a versão da política vigente quando ocorreu.

### 9.1 Políticas configuráveis pela diretoria

| ID | Política | Configuração proposta |
|---|---|---|
| P01 | Unidade de gestão | Título com parcelas ou parcela do ERP como unidade independente. |
| P02 | Liquidação sem movimento bancário | Permitir ou exigir evidência/movimento conciliado; definir meios autorizados. |
| P03 | Liquidações parciais e agrupadas | Habilitar pagamento parcial, recebimento parcial e liquidação de múltiplos títulos. |
| P04 | Adiantamentos e créditos não aplicados | Permitir, restringir ou desabilitar; definir conta/fluxo de crédito pendente. |
| P05 | Saldo residual e tolerância | Limite em centavos e perfil autorizado para baixa de resíduo. |
| P06 | Alçadas de confirmação e estorno | Perfis, limites por valor, dupla aprovação e segregação criador/aprovador. |
| P07 | Ajustes financeiros | Tipos permitidos (juros, multa, desconto, tarifa, retenção, abatimento), sinais e justificativas obrigatórias. |
| P08 | Cancelamento após liquidação | Bloquear ou exigir estorno prévio; definir quem autoriza. |
| P09 | Cadastro de contraparte | Cadastro mestre da organização, snapshot no título ou referência externa. |
| P10 | Moedas operacionais | BRL apenas no MVP ou habilitação de outras moedas com regras explícitas. |
| P11 | Datas financeiras | Uso obrigatório/separado de emissão, competência, vencimento e liquidação efetiva. |
| P12 | Origem e ERP | Fontes autorizadas, identificadores estáveis e política de atualização de títulos importados. |

A interface de configuração deve explicar consequências e dependências. Exemplo: habilitar liquidação sem movimento bancário exige definir meio de pagamento e evidência mínima; habilitar dupla aprovação exige impedir que o mesmo usuário crie e aprove a operação quando essa segregação estiver configurada.

### 9.2 Invariantes não configuráveis

As configurações da empresa não podem desativar:
- isolamento por organização e validação de todas as relações tenant-scoped;
- precisão monetária em unidades inteiras e moeda explícita;
- integridade referencial e consistência transacional;
- autoria derivada da sessão confiável no servidor;
- trilha de auditoria para operações críticas;
- idempotência e proteção contra duplicidade;
- preservação do histórico de liquidações confirmadas e estornos;
- distinção entre sugestão algorítmica e decisão financeira confirmada;
- prevenção de alocação acima do saldo, exceto por fluxo explícito de crédito/adiantamento autorizado.

### 9.3 Requisitos do mecanismo de configuração

1. Configuração inicial obrigatória antes de habilitar operações financeiras produtivas.
2. Perfil autorizado (diretoria ou delegado) confirma a configuração inicial.
3. Políticas versionadas por organização, com autor, data, motivo e versão.
4. Mudanças posteriores passam por confirmação e registram vigência; não alteram retroativamente decisões/eventos.
5. Cada comando financeiro registra a versão de política aplicada.
6. Dependências e combinações inválidas são bloqueadas com explicação.
7. Valores padrão devem ser conservadores e apresentados como sugestões, nunca como decisões já tomadas pela empresa.
8. Deve existir estado de configuração incompleta/bloqueada, sem simular que o módulo está operacional.

A matriz de permissões da seção 7 é uma proposta inicial do produto. A configuração poderá restringir alçadas dentro dos limites de segurança definidos pelo sistema, mas não conceder poderes que contrariem o modelo de autorização central.

## 10. Próxima sequência técnica

1. Validar B01–B12 com responsáveis financeiros e amostras anonimizadas de títulos (Omie e outras origens).
2. Converter o modelo aprovado em ERD lógico e dicionário de dados.
3. Definir constraints, índices, idempotência, RLS e matriz de permissões por operação.
4. Especificar contratos de comandos transacionais (criar, confirmar, alocar, estornar) e respostas de erro.
5. Criar cenários automatizados, incluindo dois tenants e concorrência de liquidação.
6. Só então propor migrations incrementais em branch isolada e ambiente de desenvolvimento autorizado.

## 11. Referências internas examinadas

- `supabase/migrations/20261104210850_d02_managed_persistence.sql`
- `supabase/migrations/20261109130004_d02_transactional_imports.sql`
- `lib/finance.ts`
- `lib/finance-persistence.ts`
- `lib/reconciliation.ts`
- `app/components/finance/baixas-view.tsx`
- `docs/IMPLEMENTATION_PLAN.md`


### 9.4 Experiência de configuração — fluxo proposto

O configurador deve funcionar como um assistente de implantação (wizard), não como uma tela técnica de parâmetros. A diretoria deve compreender o impacto de cada escolha sem precisar conhecer o modelo de dados.

Fluxo sugerido:

1. **Contexto da empresa:** confirmar organização, atividade, moedas e fontes/ERPs utilizados.
2. **Estrutura dos títulos:** definir se a unidade operacional será título ou parcela e como tratar documentos importados.
3. **Liquidações:** definir pagamentos parciais/agrupados, meios aceitos, adiantamentos e liquidação sem movimento bancário.
4. **Ajustes e tolerâncias:** definir descontos, juros, multas, tarifas e tolerâncias de saldo residual.
5. **Governança e alçadas:** definir quem cadastra, confirma, aprova, cancela e estorna; configurar limites e dupla aprovação.
6. **Revisão e simulação:** apresentar resumo em linguagem de negócio, alertar conflitos e simular exemplos representativos sem gravar operações financeiras.
7. **Aprovação e ativação:** responsável autorizado confirma a versão; o sistema registra autoria, data, motivo e versão e só então libera as capacidades correspondentes.

Cada etapa deve apresentar: finalidade, opções, consequência operacional, dependências, recomendação conservadora e indicação clara do que ainda precisa de decisão. Não pré-selecionar opções como se já tivessem sido aprovadas.

### 9.5 Estados do ciclo de configuração

- `not_started`: configuração ainda não iniciada.
- `in_progress`: preenchimento em andamento; nenhuma capacidade produtiva dependente pode ser ativada.
- `pending_approval`: revisão concluída, aguardando aprovação de pessoa autorizada.
- `active`: versão aprovada e vigente.
- `change_pending`: alteração proposta para uma configuração ativa, aguardando aprovação.
- `suspended`: configuração suspensa por inconsistência, revogação ou ação administrativa auditada.

A configuração deve ter um identificador próprio e versões imutáveis. Uma edição cria uma nova versão em rascunho; não altera a versão ativa. A ativação deve ser transacional e registrar o evento de auditoria correspondente.

### 9.6 Modelo lógico conceitual da configuração

Entidades conceituais sugeridas, sem compromisso de nomes físicos:

- **FinancialModuleConfiguration:** identidade da configuração da organização e estado atual.
- **FinancialPolicyVersion:** versão imutável das políticas P01–P12, com schema version, conteúdo validado, autor, timestamps, motivo e vigência.
- **FinancialPolicyApproval:** aprovação vinculada à versão, com aprovador, papel/delegação, decisão, justificativa e instante.
- **FinancialPolicyChange:** proposta de alteração, comparação entre versões, motivo e estado do fluxo.

Requisitos de persistência:
- escopo obrigatório por `organization_id`;
- versão do schema separada da versão da política;
- conteúdo validado no servidor contra schema conhecido;
- histórico append-only de aprovações e ativações;
- nenhuma política ativa sobrescrita;
- referência explícita à versão aplicada em cada operação financeira relevante;
- constraints e RLS impedindo leitura ou alteração entre organizações.

Não armazenar apenas um JSON livre sem validação, trilha de aprovação e regras de compatibilidade. A representação física (colunas normalizadas, JSONB validado ou abordagem híbrida) será decidida no desenho de dados F01.2/F01.3.

### 9.7 Governança e autorização

A diretoria pode delegar a configuração e aprovação a um responsável, mas a delegação deve ser explícita, limitada ao escopo e auditável. Não inferir poder de aprovação apenas por o usuário ser membro da organização.

O servidor deve validar, em cada ação:
- vínculo ativo do usuário com a organização;
- permissão específica para configurar ou aprovar políticas;
- validade e escopo da delegação, quando aplicável;
- segregação entre solicitante e aprovador, se exigida pela política vigente;
- versão esperada, evitando aprovações concorrentes ou sobre versão desatualizada.

A configuração não pode ampliar privilégios de acesso a dados nem substituir o controle central de autorização. Ela define regras operacionais financeiras dentro dos limites concedidos pelo produto.

### 9.8 Critérios de aceite do configurador

1. Uma organização nova permanece bloqueada para operações produtivas até concluir e aprovar a configuração obrigatória.
2. Usuário sem permissão não consegue criar, alterar, aprovar ou ativar políticas, mesmo chamando endpoints diretamente.
3. Uma versão aprovada é imutável; alterações criam nova versão e não mudam operações anteriores.
4. Uma aprovação registra identidade do aprovador, papel ou delegação, data, versão e justificativa.
5. Dependências inválidas impedem a aprovação e explicam como corrigir.
6. O resumo de revisão corresponde exatamente ao conteúdo que será aprovado (sem divergência entre tela e payload).
7. Cada operação financeira registra a versão de política aplicada, inclusive quando uma versão nova passa a vigorar depois.
8. Uma alteração futura pode ter vigência definida, sem retroagir sobre liquidações, conciliações ou auditorias já registradas.
9. Testes com duas organizações comprovam isolamento de configuração, versões, aprovações e operações.
10. Falhas durante a ativação não deixam a organização parcialmente configurada ou com duas versões simultaneamente ativas.
11. O fluxo de delegação expirada ou revogada bloqueia a aprovação e preserva o histórico.
12. A simulação do wizard não cria títulos, liquidações, conciliações ou efeitos financeiros reais.


**Nota de rastreabilidade:** F01.1 é uma especificação nova e distinta do plano legado D01–D07. A presente proposta não afirma que os cenários de aceite já foram executados.
