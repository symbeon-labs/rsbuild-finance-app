# Plano de Implementação — RSBUILD Finance

**Versão:** 0.4  
**Status:** D02 implantada no Supabase dedicado; integração da aplicação e homologação pendentes.

## Objetivo
Evoluir a aplicação de uma sessão de importação transitória para uma plataforma multiempresa com persistência, rastreabilidade e integrações controladas.

## Estado identificado
- Next.js App Router e interface responsiva.
- Importação e pré-visualização CSV/OFX no cliente.
- Persistência gerenciada D02 implantada no Supabase em `us-east-2`.
- Histórico de migrations remoto sincronizado com a sequência versionada.
- Hardening de atribuição de ator, estado inicial e referências tenant-scoped aplicado.
- Autenticação SSR, provisionamento, repositórios e importação persistida ainda pendentes.
- ERP e contas de origem dependem de confirmação de escopo e acesso.

## D02 — Persistência gerenciada
- 13 tabelas de domínio implantadas com RLS.
- Isolamento lógico baseado em `organization_memberships`.
- Bucket privado para artefatos de origem, com paths tenant-scoped.
- Valores monetários em unidades menores inteiras.
- UEAP integrado apenas por contrato de gateway.
- Provisionamento de tenant e membership inicial reservado a fluxo administrativo confiável.

## Próximas etapas
1. Aguardar e corrigir eventuais falhas dos workflows CI e Database tests (pgTAP).
2. Configurar Supabase Auth, URLs de callback e SMTP.
3. Implementar fluxo administrativo para criar organização e membership inicial.
4. Implementar cliente Supabase SSR e repositórios server-side.
5. Persistir importações com idempotência, transação e upload privado.
6. Testar dois tenants independentes, incluindo negação cruzada no banco e Storage.
7. Integrar UEAP por contrato versionado e fluxo assíncrono.
8. D03: indicadores consultados do banco, filtros reais e precisão financeira.
9. D04: gestão financeira.
10. D05: adaptadores ERP somente leitura/dry-run; escrita exige autorização separada.
11. D06: conciliação assistida e revisão humana.
12. D07: expansão adaptativa.

## Regras
- Não usar dados reais em fixtures ou no repositório.
- Não declarar recursos disponíveis antes da homologação.
- Não realizar escrita em ERP sem autorização específica.
- UEAP atesta claims delimitados e relações criptográficas; não declara verdade financeira.
- Cada etapa deve possuir testes automatizados, evidências e critérios de aceite.

## Critério de conclusão D02
Dados persistem entre sessões; usuários de empresas diferentes não acessam dados entre si; importações são idempotentes; arquivos originais permanecem privados; nenhum segredo privilegiado chega ao browser.
