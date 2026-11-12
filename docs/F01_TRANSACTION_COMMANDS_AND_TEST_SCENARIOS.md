# F01.4 — Especificação dos comandos transacionais e cenários de teste

**Versão:** 0.1  
**Status:** Proposta para revisão — não aprovada para implementação  
**Dependências:** F01.1 Modelo de Domínio; F01.2 Modelo Lógico; F01.3 Modelo Físico; decisões B01–B08.

> Especificação comportamental. Este documento não cria endpoints, código, migrations, tabelas, políticas RLS nem alterações no Supabase. Os nomes dos comandos são contratos conceituais. Divergências com F01.1–F01.3 devem ser resolvidas antes da implementação.

## 1. Princípios transacionais

1. Uma operação de negócio é atômica: domínio, saldos/projeções e auditoria confirmam ou falham juntos.
2. Organização, membership e permissões são validadas no servidor em cada comando. IDs enviados pelo cliente são referências, nunca prova de autoridade.
3. O ator é derivado da sessão autenticada. Nunca confiar em actor_id recebido do browser.
4. Valores monetários são inteiros em centavos, com moeda explícita; nunca usar ponto flutuante.
5. Eventos confirmados são históricos. Correções ocorrem por eventos compensatórios, não por edição/exclusão silenciosa.
6. Todo comando mutável recebe chave idempotente escopada por organização e tipo de comando.
7. A autorização granular, seu escopo, vigência e revogação são revalidados no momento da operação.
8. Operações maker-checker exigem atores distintos conforme B02; no MVP, confirmação de liquidação e aprovação de política sempre exigem ator distinto do criador.
9. Saldos e permissões são revalidados depois da aquisição dos locks.
10. Auditoria crítica participa da mesma transação. Falha ao gravar auditoria implica rollback.
11. A operação registra a versão da política vigente no instante efetivo.
12. Sugestão algorítmica nunca confirma liquidação nem conciliação.

### 1.1 Envelope comum

| Campo | Regra |
|---|---|
| organization_id | Contexto solicitado, validado contra membership e tenant |
| command_id | Identificador de rastreio |
| idempotency_key | Obrigatória, única por organização e namespace |
| expected_version | Obrigatória em recursos versionados sujeitos a concorrência |
| effective_at | Opcional; validado pelo servidor |
| reason | Obrigatório em cancelamento, estorno, rejeição, override e revogação |
| payload | Dados de negócio, sem autoridade confiável do ator |

O servidor acrescenta ator autenticado, correlation ID, instante de processamento, permissões efetivas, timezone organizacional e versão de política.

### 1.2 Erros canônicos

- VALIDATION_ERROR: regra ou campo inválido; nenhuma gravação parcial.
- FORBIDDEN: ação ou escopo não autorizado.
- NOT_FOUND: recurso inexistente ou não visível no tenant.
- STATE_CONFLICT: estado incompatível.
- VERSION_CONFLICT: expected_version obsoleta.
- BALANCE_CONFLICT: saldo insuficiente após recálculo.
- IDEMPOTENCY_KEY_REUSED: mesma chave com payload diferente.
- CONCURRENCY_CONFLICT: recurso alterado por operação concorrente.
- RETRYABLE_TRANSACTION_ERROR: deadlock/timeout; transação revertida e retry seguro com a mesma chave.

Mesmo comando, chave e payload retornam o resultado original. Mesma chave com payload diferente sempre gera conflito.

---

## 2. Contratos dos comandos

### 2.1 Títulos

#### create_title

Cria título a pagar ou receber em rascunho, com contraparte, origem e parcelas.

**Entrada:** direção, descrição, moeda (BRL no MVP), valor original em centavos, datas, contraparte/snapshot, parcelas e proveniência.

**Pré-condições:** membership ativa; permissão title.create ou title.import; configuração financeira aprovada e vigente; contraparte no mesmo tenant; soma das parcelas igual ao valor original; parcelas positivas e na mesma moeda. Sem identificador externo estável, não deduplicar por heurística.

**Efeitos:** cria título e parcelas em rascunho, guarda snapshot/proveniência/hash de origem e registra title.created. Não cria liquidação.

#### confirm_title

Confirma título em rascunho.

**Pré-condições:** estado draft; expected_version atual; permissão title.confirm; dados, parcelas, contraparte e origem válidos; sem identidade externa conflitante; política vigente.

**Efeitos:** draft → open; parcelas passam ao estado operacional; fixa versão de política e instante; registra title.confirmed.

Confirmação não liquida o título nem altera movimento bancário.

#### cancel_title

Cancela título draft ou open sem liquidação efetiva.

**Pré-condições:** permissão title.cancel, motivo e alçada; nenhum saldo extinto nem alocação ativa. Título parcialmente ou totalmente liquidado exige reversão prévia.

**Efeitos:** estado cancelled e evento auditável. Não apagar o título nem suas parcelas.

### 2.2 Liquidações e alocações

#### create_settlement

Cria rascunho de pagamento/recebimento.

**Entrada:** tipo payment/receipt, instante efetivo, moeda, meio, conta quando aplicável, referência externa e valor de caixa esperado.

**Pré-condições:** permissão settlement.create; valor positivo; moeda e organização válidas.

**Efeitos:** cria draft e registra settlement.created. Rascunho pode existir sem alocação; confirmação não.

#### allocate_settlement

Aloca rascunho a título/parcela.

**Pré-condições:** settlement draft; título open ou partially_settled; mesma organização/moeda; direção compatível (payment/payable; receipt/receivable); principal positivo e dentro do saldo; ajustes autorizados pela política. Adiantamento/crédito e excedente não são permitidos no MVP.

**Cálculo por alocação:**
- Valor extinto do título = principal + soma dos title_effect_minor.
- Valor de caixa = principal + soma dos cash_effect_minor.
- Ambos devem ser positivos no MVP.
- Juros/multa, desconto e abatimento devem manter efeitos discriminados.
- Tarifa bancária não é ajuste do título.

**Efeitos:** cria alocação de rascunho e registra settlement.allocation_added. Não consome movimento bancário.

#### unallocate_settlement

Remove uma alocação ainda não confirmada de liquidação draft.

**Pré-condições:** liquidação draft; alocação não confirmada e sem vínculo bancário efetivado; permissão settlement.allocate; motivo e versão atual.

**Efeitos:** marca a alocação como removida/cancelada no histórico do rascunho, recalcula composição e audita. Nunca desfazer alocação confirmada por este comando.

#### confirm_settlement

Confirma pagamento/recebimento e efetiva as alocações.

**Pré-condições:**
- Liquidação draft e expected_version atual.
- Uma ou mais alocações completas.
- Soma do caixa das alocações = gross_amount_minor.
- Nenhum excedente, crédito não aplicado ou alocação sem título.
- Saldo suficiente em todos os títulos/parcelas após locks e recálculo.
- Permissão settlement.confirm e aprovador distinto do criador.
- Política aprovada e vigente.
- Datas, moeda e direções válidas.

**Efeitos atômicos:**
1. Bloquear liquidação, títulos e parcelas em ordem determinística.
2. Recalcular saldos e validar autorização/política novamente.
3. Marcar settlement confirmed e registrar confirmador/instante.
4. Efetivar alocações e atualizar títulos para partially_settled ou settled.
5. Registrar auditoria e versão de política.
6. Commit único.

Se qualquer alocação falhar, toda a confirmação falha. Não confirmar parcialmente o grupo.

#### reverse_settlement

Reverte liquidação confirmada, parcial ou totalmente.

**Entrada:** liquidação original, linhas por alocação original, valor de título revertido, valor de caixa revertido, motivo.

**Pré-condições:** liquidação confirmada ou parcialmente revertida; permissão settlement.reverse e alçada; maker-checker conforme política; valores não superam saldos ainda reversíveis; motivo obrigatório.

**Efeitos:** cria evento append-only de reversão; restaura saldo do título/parcela; atualiza estado para parcialmente revertida ou reversed; libera alocação bancária somente por evento explícito relacionado. Retorno efetivo de dinheiro ao banco é movimento distinto.

Repetir a mesma chave retorna a reversão original. Nova chave só pode reverter o saldo ainda disponível.

### 2.3 Movimentos bancários

#### allocate_bank_movement

Consome parte de financial_records por liquidação confirmada.

**Pré-condições:** mesmo tenant/moeda; direção compatível (entrada/receipt; saída/payment); liquidação confirmada; permissão bank_movement.allocate; valor positivo e menor ou igual ao saldo disponível.

**Efeitos:** bloqueia movimento e recursos relacionados; calcula saldo disponível no servidor; cria bank_settlement_allocation append-only; registra auditoria e atualiza projeção parcial/conciliada.

Saldo disponível = valor absoluto do movimento − alocações ativas + valores liberados por reversões. Nunca pode ser negativo.

#### unallocate_bank_movement

Permitido somente para alocação ainda não efetivada/confirmada, caso o modelo físico suporte esse estado. Não é mecanismo de desfazer consumo confirmado.

#### reverse_bank_allocation

Libera alocação bancária efetivada somente quando vinculada a reversão válida da liquidação. Registra bank_settlement_allocation_reversal append-only. Não altera o valor original de financial_records.

### 2.4 Conciliação

#### propose_reconciliation

Cria proposta entre título/parcela, liquidação e/ou movimento.

**Pré-condições:** permissão reconciliation.propose; referências no mesmo tenant; compatibilidade de moeda/direção; método, versão de regra e evidências registrados.

**Efeitos:** cria decisão suggested e links de evidência. Não consome saldo, não liquida título e não altera status financeiro.

#### confirm_reconciliation

Confirma decisão sugerida.

**Pré-condições:** decisão suggested e versão atual; permissão reconciliation.confirm; permissão adicional reconciliation.approve_discrepancy se divergente; ator distinto do proponente quando houver efeito financeiro; evidências válidas; saldo do movimento disponível; tolerância ou justificativa aprovada.

**Efeitos:** decisão confirmed, links imutáveis, ator, instante, motivo e auditoria. Se houver consumo quantitativo do movimento, a alocação no ledger bancário deve ocorrer na mesma transação. Conciliação não confirma liquidação.

#### reject_reconciliation

Rejeita sugestão sem apagar evidências.

**Pré-condições:** suggested; permissão reconciliation.reject; motivo/código e versão atual.

**Efeitos:** estado rejected e auditoria. Nova proposta cria nova decisão.

### 2.5 Configuração financeira

#### create_policy_configuration

Cria rascunho de configuração por organização/módulo. Exige policy.configure e membership ativa. Defaults são recomendações, não aprovação. Liquidação sem alocação e crédito/adiantamento permanecem indisponíveis no MVP.

#### submit_policy_configuration

Submete snapshot imutável para aprovação. Valida schema, allowlists, dependências, alçadas, timezone IANA e vigência. Correção posterior cria nova versão.

#### approve_policy_configuration

Aprova snapshot submetido. Exige policy.approve, delegação válida quando aplicável e ator distinto do criador/submissor.

#### activate_policy_configuration

Ativa versão aprovada com intervalo semiaberto [effective_from, effective_until). Valida ausência de sobreposição sob serialização transacional. Aprovação e ativação são eventos distintos. Cada comando financeiro fixa a versão vigente.

Estados sugeridos: draft → submitted → approved → scheduled/active → superseded. Rejeição/cancelamento preservam histórico.

### 2.6 Autorizações

#### grant_financial_authorization

Concede permissão por organização, usuário, ação, escopo e vigência.

**Pré-condições:** concedente possui authority.delegate no escopo; beneficiário tem membership ativa; permissão em allowlist; escopo validado por schema; cadeia de delegação válida; motivo obrigatório.

**Efeitos:** cria grant auditável com concedente, beneficiário, vigência e escopo. Não permitir autoelevação nem concessão de poder superior.

#### revoke_financial_authorization

Revoga grant vigente com permissão authority.delegate e motivo. Preserva registro e instante da revogação. Comandos seguintes revalidam grant e membership; eventos passados não são invalidados retroativamente.

---

## 3. Concorrência, locks, idempotência e auditoria

### 3.1 Recursos a bloquear

| Operação | Recursos |
|---|---|
| Confirmar título | Título e parcelas |
| Confirmar liquidação | Liquidação, títulos e parcelas de todas as alocações |
| Reverter liquidação | Liquidação, alocações originais, títulos/parcelas e alocações bancárias afetadas |
| Alocar movimento | financial_records, liquidação e ledger bancário |
| Confirmar conciliação com consumo | Decisão, movimento e recursos financeiros |
| Ativar política | Organização + módulo/configuração + versões concorrentes |
| Grant/revoke | Organização, membership, autorização e cadeia de delegação |

Usar transação PostgreSQL e locks de linha ou mecanismo equivalente. Padronizar ordem determinística de bloqueio por organização, tipo de recurso e UUID. Revalidar estado, saldo, membership, autorização e política depois dos locks. Constraints do banco são a última linha de defesa; validação de frontend não é controle de integridade.

Deadlock/timeout aborta tudo. Retry limitado usa a mesma chave idempotente. Não manter transação aberta durante chamadas externas; integrações futuras devem usar outbox/job separado.

### 3.2 Idempotência

Persistir organização, namespace do comando, chave, hash canônico do payload, estado e referência da resposta. Mesmo hash retorna resposta original sem repetir efeitos; hash diferente gera IDEMPOTENCY_KEY_REUSED. Chaves diferentes não dispensam invariantes: comandos concorrentes disputando o mesmo saldo devem serializar. Retenção deve cobrir o horizonte de reenvio de integrações.

### 3.3 Auditoria

Registrar organização, ator autenticado, comando, entidades relacionadas, correlation ID, chave/hash idempotente, estado anterior/novo, versão, política aplicada, motivo, instante de processamento e instante efetivo. Não registrar tokens ou segredos. Auditoria financeira é append-only; falha ao gravar auditoria implica rollback.

---

## 4. Fixtures aritméticas

Todos os valores são centavos inteiros em BRL. Convenção: efeitos positivos aumentam valor; negativos reduzem.

| Caso | Entrada | Resultado esperado |
|---|---|---|
| A1 — Juros | Principal 100.000; cash_effect +2.000; title_effect +2.000 | Título extinto 102.000; caixa 102.000 |
| A2 — Desconto caixa-only | Principal 100.000; cash_effect -5.000; title_effect 0 | Título extinto 100.000; caixa 95.000; saldo zero |
| A3 — Desconto reduz obrigação | Principal 100.000; cash_effect -5.000; title_effect -5.000 | Extinção 95.000; caixa 95.000; saldo remanescente 5.000, salvo baixa residual aprovada |
| A4 — Pagamento agrupado | Título A 100.000 + título B 50.000; caixa 150.000 | Ambas alocações confirmadas; ambos settled |
| A5 — Parcial | Título 200.000; alocações sucessivas 75.000 e 25.000 | Saldos 125.000 e depois 100.000; estado parcial |
| A6 — Estorno | Liquidação 100.000; reversões 30.000 e 70.000 | Reabre 30.000 e depois 100.000; estado parcial e depois reversed |
| A7 — Split bancário | Movimento 200.000; alocações 120.000 e 80.000 | Disponível 80.000 e depois zero; terceira alocação de 1 centavo rejeitada |
| A8 — Tarifa | Caixa 99.000; título extinto 100.000; tarifa 1.000 em movimento separado | Tarifa não altera título; diferença explicada por registro separado |

A1 é fixture de aritmética, não afirmação de regra legal/contratual. O negócio deve aprovar a semântica dos ajustes antes da implementação.

---

## 5. Matriz de cenários de teste

Implementar testes unitários puros para cálculos/transições; integração transacional contra PostgreSQL isolado; testes de autorização/RLS; e E2E com dois tenants. Os cenários abaixo são especificações, não testes já executados.

### 5.1 Títulos

| ID | Cenário | Resultado esperado |
|---|---|---|
| T01 | Criar título a pagar/receber válido | Rascunho e auditoria no tenant correto |
| T02 | Parcelas somam total | Aceitar e preservar principal |
| T03 | Parcelas diferem do total em 1 centavo | Rejeitar sem gravação parcial |
| T04 | Confirmar título válido | draft → open |
| T05 | Confirmar título já confirmado | Conflito sem evento duplicado |
| T06 | Cancelar título sem liquidação | Cancelar com motivo |
| T07 | Cancelar título parcialmente liquidado | Rejeitar; exigir reversão |
| T08 | expected_version obsoleta | VERSION_CONFLICT |
| T09 | Contraparte de outro tenant | Rejeitar sem vazamento |
| T10 | Reimportar mesmo ID externo e payload | Replay sem duplicação |
| T11 | Mesmo ID externo com payload diferente | Revisão/conflito, sem sobrescrita silenciosa |

### 5.2 Liquidação e reversão

| ID | Cenário | Resultado esperado |
|---|---|---|
| S01 | Criar rascunho sem alocação | Aceitar rascunho |
| S02 | Confirmar sem alocação | Rejeitar no MVP |
| S03 | Direção de título incompatível | Rejeitar |
| S04 | Tenant/moeda incompatível | Rejeitar |
| S05 | Alocação acima do saldo | Rejeitar transacionalmente |
| S06 | Pagamento agrupado válido | Confirmar todas as alocações |
| S07 | Uma alocação fica insuficiente por concorrência | Rollback integral |
| S08 | Criador tenta confirmar própria liquidação | Rejeitar no MVP |
| S09 | Aprovador distinto com grant válido | Aceitar |
| S10 | Grant revogado/expirado | Rejeitar |
| S11 | Replay da confirmação com mesma chave | Retornar evento original |
| S12 | Mesma chave com payload diferente | IDEMPOTENCY_KEY_REUSED |
| S13 | Juros/multa com sinais permitidos | Fechamento exato |
| S14 | Desconto caixa-only | Caixa reduz; principal preservado |
| S15 | Combinação de sinais inválida | Rejeitar |
| S16 | Tarifa como ajuste de título | Rejeitar ou exigir registro separado |
| S17 | Estorno parcial | Reabrir saldo proporcional |
| S18 | Estorno acima do saldo reversível | Rejeitar |
| S19 | Estornos concorrentes | Serializar; nunca reverter acima do original |
| S20 | Replay de estorno | Não duplicar |
| S21 | Estorno sem motivo | Rejeitar |
| S22 | Falha na auditoria | Rollback integral |

### 5.3 Movimento bancário e conciliação

| ID | Cenário | Resultado esperado |
|---|---|---|
| R01 | Saída alocada a pagamento | Aceitar se saldo/direção/moeda válidos |
| R02 | Entrada alocada a recebimento | Aceitar |
| R03 | Entrada alocada a pagamento | Rejeitar |
| R04 | Split entre duas liquidações | Saldos corretos |
| R05 | Consumo excede movimento em 1 centavo | Rejeitar |
| R06 | Duas requisições concorrentes consomem mesmo saldo | Sem saldo negativo |
| R07 | Propor conciliação | Sugestão sem efeito financeiro |
| R08 | Confiança alta sem aprovação | Não confirmar automaticamente |
| R09 | Evidência inválida/ausente | Rejeitar |
| R10 | Divergência sem permissão específica | Rejeitar |
| R11 | Rejeitar sugestão com motivo | Preservar decisão e links |
| R12 | Conciliar título sem liquidação | Não marcar título como liquidado |
| R13 | Movimento parcialmente consumido | Status parcial |
| R14 | Movimento totalmente consumido | Status conciliado |
| R15 | Liberar alocação sem reversão | Rejeitar |
| R16 | Liberar valor superior ao consumido | Rejeitar |

### 5.4 Política, autorização, tenant e tempo

| ID | Cenário | Resultado esperado |
|---|---|---|
| G01 | Configuração com dependência inválida | Rejeitar submissão |
| G02 | Submeter configuração | Snapshot imutável |
| G03 | Criador aprova própria configuração | Rejeitar no MVP |
| G04 | Aprovador distinto autorizado | Aceitar |
| G05 | Ativar intervalo sobreposto | Rejeitar |
| G06 | Comando em instante dentro/fora da vigência | Selecionar versão correta ou bloquear |
| G07 | Habilitar crédito/adiantamento no MVP | Rejeitar |
| G08 | Conceder permissão acima da própria alçada | Rejeitar |
| G09 | Conceder a usuário sem membership | Rejeitar |
| G10 | Revogar autorização | Preservar histórico e bloquear novos comandos |
| G11 | Remover membership após grant | Bloquear comando |
| G12 | Cliente envia actor_id arbitrário | Ignorar/rejeitar; usar sessão |
| G13 | Tenant A consulta/altera tenant B | Sem leitura/escrita cross-tenant |
| G14 | FK cruza organizações | Constraint/RLS rejeita |
| G15 | DATE com timezone de navegador diferente | Preservar dia civil |
| G16 | TIMESTAMPTZ convertido para timezone organizacional | Exibição correta |
| G17 | Alterar timezone | Não reescrever histórico |
| G18 | Intervalos adjacentes [from, until) | Permitir sem sobreposição |
| G19 | Ativações concorrentes | Uma sequência válida |
| G20 | Auditoria de grant/revoke/política | Ator, motivo e vigência registrados |

### 5.5 Falhas e concorrência

| ID | Cenário | Resultado esperado |
|---|---|---|
| X01 | Duas confirmações simultâneas do mesmo título | Uma transição; outra replay/conflito |
| X02 | Duas liquidações consomem mesmo saldo | Sem sobre-alocação |
| X03 | Retry após timeout com mesma chave | Uma única operação |
| X04 | Mesma chave, payload diferente | Conflito explícito |
| X05 | Deadlock/lock timeout | Rollback integral |
| X06 | Falha entre domínio e auditoria | Rollback integral |
| X07 | Falha de projeção | Sem sucesso parcial; reconstrução determinística |
| X08 | Ordem de IDs distinta | Ordem de lock padronizada |
| X09 | Alocações bancárias simultâneas | Saldo nunca negativo |
| X10 | Reimportação após resposta perdida | Sem duplicar |
| X11 | Apagar evento confirmado | Bloqueado |
| X12 | Falha em integração externa | Transação local encerrada; job repetível |

---

## 6. Isolamento obrigatório entre organizações

Executar com organizações A e B, cada uma com usuários, contrapartes, títulos, movimentos, liquidações, políticas e grants próprios.

1. Usuário A não lista nem consulta recursos de B por ID.
2. Não criar alocação entre liquidação de A e título de B.
3. Não alocar movimento de B a liquidação de A.
4. FK composta impede associação cross-tenant mesmo em chamada direta ao banco.
5. RLS impede leitura/escrita não autorizada em cada tabela nova.
6. API/Server Action rejeita organization_id incompatível com o contexto autenticado.
7. Usuário removido perde acesso mesmo que grant não tenha expirado.
8. Auditoria não vaza metadados do outro tenant.
9. Chaves idempotentes iguais em A e B não colidem.
10. Exportações e relatórios não misturam dados.

Nenhum cenário cross-tenant pode ser substituído apenas por teste manual antes do MVP.

---

## 7. Sequência de implementação recomendada

Somente após aprovação formal desta especificação e revisão dos documentos anteriores:

1. Domínio puro: cálculos em centavos, invariantes, ajustes e transições; unit tests.
2. Autorização server-side: membership, grants, escopo, vigência, delegação e maker-checker.
3. Persistência: migrations revisadas, constraints tenant-scoped, RLS/grants, idempotência e auditoria.
4. Títulos/parcelas: criação, confirmação, cancelamento e saldo derivado.
5. Liquidações: rascunho, alocação, confirmação atômica e reversão.
6. Ledger bancário: split, saldo disponível, reversão e status parcial.
7. Conciliação: sugestão, confirmação/rejeição e divergências.
8. Política: versionamento, aprovação, vigência e delegação.
9. E2E multi-tenant, concorrência, falhas e replay.
10. Homologação com fixtures e dados autorizados anonimizados, evidências reproduzíveis e aceite financeiro.

### 7.1 Gates de saída

- [ ] Contratos dos comandos revisados por produto, negócio e engenharia.
- [ ] Fórmulas e fixtures aprovadas pelo responsável financeiro.
- [ ] Matriz de permissões e maker-checker aprovada pela diretoria.
- [ ] Locks e idempotência revisados.
- [ ] Cenários críticos automatizados ou exceções justificadas.
- [ ] Testes de dois tenants aprovados.
- [ ] Concorrência, rollback e replay aprovados.
- [ ] Auditoria e reconstrução de estados verificadas.
- [ ] Nenhuma migration/alteração remota sem autorização específica.
- [ ] Critérios de homologação e evidências definidos.

---

## 8. Decisões não tomadas / limites

Este documento não decide: unidade final de importação Omie (título ou parcela); fórmulas legais/contratuais de juros, multa e retenções; tolerâncias residuais e alçadas monetárias; obrigatoriedade de conta por meio de pagamento; estratégia física final de estados de rascunho/idempotência; nomes e transporte de APIs/RPCs/outbox.

Crédito/adiantamento, liquidação sem alocação, retenções, multi-moeda e write-back ERP permanecem fora do MVP. Qualquer dependência deve ser objeto de decisão explícita antes da implementação.

## 9. Relação com F01.1–F01.3

- F01.1 define entidades, estados e fronteiras de domínio.
- F01.2 define relações lógicas, chaves, constraints, RLS e decisões de dados.
- F01.3 define estruturas PostgreSQL propostas, integridade física, locks e auditoria.
- F01.4 converte essas definições em contratos transacionais e testes verificáveis.

A conclusão desta etapa significa apenas que existe uma especificação revisável. Não comprova implementação, integração ou homologação.
