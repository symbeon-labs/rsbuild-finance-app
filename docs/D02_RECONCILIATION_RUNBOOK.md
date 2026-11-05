# D02 — Runbook de reconciliação compensatória

**Status:** procedimento operacional manual; não executar exclusões automáticas sem revisão.

## 1. Princípio

Upload no Supabase Storage e commit no PostgreSQL são operações separadas. Se a RPC falhar, a API tenta remover o objeto recém-enviado. Se a remoção falhar, o log `rsbuild_import_artifact_cleanup_failed` inclui organização, path, hash e código do erro. A resposta informa `cleanupPending: true`.

O provisionamento administrativo também usa compensação multi-etapas. Falhas são registradas como `rsbuild_tenant_provision_compensation_failed`, com organização, user ID, etapa e mensagem técnica. O log não inclui e-mail, token, identificador fiscal ou dados financeiros. Uma falha não deve ser considerada resolvida apenas porque a API retornou erro.

## 2. Artefatos Storage sem referência no banco

Executar em ambiente administrativo read-only para localizar candidatos:

```sql
select
  o.bucket_id,
  o.name as storage_path,
  o.created_at,
  o.metadata
from storage.objects o
left join public.source_artifacts a
  on a.storage_bucket = o.bucket_id
 and a.storage_path = o.name
where o.bucket_id = 'rsbuild-source-artifacts'
  and a.id is null
  and o.created_at < now() - interval '30 minutes'
order by o.created_at asc;
```

### Revisão obrigatória antes de remover

1. Confirmar que o path começa com o UUID da organização.
2. Confirmar que não existe linha correspondente em `source_artifacts`, `import_batches` ou referência de evidência.
3. Consultar logs da aplicação pelo evento de compensação e hash.
4. Verificar se o upload ainda está em andamento ou se há retry legítimo.
5. Registrar decisão e responsável em evidência operacional.
6. Somente então remover o objeto pelo Storage API com credencial administrativa apropriada; nunca apagar diretamente linhas de `storage.objects`.

Não usar uma limpeza em massa baseada apenas em idade. O período de 30 minutos é uma janela de triagem, não uma autorização de exclusão.

## 3. Provisionamento de tenant incompleto

Para cada evento `rsbuild_tenant_provision_compensation_failed`:

1. Consultar a organização pelo `organizationId`.
2. Consultar memberships associadas à organização.
3. Consultar Auth pelo `userId`, quando informado.
4. Identificar quais etapas de compensação falharam: membership, Auth user ou organização.
5. Preservar contas preexistentes. Nunca excluir usuário Auth preexistente como parte de rollback.
6. Corrigir somente os vínculos/recursos criados pela operação em falha.
7. Confirmar consistência entre organization, membership, Auth e audit_events.
8. Registrar a resolução e o operador responsável.

## 4. Evidências e métricas

Manter registro de:
- evento/correlation context;
- organization ID;
- storage path + SHA-256, quando aplicável;
- etapa que falhou;
- timestamp e código de erro;
- decisão de manter/remover/reparar;
- responsável e evidência de verificação.

Não registrar conteúdo de extratos, credenciais, tokens, e-mails completos ou identificadores fiscais nos logs de aplicação.

## 5. Limites

Este runbook reduz o risco de órfãos silenciosos, mas ainda não implementa uma fila durável nem um reconciliador automático. A operação continua pendente de monitoramento e execução manual. Uma futura automação exige ledger de compensação persistente, idempotência, retenção, alertas e testes de segurança próprios.
