# Matriz de Capacidades — Diagnóstico D02

**Data da verificação:** 2026-11-12  
**Repositório:** `symbeon-labs/rsbuild-finance-app`  
**Base de código:** `main` (snapshot analisado após o merge da PR #39)  
**Supabase:** projeto Finance-app `vsgbzgoeiatgjopasnlu`  
**Escopo:** capacidades de persistência, importação, organização/tenant, conciliação e liquidação que condicionam o início do F01.

## 1. Legenda de evidência

| Estado | Significado |
|---|---|
| `MAIN` | Código ou migration presente na branch `main`; não implica, sozinho, funcionamento ponta a ponta. |
| `PR-ONLY` | Encontrado em PR aberta/branch não integrada; não considerar disponível em produção. |
| `REMOTE-VERIFIED` | Estrutura ou migration confirmada diretamente no projeto Supabase Finance-app. |
| `MISSING` | Não encontrado no código/esquema inspecionado e necessário para a capacidade. |
| `UNKNOWN` | Evidência insuficiente para afirmar implementação, aplicação remota ou comportamento. |

Uma capacidade pode ter mais de um estado: por exemplo, `MAIN + REMOTE-VERIFIED` confirma código/migration e estrutura remota, mas não comprova QA funcional.

## 2. Resumo executivo

O D02 já oferece uma fundação real de persistência multi-tenant para **contas financeiras, fontes, lotes de importação, artefatos e movimentações bancárias**. As migrations centrais de D02 estão registradas no projeto Supabase Finance-app, e as 15 tabelas públicas observadas estão com RLS habilitado.

O D02 **não equivale a um ciclo financeiro completo**. No esquema remoto inspecionado não foram encontradas entidades próprias para títulos a pagar, títulos a receber, liquidações/baixas ou decisões persistidas de conciliação. A interface e a lógica de conciliação trabalham com tipos e dados em memória; a geração de CSV para o ERP não é uma liquidação persistida nem uma integração operacional com o ERP.

**Conclusão:** há base para iniciar a especificação do F01, mas não para declarar F01 implementado. O próximo passo é fechar o modelo de títulos e liquidações, mapear as decisões de conciliação e definir as transições/auditoria antes de propor migrations.

## 3. Matriz de capacidades

| Capacidade | Evidência em `main` | Supabase remoto | Estado | Diagnóstico / limite |
|---|---|---|---|---|
| Organizações e isolamento por tenant | Migration D02 cria `organizations` e `organization_memberships`; chaves compostas preservam escopo organizacional | Ambas as tabelas existem; RLS habilitado | `MAIN + REMOTE-VERIFIED` | Fundação multi-tenant presente. Testes de isolamento entre dois tenants continuam necessários. |
| Membership e papéis | Enum `owner/admin/operator/viewer`; políticas por membership | Tabela e políticas de leitura verificadas | `MAIN + REMOTE-VERIFIED` | Provisionamento e autorização server-side devem continuar sendo a autoridade; não confiar em IDs enviados pelo browser. |
| Contas financeiras | `financial_accounts` com organização, instituição, tipo, moeda e referência externa | Tabela existe; RLS habilitado | `MAIN + REMOTE-VERIFIED` | Cadastro estrutural disponível. Não prova sincronização bancária nem saldo atualizado. |
| Fontes de dados | `data_sources` para CSV, OFX, ERP, banco, manual e outros | Tabela existe; RLS habilitado | `MAIN + REMOTE-VERIFIED` | Cadastro de fonte disponível; conectores ERP/bancários operacionais não foram comprovados. |
| Lotes de importação | `import_batches` com status, hash, contagens, autor e timestamps | Tabela existe; RLS habilitado | `MAIN + REMOTE-VERIFIED` | Estrutura de rastreabilidade disponível. |
| Artefatos de origem | `source_artifacts`, bucket privado e hash do arquivo | Tabela existe; RLS habilitado; migrations de boundary presentes | `MAIN + REMOTE-VERIFIED` | Há desenho de armazenamento privado e vínculo tenant-scoped. Revisar políticas de Storage e teste real de upload/download na homologação. |
| Importação transacional de extratos | RPC transacional, validação de payload, hash/dedupe e conversão para `amount_minor` | Migration `20261109130004` e boundary confiável `20261110004255` registradas | `MAIN + REMOTE-VERIFIED` | Capacidade implementada no backend. Ainda requer teste funcional com arquivos reais de homologação, duplicatas e falhas. |
| Movimentações bancárias | `financial_records`: data, descrição, valor em centavos, direção, categoria, origem e status | Tabela existe; RLS habilitado | `MAIN + REMOTE-VERIFIED` | É o registro do fato bancário/importado. Não deve ser usado como substituto de título financeiro. |
| Conversão reais/centavos | `majorToMinor` e `minorToMajor` em `lib/finance-persistence.ts` | Coluna `amount_minor` é inteiro | `MAIN + REMOTE-VERIFIED` | Fronteira monetária explícita presente; manter conversão centralizada e coberta por testes. |
| Deduplicação de movimentações | Índice único parcial por organização e chave de deduplicação; RPC usa `ON CONFLICT` | Índice/estrutura decorrentes das migrations registradas | `MAIN + REMOTE-VERIFIED` | Dedupe de importação existe. Não confundir com idempotência de liquidação ou de integração ERP. |
| Validações de importação | `validation_runs` com nome/versão/resultado e resumo | Tabela existe; RLS habilitado | `MAIN + REMOTE-VERIFIED` | Registro de execução disponível; cobertura e evidência de validações por cenário devem ser verificadas. |
| Evidências e atestações | `evidence_records` e `attestations` vinculadas a registros/artefatos | Tabelas existem; RLS habilitado | `MAIN + REMOTE-VERIFIED` | Infraestrutura genérica de evidência existe; não é, por si só, histórico de liquidação financeira. |
| Auditoria de eventos | `audit_events` com organização, ator, tipo de evento, entidade, data e metadados | Tabela existe; RLS habilitado | `MAIN + REMOTE-VERIFIED` | Base de auditoria existe. A cobertura de eventos de conciliação, aprovação e liquidação ainda precisa ser definida. |
| Execuções de integração | `integration_runs` e `integration_records` | Tabelas existem; RLS habilitado | `MAIN + REMOTE-VERIFIED` | Estrutura genérica de integração. Não comprova conector Omie ativo, credenciais, sincronização ou escrita no ERP. |
| Títulos a receber (AR) persistentes | Tipo `ReceivableTitle` em `lib/reconciliation.ts`; importação CSV na interface | Nenhuma tabela AR identificada no esquema público inspecionado | `MAIN` (lógica/UI) + `MISSING` (persistência) | Os títulos usados pela conciliação não têm persistência própria comprovada. |
| Títulos a pagar (AP) persistentes | Não identificado no domínio/código inspecionado | Nenhuma tabela AP identificada | `MISSING` | Necessário para ciclo de obrigações, vencimentos e pagamentos. |
| Liquidações/baixas persistentes | UI recebe `onConfirmSettlementInSession`; exportação de lote CSV | Nenhuma entidade de liquidação identificada | `MAIN` (fluxo de sessão/exportação) + `MISSING` (evento persistido) | Confirmação em sessão não equivale a baixa persistida. Não há histórico transacional comprovado. |
| Conciliação assistida | `matchTitlesWithRecords` sugere correspondências e divergências | Não foi identificada entidade própria de decisão/match persistido | `MAIN` (algoritmo) + `MISSING` (decisão persistida) | A sugestão algorítmica existe; aprovação, justificativa, vínculo e reversão precisam de persistência auditável. |
| Integração operacional Omie | Tipos de payload e exportação CSV para baixas | Estrutura genérica de integração, sem prova de execução Omie | `MAIN` (exportação) + `UNKNOWN` (conector real) | Tratar como exportação assistida/manual até existir evidência de integração autenticada e testada. |
| DRE e relatórios gerenciais | Tela de DRE identificada como placeholder no diagnóstico anterior | Não há modelo contábil/classificação suficiente confirmado para DRE | `MISSING` / `UNKNOWN` | Não declarar DRE funcional. Exige regras documentadas e dados reproduzíveis. |
| Convites e branding da organização | Migration cria `organization_invitations` e `organization_branding` | Ambas as tabelas existem; RLS habilitado | `MAIN + REMOTE-VERIFIED` | Capacidade administrativa/visual, não substitui autorização efetiva nem o ciclo financeiro. |
| Slugs de tenant | Migration adiciona slug e índice único | Migration `20261110120135` registrada | `MAIN + REMOTE-VERIFIED` | Slug é identificador de roteamento; UUID continua sendo chave relacional/autorizativa. |
| Convites — ciclo de aceite completo | Evolução de lifecycle localizada na PR #37, ainda aberta no snapshot do ledger | Não inferir aplicação remota a partir da PR | `PR-ONLY` / `UNKNOWN` | Revisar e reconciliar a PR antes de tratar o fluxo completo como disponível. |

## 4. Inventário remoto observado

A consulta ao projeto Supabase Finance-app retornou as seguintes tabelas públicas; todas estavam com RLS habilitado:

- `attestations`
- `audit_events`
- `data_sources`
- `evidence_records`
- `financial_accounts`
- `financial_records`
- `import_batches`
- `integration_records`
- `integration_runs`
- `organization_branding`
- `organization_invitations`
- `organization_memberships`
- `organizations`
- `source_artifacts`
- `validation_runs`

As migrations D02 consultadas também aparecem no histórico remoto, incluindo:

- `20261104210850_d02_managed_persistence`
- `20261109130004_d02_transactional_imports`
- `20261110004255_d02_trusted_import_boundary`
- `20261110013000_d02_organization_admin_and_branding`
- `20261110120135_d02_organization_slugs`
- `20261110212052_security_default_grants_hardening`

**Limite da verificação:** histórico de migrations e catálogo de tabelas comprovam estrutura registrada no projeto consultado. Não comprovam, isoladamente, execução ponta a ponta, qualidade dos dados, segurança contra todos os cenários ou aceite funcional. A consulta de tabelas não identificou entidades próprias de AP, AR, settlement ou reconciliation decision.

## 5. PRs e fronteiras de integração relevantes

| PR | Tema | Tratamento para esta matriz |
|---|---|---|
| #12 / #19 / #20 / #21 | Linhagens de fundação D02 e reconciliação | Não reaplicar em bloco: a main já contém parte da fundação e há divergência de histórico. Usar o ledger #41 para decidir reaproveitamento seletivo. |
| #29 | Organização ativa e login | Reconciliar separadamente. A seleção de organização/cookie não torna títulos ou baixas locais persistentes. |
| #37 | Lifecycle de convites | `PR-ONLY` no snapshot; revisar dependências e migration antes de integração. |
| #32 / #33 | Grants e workflows de segurança | Manter em revisão de segurança. Não executar workflows nem presumir que estado remoto foi validado pelo conteúdo da PR. |
| #40 | Portfólio de projetos e sprints | Domínio de workspace/portfólio; não é parte do modelo financeiro F01. Validar e integrar em trilha própria. |
| #41 | PR Reconciliation Ledger | Documento de governança para orientar a reconciliação; não altera runtime nem banco. |

## 6. Implicações para F01 — Gestão financeira persistente

F01 deve introduzir ou formalizar entidades distintas, com chaves tenant-scoped e trilha de auditoria:

1. **Título financeiro:** direito ou obrigação, com tipo (AR/AP), contraparte, documento, valor original, emissão, vencimento, competência, status e origem.
2. **Liquidação:** evento financeiro efetivo, com data, valor pago/recebido, juros, multa, desconto, conta, referência bancária e ator responsável.
3. **Alocação da liquidação:** vínculo entre liquidação e um ou mais títulos, permitindo parcialidade e liquidação agrupada sem duplicar valores.
4. **Decisão de conciliação:** associação entre título/liquidação e movimentação bancária, com método, confiança, decisão humana, justificativa, ator, data e estado.
5. **Histórico imutável/auditável:** eventos de criação, edição permitida, aprovação, liquidação, estorno/reversão e conciliação, com correlação e autoria confiável.

### Regras de domínio a preservar

- Título não é movimentação bancária.
- Importar um extrato cria/atualiza fatos bancários; não cria automaticamente uma liquidação aprovada.
- Uma sugestão de match não é uma decisão confirmada.
- Exportar CSV para o Omie não significa que o ERP recebeu ou aceitou a baixa.
- Liquidações parciais e agrupadas precisam ser representáveis sem perda de rastreabilidade.
- Valores persistidos devem permanecer em centavos inteiros.
- Toda leitura/escrita deve respeitar organização/tenant e autorização validada no servidor.
- Estorno/correção deve preservar o evento original e gerar trilha reversível, não apagar silenciosamente o histórico.

## 7. Ordem recomendada de trabalho

| Ordem | Entrega | Saída exigida | Gate para avançar |
|---|---|---|---|
| 1 | Fechar inventário D02 | Schema, migrations, policies, RPCs e consumidores da aplicação reconciliados | Nenhuma divergência crítica entre main e remoto sem classificação. |
| 2 | Especificar domínio F01 | ERD/entidades, cardinalidades, estados e invariantes AP/AR/liquidação | Aprovação explícita do modelo antes de migration. |
| 3 | Definir contratos de serviço | Operações de criação, atualização, baixa, parcialidade, reversão e consulta | Tenant e ator derivados de contexto confiável no servidor. |
| 4 | Definir matriz de permissões | Owner/admin/operator/viewer por operação | Testes positivos e negativos entre dois tenants. |
| 5 | Definir cenários de aceite | Casos de uso, idempotência, concorrência, falhas e auditoria | Critérios reproduzíveis antes da implementação. |
| 6 | Planejar migrations incrementais | SQL forward-only, índices, FKs, RLS, políticas e estratégia de backfill | Revisão de segurança e plano de rollback/compensação. |
| 7 | Implementar e homologar | Persistência real e UI conectada aos serviços | Reload/sessão, isolamento tenant, trilha e E2E aprovados. |

## 8. Pendências explícitas / itens não verificados

- Não foi executado teste funcional autenticado de importação com arquivo real neste diagnóstico.
- Não foram executados testes de isolamento entre dois usuários/organizações.
- Não foi testado upload/download real no Storage nem cada cenário de política de objeto.
- Não foi comprovada integração operacional com Omie ou banco.
- Não foi confirmada persistência de títulos, liquidações ou decisões de conciliação — o esquema consultado não apresenta entidades próprias para esses conceitos.
- Não foi validada a cobertura completa de auditoria por operação.
- Não foi avaliada nesta matriz a prontidão de deploy, CI ou QA de interface.

## 9. Decisão

**D02 é uma fundação de persistência e importação de movimentações, não um ciclo financeiro completo.** F01 pode avançar agora na etapa de especificação do domínio e contratos. A criação de migrations deve aguardar a aprovação do modelo AP/AR, liquidações e conciliação, além da matriz de permissões e dos cenários de aceite.

Nenhuma migration foi aplicada, nenhum dado/configuração do Supabase foi alterado e nenhuma PR foi mesclada ou fechada durante a produção desta matriz.
