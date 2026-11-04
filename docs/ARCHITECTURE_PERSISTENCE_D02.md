# RSBUILD Finance — Arquitetura de Persistência D02

**Versão:** 0.2.0  
**Status:** D02 implantada em projeto dedicado; homologação funcional pendente.

## Decisões
- Custódia managed: PostgreSQL e Storage, com isolamento lógico por organização.
- Projeto Supabase dedicado: `rsbuild-finance-app`, região `us-east-2` (Ohio).
- Uma organização lógica por empresa cliente; vínculo de usuários por `organization_memberships`.
- PostgreSQL é a fonte de verdade; o navegador não é persistência primária.
- Arquivos originais em bucket privado, caminho tenant-scoped, hash SHA-256 e metadados no banco.
- Valores monetários em unidades menores inteiras (`amount_minor`), nunca ponto flutuante.
- Autorização deriva de memberships no banco, não de metadados editáveis do perfil.
- Provisionamento de organização e membership inicial é administrativo e confiável.
- Integrações ERP começam somente leitura/dry-run; escrita exige autorização e escopo próprios.
- UEAP é consumido por gateway contratual; seu núcleo privado não é copiado para este repositório.
- Atestação comprova apenas as propriedades declaradas no protocolo; não significa verdade contábil, aprovação de ERP ou conciliação.

## Modelo lógico
| Domínio | Tabelas | Responsabilidade |
|---|---|---|
| Identidade e tenant | organizations, organization_memberships | Empresa e vínculo de usuários |
| Fontes | financial_accounts, data_sources | Contas e origem dos dados |
| Ingestão | import_batches, source_artifacts | Lote, arquivo original e integridade |
| Financeiro | financial_records | Movimentações persistidas |
| Qualidade | validation_runs | Execuções de validação |
| Evidências | evidence_records | Relação entre artefatos e registros |
| Atestação | attestations | Estado e referências do gateway UEAP |
| ERP | integration_runs, integration_records | Execuções e correspondências |
| Governança | audit_events | Eventos de auditoria por organização |

## Fluxo de importação
`upload → import_batch → source_artifact → parse → validation_run → financial_records → evidence_record → optional UEAP attestation`

O commit do lote deve ser transacional e idempotente. A chave de deduplicação é escopada pela organização. A interface deve distinguir prévia, validação, rejeição e persistência confirmada.

## Limites de confiança
1. Autenticação pelo RSBUILD com Supabase Auth.
2. RLS habilitada nas 13 tabelas do schema public.
3. Organizações e memberships iniciais provisionados por serviço administrativo.
4. Arquivos brutos permanecem privados; hashes não substituem validação de conteúdo.
5. Gateway UEAP recebe apenas projeções mínimas necessárias, sem arquivos financeiros brutos por padrão.
6. Chaves privilegiadas nunca são enviadas ao browser.

## Estado de implantação — 2026-11-04
- Projeto dedicado ativo em `us-east-2`; nenhum projeto 3L0 foi reutilizado.
- 13 tabelas implantadas com RLS habilitada.
- Bucket `rsbuild-source-artifacts` criado como privado, limite 10 MiB.
- Migration de hardening revogou execução RPC de `public.rls_auto_enable()` para PUBLIC, anon e authenticated; event trigger permanece habilitado.
- Migration complementar separou políticas de escrita por comando e adicionou índices de FK.
- Security Advisor: zero findings no último resultado consultado.
- Performance Advisor: um finding de FK sem índice foi corrigido com índice composto. Índices não utilizados permanecem como observações esperadas antes de existir workload.
- Tipos TypeScript foram gerados a partir do schema remoto.

## Pendências antes da homologação
- Configurar Auth, URLs de callback e SMTP.
- Implementar provisionamento administrativo de tenants/memberships.
- Implementar cliente SSR e camada de repositórios.
- Executar testes de isolamento com dois tenants e validar Storage com usuários autenticados.
- Sincronizar o histórico de migrations versionado com as migrations remotas.
- Executar novamente os Advisors e registrar evidências de homologação.
