# Fase 1 — Inventário de domínio, estado e persistência

**Data:** 2026-11-10  
**Repositório:** `symbeon-labs/rsbuild-finance-app`  
**Base funcional inspecionada:** `main` em `c5b78fd6915cdab3dfda586fd628879b308f82c1`  
**Fundação D02 examinada:** branch `integration/d02-main-reconciled-2026-11-09`, migrations até `20261110013000`  
**Status:** inventário estático concluído; modelagem alvo proposta; nenhuma alteração de runtime/schema executada.

## 1. Resultado executivo

A Fase 1 confirma que a aplicação possui uma base D02 para organizações, memberships, contas, fontes, importações, artefatos e movimentações financeiras. Entretanto, a `EnterpriseWorkspace` ainda mantém quatro agregados operacionais em estado local e com fixtures de demonstração. Esses agregados não possuem tabelas próprias no conjunto de migrations D02 examinado.

Os quatro agregados são:

1. movimentações bancárias (`FinancialRecord`);
2. títulos a receber e baixas (`ReceivableTitle`);
3. comprovantes/canhotos (`DeliveryProof`);
4. pedidos estruturados de WhatsApp (`ParsedWhatsAppOrder`).

O domínio de movimentações já tem tabela `financial_records` na D02; os outros três domínios ainda precisam de persistência dedicada e de contratos de aplicação. O principal problema não é simplesmente substituir `localStorage`: é preservar os fluxos, regras de negócio, estados e evidências que hoje vivem em memória e nas fixtures, tornando-os transacionais, tenant-scoped e auditáveis.

**Não iniciar a migração em massa dos componentes antes de aprovar os contratos de domínio e a política de migração dos dados demonstrativos.**

## 2. Mapa do estado atual

### 2.1 Inventário de estado em `app/enterprise-workspace.tsx`

| Estado | Tipo | Inicialização atual | Mutação observada | Destino |
|---|---|---|---|---|
| `records` | `FinancialRecord[]` | vazio; hidratação local | importação confirmada, reset | `financial_records` |
| `pendingImport` | `FinancialRecord[]` | vazio | parser de arquivo, confirmar/cancelar | estado transitório de UI; não persistir como dado final |
| `pendingMetadata` | `BankMetadata` | null | parser CSV/OFX | metadados do lote/conta |
| `importErrors` | `string[]` | vazio | parser CSV/OFX | relatório de validação do lote |
| `titles` | `ReceivableTitle[]` | `INITIAL_SAMPLE_TITLES` | CSV, baixa em sessão, reload sample | novo domínio `receivable_titles` + eventos de liquidação |
| `proofs` | `DeliveryProof[]` | `INITIAL_SAMPLE_PROOFS` | CSV, confirmação de recebimento, reload sample | novo domínio `delivery_proofs` + evidências |
| `orders` | `ParsedWhatsAppOrder[]` | `INITIAL_SAMPLE_HA_ORDERS` | confirmar pedido parseado, reload sample | novo domínio `sales_orders` + `sales_order_items` |
| `whatsAppText` | string | vazio | digitação/limpeza | transitório de UI |
| `parsedPreview` | `ParsedWhatsAppOrder | null` | parser WhatsApp | transitório até confirmação |
| `period`, datas | preferências | `all`/vazio | filtro | preferência local ou perfil de usuário |
| `theme`, branding visual | preferências | sand/valores default | configuração | preferência/branding; não é dado financeiro |

Chaves locais operacionais confirmadas:
- `rsbuild_session_records`
- `rsbuild_session_titles`
- `rsbuild_session_proofs`
- `rsbuild_session_orders`

As quatro chaves são globais no navegador e não incluem organization UUID. A hidratação acontece no mount e os watchers gravam o estado inteiro. Trocar organização não fornece isolamento a esses dados.

Outras chaves locais observadas:
- `rsbuild_workspace_company`, `rsbuild_workspace_org_id`, `rsbuild_workspace_logo`
- `rsbuild_auth_email`
- `rsbuild_workspace_modules`, `rsbuild_workspace_brand_color`
- `rsbuild_theme`
- `rsbuild_period_option`, `rsbuild_period_start`, `rsbuild_period_end`

Essas chaves misturam preferências, branding, seleção de tenant e identidade de usuário. A identidade autenticada deve vir da sessão server-side; a organização ativa deve ser resolvida e autorizada pelo servidor. Preferências não sensíveis podem continuar locais após separar claramente sua natureza.

### 2.2 Ações/mutações que precisam virar casos de uso

| Fluxo atual | Comportamento atual | Caso de uso alvo | Observação |
|---|---|---|---|
| Importar extrato | parser roda no browser; confirmação concatena registros em memória | `CreateImportBatch` + persistência server-side | D02 já tem endpoint POST, mas UI da EnterpriseWorkspace não está conectada |
| Importar títulos CSV | parser roda no browser; concatena títulos | `ImportReceivableTitles` | precisa lote, validação, dedupe e proveniência |
| Confirmar baixa | altera status de títulos na sessão | `SettleReceivableTitle` | não pode significar baixa real sem evidência e autorização |
| Importar canhotos CSV | parser roda no browser; concatena comprovantes | `ImportDeliveryProofs` | associar NF-e, cliente, documento e arquivo de evidência |
| Confirmar recebimento | altera status e preenche recebedor/documento genéricos | `ConfirmDeliveryProof` | exige ator autenticado, timestamp, fonte e evidência; não fabricar dados de recebedor |
| Interpretar WhatsApp | parser cria preview em memória | `ParseSalesOrderDraft` | parsing não deve criar pedido definitivo |
| Confirmar pedido | concatena pedido em memória | `ConfirmSalesOrder` | requer cliente, itens, preços, quantidades e idempotência |
| Exportar Omie | gera CSV/OFX no browser | `GenerateExport` | registrar exportação, filtro, lote e ator; escrita no ERP continua fora de escopo sem contrato |
| Reset sessão | limpa registros e restaura amostras | remover/substituir por ambiente de demonstração | ação atual perigosa para um sistema persistido; não migrar como delete real |

### 2.3 Dados monetários e precisão

Os tipos da UI atual representam dinheiro em unidades principais como `number`:
- `FinancialRecord.amount`
- `ReceivableTitle.amount`
- `DeliveryProof.nfeAmount`
- `ParsedOrderItem.unitPrice/totalAmount`
- `ParsedWhatsAppOrder.totalAmount`

A D02 `financial_records.amount_minor` usa `bigint` em centavos e a PR #24 introduz adapter para movimentações. Para os novos domínios, padronizar persistência em unidades mínimas inteiras (`amount_minor`, `unit_price_minor`, `total_amount_minor`) e conversão explícita na fronteira. Não usar float como representação canônica de dinheiro.

Quantidades e cubagem permanecem decimais conforme unidade e regra do produto (ex.: fator de caixas 0,5); não converter esses campos em centavos nem assumir que todos são inteiros.

## 3. Esquema D02 existente e lacunas

### 3.1 Tabelas existentes no baseline D02

A migration `20261104210850_d02_managed_persistence.sql` cria:

- `organizations`
- `organization_memberships`
- `financial_accounts`
- `data_sources`
- `import_batches`
- `source_artifacts`
- `financial_records`
- `validation_runs`
- `evidence_records`
- `attestations`
- `integration_runs`
- `integration_records`
- `audit_events`

A D02 já possui chave organizacional, FKs compostas em parte dos relacionamentos, políticas RLS e separação de papel. A tabela `financial_records` tem `organization_id`, `account_id`, `data_source_id`, `import_batch_id`, `source_record_id`, `transaction_date`, `amount_minor`, `direction`, `status`, `deduplication_key` e `raw_payload`.

### 3.2 Lacunas de persistência

Não foram encontradas no conjunto de migrations D02 inspecionado tabelas dedicadas para:
- títulos a receber e eventos de liquidação;
- comprovantes de entrega e histórico de validação;
- pedidos, itens de pedido e versões do catálogo;
- contatos/clientes/fornecedores;
- alocações por unidade/centro de custo;
- aprovações/alçadas.

`evidence_records` pode referenciar evidências associadas a movimentações e artefatos, mas não substitui o domínio de comprovante de entrega. `integration_records` não substitui pedidos de venda. Não sobrecarregar essas tabelas genéricas com entidades operacionais.

### 3.3 Inconsistência de identidade organizacional

O workspace atual define `OrganizationId` como slug union: `rsbuild | hub_acai | mundo_sabor`. O banco D02 usa UUID em `organizations.id` e `organization_memberships.organization_id`.

Não permitir que o slug do preset seja tratado como UUID, nem aceitar que o cliente escolha livremente um organization UUID. Definir uma resolução server-side entre tenant ativo, membership e organização real. Slugs podem ser aliases de navegação/configuração, não chaves de autorização.

## 4. Modelo de domínio alvo — proposta para revisão

### 4.1 FinancialRecord (existente)

Manter `financial_records` como registro canônico de movimentação importada/manual. Preservar:
- tenant obrigatório;
- conta e fonte;
- lote de importação;
- deduplicação por tenant;
- valores em centavos;
- estados `pendente`, `conciliado`, `ignorado`;
- proveniência e autor.

Revisar adapter entre o tipo UI `FinancialRecord` e schema D02: a UI usa `amount` em reais e `status` não inclui `ignorado`, enquanto a persistência usa `amount_minor` e inclui `ignorado`. O mapeamento não pode descartar silenciosamente estado.

### 4.2 Receivables

**Tabelas propostas:** `receivable_titles`, `receivable_settlement_events`.

Campos mínimos propostos para título:
- `id`, `organization_id`;
- identificador externo/source e `data_source_id`;
- `document_number`, `customer_id` (quando cadastro de terceiros for aprovado), `customer_name_snapshot`, `customer_document_snapshot`;
- `issue_date`, `due_date`;
- `original_amount_minor`, `currency`;
- conta/categoria e referências externas;
- status do título e origem;
- created/updated by + timestamps.

Liquidação deve ser evento separado e imutável/append-only:
- título e tenant;
- movimentação bancária associada, quando houver;
- valor efetivamente recebido, juros, multa, desconto em centavos;
- data de liquidação;
- origem da confirmação (manual/importação/ERP);
- ator, evidência, idempotency key e correlation ID.

Não marcar título como baixado apenas porque o algoritmo sugeriu correspondência. Manter sugestão, revisão humana e liquidação confirmada como estados distintos.

### 4.3 Delivery & evidence

**Tabelas propostas:** `delivery_proofs`, `delivery_proof_events` (ou histórico append-only equivalente).

Campos mínimos:
- tenant e referência da NF-e;
- chave de acesso (quando disponível), número, emissão e valor em centavos;
- cliente/transportador/motorista como snapshot ou FK quando cadastro estiver definido;
- estado logístico;
- recebedor/documento somente quando realmente fornecidos e verificados;
- referência para `source_artifacts` / `evidence_records`;
- created/updated by, timestamps e origem.

O arquivo de canhoto deve residir em Storage privado, com metadados em banco e URL assinada sob autorização. Não usar URL pública para comprovantes ou documentos pessoais. `proofFileUrl` não deve ser uma URL arbitrária persistida pelo cliente.

Eventos devem registrar recebimento, recusa, extravio, correção e validação com ator, horário, motivo e evidência. Não sobrescrever a história de validação.

### 4.4 Sales orders & catalog

**Tabelas propostas:** `sales_orders`, `sales_order_items`, `product_catalog` e, se necessário, `sales_order_events`.

Pedido:
- tenant, código interno e referência externa;
- cliente (FK quando houver cadastro) e snapshot do nome;
- mensagem original protegida como dado pessoal/comercial;
- método de pagamento, data prevista, status e confiança do parser;
- subtotal/total em centavos;
- autor, timestamps e chave de idempotência.

Itens:
- SKU, descrição snapshot, variação/embalagem;
- quantidade e unidade;
- preço unitário/total em centavos;
- volume e fator de caixas;
- texto original e confiança por item.

Catálogo:
- tenant ou escopo explicitamente global e versionado;
- SKU único no escopo;
- embalagem, unidade, volume, fator de caixas;
- preço não deve ser tratado como preço vigente sem validade temporal;
- sinônimos do parser e histórico de alteração.

A mensagem do WhatsApp e os documentos de clientes podem conter dados pessoais/comerciais. Definir retenção, acesso e minimização antes de persistir rawMessage.

### 4.5 Contacts & organizational scope

Os contatos atuais são fixtures embutidas em `app/types/workspace.ts`. Se o produto precisar de cadastro compartilhado, criar domínio `organization_parties` (ou equivalente) com tipo cliente/fornecedor, identificadores, contatos e endereço. Não converter fixtures em clientes reais automaticamente.

Unidade/centro de custo não existe no modelo D02 atual. Não adicionar colunas arbitrárias sem validar se a unidade é entidade, dimensão analítica ou escopo de autorização. A decisão precisa ser tomada antes de abrir o acesso por unidade.

## 5. Contratos de aplicação propostos

Separar operações de leitura e comandos. Todos os endpoints server-side devem:
1. obter usuário pela sessão Supabase SSR;
2. resolver organização ativa e membership no servidor;
3. aplicar papel + escopo + ação;
4. validar schema e limites;
5. executar transação ou RPC apropriada;
6. registrar evento de auditoria/correlation ID;
7. retornar DTO sem campos internos sensíveis;
8. usar `Cache-Control: private, no-store` em dados sensíveis.

Rotas/casos de uso candidatos:
- `GET /api/finance/records` (paginado, filtros e agregados consistentes)
- `POST /api/imports` (já existe na PR #24; conectar UI)
- `GET/POST /api/receivables`
- `POST /api/receivables/import`
- `POST /api/receivables/:id/settlements`
- `GET/POST /api/delivery-proofs`
- `POST /api/delivery-proofs/import`
- `POST /api/delivery-proofs/:id/events`
- `GET/POST /api/sales-orders`
- `POST /api/sales-orders/parse` (draft sem persistência definitiva)
- `POST /api/sales-orders/:id/confirm`
- `GET /api/product-catalog`

Esses caminhos são propostas, não rotas confirmadas nem implementadas. Antes de codificar, conferir o mapa real de rotas do branch D02 final e evitar duplicar handlers existentes.

## 6. Matriz de domínio e riscos

| Domínio | Fonte atual | Persistência D02 | Risco principal | Prioridade |
|---|---|---|---|---|
| Movimentações | parser + localStorage | `financial_records` | UI não integrada; valores/status divergentes; tenant context | P0 |
| Lotes/artefatos | import endpoint server-side na PR #24 | `import_batches`, `source_artifacts` | UI ainda no fluxo local; falha de compensação/UX | P0 |
| Títulos/baixas | fixtures + CSV + estado local | ausente | baixa simulada pode ser interpretada como real | P0 |
| Canhotos | fixtures + CSV + estado local | evidência genérica apenas | documentos pessoais e prova jurídica sem trilha | P0 |
| Pedidos | fixtures + parser WhatsApp + estado local | ausente | pedido confirmado sem persistência; rawMessage sensível | P1 |
| Catálogo | constante no código | ausente | preço e SKU sem vigência/tenant | P1 |
| Contatos | fixtures no código | ausente | PII e dados comerciais embutidos no cliente | P1 |
| Preferências | localStorage | não aplicável | mistura com identidade/tenant | P2 |

## 7. Ordem de execução técnica recomendada

### Sprint 1A — contratos e fronteiras
- Confirmar contrato canônico de organização (UUID) e resolução do tenant.
- Definir DTOs e adapters de valores/status para `FinancialRecord`.
- Confirmar a rota de leitura paginada e agregação da D02; se ausente, implementar antes de migrar os componentes.
- Definir se o estado de conciliação será status do registro, entidade de match ou workflow separado.

### Sprint 1B — movimentações e importações
- Integrar UI com POST server-side de importação.
- Implementar leitura paginada e filtros server-side.
- Garantir totais completos e estado `ignorado`.
- Recuperar identidade OFX robusta da PR #20 e testar colisões.

### Sprint 1C — títulos e liquidações
- Aprovar esquema `receivable_titles` + `receivable_settlement_events`.
- Importação CSV idempotente e trilha de proveniência.
- Sugestão de conciliação separada de liquidação confirmada.
- Exportação Omie como artefato versionado; sem write-back até contrato formal.

### Sprint 1D — comprovantes
- Aprovar esquema e política de Storage privado.
- Importação e vínculo de NF-e/cliente.
- Eventos append-only e validação com evidência.
- Remover preenchimento automático de identidade/documento genéricos.

### Sprint 1E — pedidos
- Aprovar modelo de pedido e catálogo versionado.
- Salvar draft e confirmação como transições distintas.
- Idempotência e validação de SKU/preço/quantidade.
- Definir política de retenção do texto original do WhatsApp.

## 8. Bloqueios e decisões necessárias antes das migrations

1. **Tenant mapping:** como os slugs `rsbuild`, `hub_acai`, `mundo_sabor` correspondem aos UUIDs reais em `organizations`? A resolução será por domínio/URL, organização ativa persistida no perfil, ou seleção server-side?
2. **Títulos e baixa:** qual ERP/source é a fonte de verdade e a baixa no MVP é somente exportação, confirmação manual ou retorno de integração?
3. **Canhotos:** onde os arquivos ficam armazenados hoje e qual política de retenção/acesso é exigida?
4. **Pedidos:** pedido confirmado significa aceito internamente ou efetivamente enviado ao Omie? Manter estados distintos.
5. **Catálogo:** preço pertence à organização, unidade, tabela comercial ou é global versionado?
6. **Unidades/centros de custo:** são apenas dimensões de relatório ou também limites de acesso e aprovação?
7. **Demonstração:** fixtures e botões “recarregar amostra” serão removidos em produção, isolados em tenant de demonstração, ou mantidos atrás de ambiente/feature flag?
8. **Moeda e precisão:** confirmar BRL como moeda única inicial e regras de arredondamento por domínio.

## 9. Critérios para encerrar a Fase 1

- [x] Quatro agregados operacionais e suas mutações mapeados no código atual.
- [x] Tabelas D02 existentes e lacunas identificadas nas migrations examinadas.
- [x] Diferenças de dinheiro, status e identidade organizacional registradas.
- [x] Proposta de entidades, eventos e contratos de aplicação elaborada.
- [ ] Decisões de domínio acima aprovadas.
- [ ] Mapa de rotas no head final D02 confirmado.
- [ ] Esquema relacional e políticas RLS revisados.
- [ ] Plano de migração dos dados de demonstração aprovado.

**Fase 1 está concluída como auditoria/inventário estático. A implementação de schema e APIs permanece bloqueada até aprovação dos contratos e decisões listadas na seção 8.**
