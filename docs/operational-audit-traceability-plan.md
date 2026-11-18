# Plano de Rastreabilidade Operacional — RSBUILD Finance

**Atualizado:** 18/11/2026  
**Marco de implementação:** PR #81 — merged em 18/11/2026  
**Commit de merge:** `59f5aaa0ddf9eaf5ac49e5d7de5825489310b91e`  
**Escopo inicial:** trilha de auditoria e operações financeiras do workspace QA.  
**Estado geral:** fundação implementada parcialmente; homologação técnica e rollout ainda pendentes.

## 1. Objetivo

Permitir reconstruir, com evidências proporcionais à operação, a sequência de ações relevantes sobre registros financeiros: origem, responsável ou processo executor, momento, entidade afetada, resultado, justificativa e vínculos com registros relacionados.

A iniciativa evolui a infraestrutura existente de `audit_events`. Não cria uma segunda trilha e não confunde auditoria operacional com avaliações do roteiro QA.

## 2. Baseline arquitetural

### 2.1 Escrita de eventos

Arquivo de referência: `lib/api/audit.ts`.

O contrato existente `AuditEventInput` contém organização, ator opcional, tipo de evento, tipo/ID de entidade e metadata. O helper utiliza service role e captura/loga erros sem propagá-los ao fluxo chamador.

**Implicação:** a escrita existente é best-effort. A nova captura transacional introduzida pela PR #81 tem comportamento diferente: quando o trigger falha, a transação da alteração que o disparou também falha. A política definitiva deve ser classificada por criticidade, sem tornar toda auditoria indiscriminadamente bloqueante.

### 2.2 Consulta anterior à PR #81

A implementação anterior exigia contexto da organização, filtrava por `organization_id`, ordenava por `occurred_at` e limitava a consulta aos 300 eventos mais recentes, sem paginação.

### 2.3 Integridade e linguagem da interface

A alegação de “registro imutável” não deve ser usada como garantia global até que schema, grants, RLS e caminhos de alteração/exclusão sejam verificados. Captura transacional e trilha de auditoria, isoladamente, não provam imutabilidade global nem completude histórica.

## 3. Entrega da PR #81

A PR #81, intitulada **feat(audit): transições operacionais e histórico paginado**, foi merged em 18/11/2026. Ela entregou partes de D03 e D04; não representa a conclusão de D01.

Arquivos alterados:
- `supabase/migrations/20261118000002_operational_audit_state_transitions.sql`
- `supabase/tests/operational_audit_state_transitions.test.sql`
- `app/api/audit-events/route.ts`
- `app/components/admin/audit-trail-view.tsx`
- este documento de planejamento.

### 3.1 Capacidades implementadas na PR

- Trigger transacional para atualizações em movimentações financeiras, títulos, canhotos, pedidos e baixas.
- Evento individual para cada decisão de conciliação, com ID próprio e referência à movimentação financeira.
- Deltas mínimos de estado anterior/posterior, limitados a uma allowlist de campos operacionais.
- Metadata sem snapshots integrais, documentos pessoais, mensagens brutas, URLs de comprovantes ou payloads completos.
- Consulta com paginação por cursor composto (`occurred_at`, `id`), limite de 1 a 100 e filtro obrigatório por organização.
- Interface capaz de carregar eventos anteriores e apresentar transições.
- Teste pgTAP para eventos, ator, estados anterior/posterior e vínculo da decisão.

### 3.2 Limites conhecidos da entrega

- A migration é aditiva e, no momento da PR, ainda não havia sido aplicada a banco remoto.
- Eventos anteriores à migration não recebem histórico retroativo.
- Criações em lote continuam com eventos agregados; a correlação individual de cada item importado permanece pendente.
- A PR não alterou dados financeiros, workspace oficial, Sandbox, memberships, RBAC, RLS ou regras de contabilização.
- Não foi declarada nem comprovada imutabilidade global ou cobertura completa da auditoria.
- O Preview da Vercel não é gate técnico enquanto houver bloqueio de quota do provedor.

### 3.3 Validação pendente

Na revisão da PR foi reportada falha no Database Tests #243 em `operational_audit_state_transitions.test.sql`, com `permission denied for table financial_records`, antes da execução das assertions. A orientação registrada foi corrigir o fixture para realizar a transição positiva com um ator/caminho autorizado pelas policies existentes, sem ampliar grants de produção, e manter um caso negativo demonstrando que o papel sem autorização continua bloqueado.

Até que os testes sejam executados com sucesso, D03 e D04 devem ser tratados como **implementados parcialmente, ainda não homologados**. A migration também precisa ser aplicada e validada no ambiente QA autorizado antes de qualquer conclusão de rollout.

## 4. Roadmap e estado real

A sequência abaixo é a referência normativa. Uma PR pode entregar componentes de mais de uma etapa; isso não altera a ordem lógica nem permite marcar uma etapa como concluída sem seus critérios de aceite.

### D01 — Inventário e contrato

Mapear rotas, funções de domínio, eventos emitidos, entidades, atores e contratos atuais. Confirmar schema e políticas existentes.

**Estado:** baseline inicial documentado; inventário sistemático e contrato ponta a ponta ainda precisam ser concluídos.

### D02 — Cobertura e correlação entre entidades

Conectar pedido, título, recebimento, canhoto, importação e conciliação por referências identificáveis. Completar eventos ausentes e vínculos entre registros de origem e derivados. Evitar duplicidade e eventos sem referência.

**Estado:** pendente. A correlação individual de registros criados por importações em lote é uma lacuna explicitamente conhecida.

### D03 — Transições e confiabilidade

Registrar estado anterior e posterior nas transições relevantes, com deltas mínimos e política de falha por criticidade. Testar sucesso, falha de gravação e identidade do ator.

**Estado:** implementação inicial entregue pela PR #81; homologação pendente. A política de falha por criticidade ainda precisa ser formalizada e testada.

### D04 — Consulta e evidências

Permitir localizar um registro e reconstruir sua sequência de acontecimentos, com filtros e paginação. A consulta deve preservar escopo organizacional e autorização no servidor; a interface deve apresentar a trajetória e os vínculos relevantes sem sugerir evidências inexistentes.

**Estado:** paginação por cursor e carregamento progressivo implementados pela PR #81; experiência completa de consulta por entidade, filtros necessários e reconstrução da cadeia entre entidades dependem de D02 e de validação funcional.

### D05 — Verificação

Testar isolamento entre organizações, permissões, falhas de registro, consistência temporal e integridade dos eventos. Verificar também cobertura, ordenação, comportamento sob falhas e ausência de exposição indevida de metadata.

**Estado:** pendente. A falha reportada no teste pgTAP precisa ser resolvida e a suíte completa deve passar antes da homologação.

## 5. Critérios de aceite globais

- Ações sensíveis mapeadas têm evento ou justificativa documentada.
- Pedido, título, recebimento, canhoto, importação e conciliação são correlacionáveis por IDs/referências estáveis, sem inferências.
- Transições relevantes identificam estado anterior e posterior sem inventar dados ausentes.
- Ator e origem da ação são explicitamente identificados quando disponíveis; ausência não deve ser mascarada por inferência.
- Política de falha está definida e testada por criticidade.
- Consulta paginada preserva escopo da organização e autorização no servidor.
- É possível localizar um registro e reconstruir sua sequência de eventos e relações.
- Testes demonstram isolamento entre organizações e bloqueio de operações não autorizadas.
- Consistência temporal, integridade e comportamento sob falhas são verificados.
- Metadata não armazena segredos, documentos pessoais desnecessários ou payloads excessivos.
- Alegações de imutabilidade, completude ou cobertura integral só aparecem após comprovação técnica específica.

## 6. Próxima sequência de trabalho

1. **Fechar D01:** completar o inventário de operações, entidades, atores e eventos.
2. **Executar D02:** estabelecer referências identificáveis entre pedido, título, recebimento, canhoto, importação e conciliação, priorizando a correlação individual dos itens importados.
3. **Homologar D03:** corrigir o fixture do pgTAP sem ampliar permissões de produção; formalizar e testar a política de falha dos eventos.
4. **Completar D04:** validar consulta por registro e reconstrução da trajetória com filtros e paginação.
5. **Executar D05:** validar isolamento multi-tenant, permissões, falhas, ordenação, integridade e consistência temporal.

## 7. Limites de rollout

- Desenvolvimento em branch isolada.
- Homologação inicial em QA com dados sintéticos ou controlados.
- Nenhuma alteração no workspace oficial ou Sandbox nesta etapa.
- Nenhum deploy de produção automático decorrente deste plano.
- Mudanças em regras financeiras ficam fora do escopo, salvo dependência técnica comprovada e aprovada.
- Aplicação de migration em ambiente remoto exige confirmação do ambiente-alvo e validação prévia.
