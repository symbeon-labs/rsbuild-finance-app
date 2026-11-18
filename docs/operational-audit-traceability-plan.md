# Plano de Rastreabilidade Operacional — RSBUILD Finance

**Status:** D01 implementado em branch; validação automatizada pendente  
**Branch:** `feat/operational-audit-traceability`  
**Base:** `main`  
**Escopo inicial:** trilha de auditoria e operações financeiras do workspace QA.

## 1. Objetivo

Permitir reconstruir, com evidências proporcionais à operação, a sequência de ações relevantes sobre registros financeiros: origem, responsável ou processo executor, momento, entidade afetada, resultado, justificativa e vínculos com registros relacionados.

A iniciativa evolui a infraestrutura existente de `audit_events`. Não cria uma segunda trilha e não confunde auditoria operacional com avaliações do roteiro QA.

## 2. Baseline confirmado em main

### 2.1 Escrita de eventos

Arquivo: `lib/api/audit.ts`

O contrato atual `AuditEventInput` contém:
- `organizationId`
- `actorId` e `actorEmail` opcionais
- `eventType`
- `entityType`
- `entityId` opcional
- `metadata` opcional

O helper escreve em `audit_events` usando service role. Erros são capturados e logados, sem serem propagados ao fluxo chamador.

**Implicação:** a trilha é atualmente best-effort. Uma operação pode continuar mesmo quando a escrita do evento falha. A política adequada precisa ser definida por criticidade; não se deve tornar toda auditoria bloqueante indiscriminadamente.

### 2.2 Consulta

Arquivo: `app/api/audit-events/route.ts`

- Exige contexto da organização por `requireOrgContext`.
- Filtra por `organization_id`.
- Ordena por `occurred_at` decrescente.
- Limita a resposta aos 300 eventos mais recentes.
- Retorna ator, ação, entidade, horário e metadata.

**Implicação:** a consulta é tenant-scoped, mas não oferece paginação; o limite de 300 impede afirmar que a interface apresenta o histórico completo.

### 2.3 Apresentação

Arquivo: `app/components/admin/audit-trail-view.tsx`

A interface apresenta data/hora, usuário, ação, entidade e resumo de metadata. Há filtros por tipo de evento e busca textual por e-mail, ação e ID da entidade.

O texto atual da interface afirma “Registro imutável de ações, alterações e tentativas de acesso negadas”. A imutabilidade ainda precisa ser demonstrada por schema, grants, RLS e ausência de caminhos de update/delete. Até essa verificação, essa afirmação deve ser considerada não comprovada.

## 3. Lacunas a investigar

1. **Cobertura:** mapear cada operação sensível e localizar o evento emitido no caminho de sucesso, falha e negação.
2. **Correlação:** garantir referências estáveis entre importações e registros derivados, títulos, pedidos, canhotos, baixas e decisões de conciliação.
3. **Transições:** registrar estado anterior e posterior quando a operação alterar status ou produzir decisão relevante.
4. **Identidade:** distinguir usuário humano, processo automatizado e ação de sistema; não inferir ator quando ausente.
5. **Falha de auditoria:** classificar eventos obrigatórios e best-effort, com política explícita por criticidade.
6. **Consulta:** substituir limite fixo por paginação cursor-based ou mecanismo equivalente, mantendo filtros no servidor.
7. **Integridade e isolamento:** verificar constraints, grants, RLS, acesso via service role e testes cross-tenant.
8. **Privacidade:** restringir metadata a dados necessários; não armazenar tokens, segredos, payloads completos ou dados pessoais excessivos.

## 4. Contrato-alvo de evento

Campos conceituais (não representam migração aprovada):
- identidade do evento e timestamp gerado no servidor;
- organização proprietária;
- ator tipado: usuário, serviço ou sistema;
- ação/event type versionado;
- entidade e ID estável;
- correlation ID e causation/reference IDs quando aplicáveis;
- resultado: sucesso, falha, negado ou parcial;
- justificativa/motivo quando necessário;
- delta mínimo de estado anterior/novo, apenas para transições relevantes;
- metadata validada por allowlist e sem dados sensíveis desnecessários.

Não registrar snapshots integrais de entidades como substituto de histórico. Preservar a fonte de verdade nos registros operacionais e usar eventos para explicar ações e transições.

## 5. Implementação inicial registrada

### D01 — Transições operacionais e consulta paginada

Branch `feat/operational-audit-traceability`.

- Migration `20261118000002_operational_audit_state_transitions.sql` adiciona captura no banco para atualizações em movimentações financeiras, títulos, canhotos, pedidos e baixas.
- A trilha registra evento por entidade, ator quando disponível, campos alterados e deltas mínimos `before`/`after` para uma allowlist de campos operacionais.
- A migration também registra cada decisão de conciliação com seu próprio ID e referência à movimentação financeira.
- Os eventos são gravados na mesma transação da alteração que disparou o trigger; se a gravação falhar, a alteração também falha.
- Metadata não inclui snapshots integrais nem documentos pessoais, mensagens brutas, URLs de comprovantes ou payloads completos.
- `GET /api/audit-events` passa a usar paginação por cursor composto (`occurred_at`, `id`), com limite configurável de 1 a 100 e escopo obrigatório por organização.
- A interface de auditoria passa a carregar eventos anteriores e apresentar transições permitidas.
- Teste pgTAP cobre evento por entidade, estado anterior/posterior, ator e vínculo da decisão.

**Limites desta entrega:** eventos históricos anteriores à migration não ganham deltas retroativamente. Criações em lote continuam com os eventos agregados existentes; a correlação individual de cada item importado permanece como próxima lacuna. A imutabilidade global da tabela ainda não está declarada nem comprovada.

## 6. Sequência de implementação

### D01 — Inventário e contrato
Mapear rotas, funções de domínio, eventos emitidos e entidades. Confirmar schema e políticas atuais.

### D02 — Cobertura e correlação
Completar eventos ausentes e vínculos entre registros de origem e derivados. Evitar duplicidade e eventos sem referência.

### D03 — Transições e confiabilidade
Adicionar deltas mínimos e política de falha por criticidade, com testes de falha de escrita.

### D04 — Consulta e experiência
Implementar paginação, filtros úteis e visualização de detalhes/histórico por entidade.

### D05 — Verificação
Testar isolamento multi-tenant, autorização, integridade, cobertura, ordenação e comportamento sob falhas.

## 7. Critérios de aceite

- Todas as ações sensíveis mapeadas têm evento ou justificativa documentada.
- Eventos são correlacionáveis a entidades reais por IDs estáveis.
- Transições relevantes permitem identificar estado anterior e posterior sem inventar dados ausentes.
- Ator e origem da ação são explicitamente tipados.
- Política de falha está definida e testada por criticidade.
- Consulta paginada preserva escopo da organização e autorização no servidor.
- Nenhum segredo ou payload excessivo é armazenado em metadata.
- Testes demonstram isolamento entre organizações.
- Alegações de imutabilidade e completude só aparecem após comprovação técnica.

## 8. Limites de rollout

- Desenvolvimento em branch isolada.
- Homologação inicial em QA com dados sintéticos ou controlados.
- Nenhuma alteração no workspace oficial ou Sandbox nesta etapa.
- Sem merge ou deploy de produção automático.
- Mudanças em regras financeiras ficam fora do escopo, salvo dependência técnica comprovada e aprovada.
