# Plano de Implementação — RSBUILD Finance

**Versão:** 0.6  
**Status:** D02 integrada na candidata #21 sobre a main atual; CI e pgTAP aprovados no HEAD registrado, homologação remota, validação operacional e aceite comercial permanecem pendentes.

## Objetivo
Evoluir a aplicação de uma sessão de importação transitória para uma plataforma multiempresa com persistência, rastreabilidade e integrações controladas.

## Estado identificado
- Next.js App Router e interface responsiva.
- Importação CSV/OFX com parsing autoritativo no servidor a partir do arquivo original.
- Base D02 de persistência gerenciada e migrations versionadas; CI e pgTAP aprovados na candidata #21. Confirmar histórico remoto antes de declarar cada migration aplicada.
- Auth SSR implementado com cookies, login, callback PKCE e logout.
- Provisionamento administrativo por fluxo protegido; homologação com convite real permanece pendente.
- Endpoints tenant-scoped para provisionamento, organizações, leitura paginada e importações.
- Upload privado e RPC transacional/idempotente para persistência de importações, com hash SHA-256, versão do parser e proveniência.
- A etapa Storage + PostgreSQL usa compensação; não deve ser descrita como transação distribuída.
- Valores de movimentações financeiras representados em centavos inteiros (amountMinor); domínios comerciais independentes mantêm seus contratos próprios.
- Deduplicação OFX usa identidade estável baseada em banco, conta, FITID e atributos da transação; CSV mantém identidade por arquivo e índice de linha quando não há identificador de origem estável.
- Workspace carrega registros persistidos de forma paginada, com limite operacional explícito, e aplica período selecionado aos indicadores, conciliação e listagem.
- Módulos operacionais existentes foram preservados na linha de integração; nenhuma escrita em ERP é autorizada por esta etapa.
- Homologação funcional remota ainda pendente: exige configuração de ambiente, convite do primeiro administrador, testes com dois usuários e validação de isolamento entre organizações.

## D02 — Persistência gerenciada
- Modelo multiempresa baseado em organizações e memberships explícitos.
- RLS nas tabelas protegidas e Storage privado com caminhos tenant-scoped.
- Valores monetários de movimentações em unidades menores inteiras.
- Importação calculada no servidor a partir do arquivo original, não de payload financeiro confiado ao navegador.
- Contadores distinguem inserções, duplicatas e rejeições.
- Listagens paginadas; filtros e agregações devem respeitar o período selecionado.
- UEAP permanece delimitado ao contrato de gateway; não representa verdade contábil nem autorização de escrita em ERP.

## Próximas etapas e gates
1. Executar CI completa no HEAD candidato: audit, testes, typecheck e build.
2. Executar database tests/pgTAP no mesmo HEAD e validar migrations na ordem.
3. Homologar Auth, callback, convite, provisionamento e logout/login com usuários reais de teste.
4. Homologar persistência após nova sessão e idempotência de reimportação.
5. Testar Storage privado, compensação de falhas e isolamento com pelo menos dois tenants.
6. Homologar OFX com extratos anonimizados de diferentes bancos, incluindo FITID ausente/reutilizado e múltiplas contas.
7. Validar paginação e agregações acima de 100 registros e o limite operacional documentado.
8. Confirmar que 30, 90 e 365 dias controlam a mesma janela temporal em indicadores, conciliação e listagem.
9. Manter integrações ERP em leitura/dry-run até autorização e homologação específicas.
10. Avançar gestão financeira e novas fontes somente após aceite dos gates anteriores.

## Regras
- Não usar dados financeiros reais em fixtures ou no repositório.
- Não declarar recursos disponíveis antes da homologação correspondente.
- Não realizar escrita em ERP sem autorização específica e escopo próprio.
- Não converter sugestões de conciliação em confirmação financeira automática.
- Cada etapa deve possuir testes automatizados, evidências e critérios de aceite.
- CI verde não substitui homologação remota, teste de segurança multi-tenant ou validação com extratos reais anonimizados.

## Critério de conclusão D02
Dados persistem entre sessões; usuários de empresas diferentes não acessam dados entre si; importações são idempotentes e derivadas do arquivo no servidor; valores permanecem inteiros em centavos; Storage é privado e testado; contadores distinguem inserções, duplicatas e rejeições; listagens são paginadas; filtros respeitam o período selecionado; nenhum segredo privilegiado chega ao browser; compensações falhas são rastreáveis.