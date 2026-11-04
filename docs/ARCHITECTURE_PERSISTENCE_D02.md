# RSBUILD Finance — Arquitetura de Persistência D02

**Versão:** 0.1.0  
**Status:** Baseline aprovada; implantação condicionada ao provisionamento do projeto Supabase dedicado.

## Decisões

- Custódia managed: PostgreSQL e Storage gerenciados, com isolamento lógico por organização.
- Multi-tenancy: uma organização RSBUILD por empresa cliente; membros vinculados explicitamente por `organization_memberships`.
- Fonte de verdade: PostgreSQL. O navegador não é o repositório primário dos registros.
- Arquivos originais: bucket privado, caminho iniciado pelo UUID da organização, hash SHA-256 e metadados no banco.
- Valores: `amount_minor` em unidades monetárias menores (centavos para BRL), nunca ponto flutuante.
- Acesso: Supabase Auth + RLS; papéis owner, admin, operator e viewer. Provisionamento de organizações e memberships permanece sob fluxo administrativo confiável.
- Integrações: adaptadores por contrato; modo inicial somente leitura. Escrita em ERP exige autorização e escopo próprios.
- UEAP: gateway contratual. RSBUILD registra referência, versão de contrato, hash do evento, estado e referências de retorno. Não incorpora implementação privada do protocolo.
- Evidência e atestação não equivalem a verdade contábil, aprovação de ERP ou conciliação.

## Modelo lógico

| Domínio | Tabelas | Responsabilidade |
|---|---|---|
| Identidade e tenant | organizations, organization_memberships | Empresa e vínculo de usuários |
| Fontes | financial_accounts, data_sources | Contas e origem dos dados |
| Ingestão | import_batches, source_artifacts | Lote, arquivo original e integridade |
| Financeiro | financial_records | Movimentações persistidas |
| Qualidade | validation_runs | Execuções e resultados de validação |
| Evidências | evidence_records | Relação entre artefatos e registros |
| Atestação | attestations | Estado e referência de atestação via gateway UEAP |
| ERP | integration_runs, integration_records | Execuções e correspondências por adaptador |
| Governança | audit_events | Eventos de auditoria por organização |

## Limites de confiança

1. O cliente autentica no RSBUILD, não no painel Supabase.
2. A autorização de tenant deriva de memberships armazenados no banco; claims editáveis de perfil não são fonte de autorização.
3. Toda tabela exposta no schema public possui RLS habilitada.
4. Organização e associação inicial de membros são provisionadas por serviço administrativo, não por autoatribuição no cliente.
5. O arquivo bruto permanece em Storage privado; hashes e metadados permitem verificação de integridade sem publicar documentos.
6. O gateway UEAP recebe somente projeções selecionadas e necessárias, nunca credenciais ou conteúdo financeiro bruto por padrão.

## Fluxo de importação

`upload → import_batch → source_artifact → parse → validation_run → financial_records → evidence_record → optional UEAP attestation`

O commit do lote deve ser transacional e idempotente. A chave de deduplicação é escopada pela organização. A UI deve distinguir prévia, validação, rejeição e persistência confirmada.

## Provisionamento e operação

- Criar organização Supabase separada para a plataforma RSBUILD; não reutilizar a organização Supabase 3L0 nem projetos existentes.
- Criar projeto dedicado na região `sa-east-1`, após confirmação de custo e disponibilidade da nova organização.
- Aplicar a migration deste diretório apenas nesse projeto.
- Configurar Auth, URLs de callback, limites de upload e SMTP antes de convidar usuários.
- Guardar `SUPABASE_URL` e publishable key em variáveis apropriadas; nunca expor service-role/secret key no cliente.
- Gerar tipos TypeScript a partir do schema aplicado.
- Testar dois tenants com usuários distintos e verificar negação cruzada de leitura e escrita.
- Executar Supabase Security e Performance Advisors antes de homologação.

## Estado desta entrega

Esta migration e o contrato descrevem a estrutura versionada. O projeto Supabase dedicado ainda precisa ser provisionado. Nenhum dado real de cliente deve ser carregado antes da homologação de RLS, Storage e processo de importação.
