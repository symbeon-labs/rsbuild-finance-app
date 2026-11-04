# Plano de Implementação — RSBUILD Finance

**Versão:** 0.2  
**Status:** D02 em implementação; provisionamento remoto pendente.

## Objetivo
Evoluir a aplicação de uma sessão de importação transitória para uma plataforma multiempresa com persistência, rastreabilidade e integrações controladas.

## Estado identificado
- Next.js App Router e interface responsiva.
- Importação e pré-visualização CSV/OFX no cliente.
- Registros ainda transitórios; sem autenticação, banco ou isolamento por empresa.
- ERP e contas de origem ainda dependem de confirmação de escopo e acesso.

## D02 — Persistência gerenciada e isolamento por empresa
Decisão aprovada: Supabase managed, PostgreSQL + Storage privado, multi-tenancy lógico com RLS e UEAP Gateway contratual.

Entregas versionadas nesta fase:
- Schema para organizações, memberships, contas, fontes, lotes, artefatos, movimentos, validações, evidências, atestações, execuções de integração e auditoria.
- RLS por membership e papéis owner/admin/operator/viewer.
- Arquivos privados com path tenant-scoped e hash.
- Valores monetários em unidades menores inteiras.
- Contrato externo UEAP sem incorporar o núcleo privado.
- Provisionamento de tenant e associação de usuário em fluxo administrativo confiável.

Aceite:
- Dados persistem entre sessões.
- Usuários de empresas diferentes não leem nem alteram dados entre si.
- Operações de importação são idempotentes e rastreáveis.
- Arquivos originais são privados e verificáveis.
- Nenhum segredo privilegiado é enviado ao browser.

## Dependências antes da homologação
- Criar organização Supabase dedicada para RSBUILD, separada de 3L0.
- Provisionar projeto dedicado na região sa-east-1 após confirmação de custo.
- Aplicar migration e configurar Auth/Storage.
- Gerar tipos a partir do banco implantado.
- Implementar cliente SSR e rotas autenticadas.
- Testar isolamento com dois tenants independentes e executar Advisors.

## Próximas etapas
- D01: consolidar fixtures anonimizadas, validação de CSV/OFX e deduplicação antes de persistir lote.
- D02.1: provisionamento cloud, Auth e memberships.
- D02.2: camada de repositório e importação persistida.
- D02.3: testes RLS cross-tenant e Storage.
- D03: indicadores consultados do banco, filtros reais e precisão financeira.
- D04: gestão financeira.
- D05: adaptadores ERP e fontes somente leitura; ERP de destino ainda não definido.
- D06: conciliação assistida e revisão humana.
- D07: expansão adaptativa.

## Regras
- Não usar dados reais em fixtures ou no repositório.
- Não declarar recursos como disponíveis antes de homologação.
- Não escrever em ERP sem autorização específica.
- UEAP Gateway registra proveniência e integridade; não declara verdade financeira.
