# Registro de consolidação — D02 (#12 → #19/#20 → #21)

**Data:** 2026-11-06  
**Linha candidata atual:** `integration/d02-reconciled-main-2026-11-07` (PR #21), construída sobre o HEAD atual da `main`.  
**Escopo:** registrar a destinação das contribuições exclusivas identificadas na PR #12 e preservar a separação entre integração funcional e correções financeiras.

## Decisão de consolidação
A PR #19 é a integração controlada da fundação D02 com os módulos operacionais existentes. A PR #20 é uma rodada corretiva baseada diretamente na #19. A #20 não substitui a #19: complementa quatro arquivos com correções de identidade OFX, paginação e filtros temporais.

A linha #19 + #20 foi transplantada para uma candidata nova baseada na `main` atual, preservando o workspace operacional e a identidade visual mais recente. A PR #21 permanece draft; não houve merge em `main`.

## Contribuições exclusivas da PR #12

Na comparação dos arquivos alterados, dois caminhos aparecem na #12 e não aparecem na lista de arquivos alterados da #19:

| Contribuição exclusiva identificada na #12 | Destino na linha #19/#20 | Decisão |
|---|---|---|
| `.github/workflows/ci.yml` | Mantido na branch `fix/d02-finance-corrective-round` | Preservar audit, testes, typecheck e build; restaurar `cache: npm` do setup-node. |
| `docs/IMPLEMENTATION_PLAN.md` | Atualizado na branch `fix/d02-finance-corrective-round` | Substituir o plano antigo v0.1 pelo estado reconciliado v0.6, mantendo homologações pendentes explícitas. |

A presença desses arquivos na branch da #20 foi verificada diretamente. A comparação identifica exclusividade por caminho alterado, não prova que todo o conteúdo original da #12 seja exclusivo; alterações em arquivos compartilhados devem ser avaliadas pelo diff/ancestralidade e não transplantadas cegamente.

## Correções já contidas na PR #20
- Identidade de importação OFX estável por banco, conta, FITID e atributos da transação.
- CSV mantém identidade por arquivo e índice de linha quando não há identificador estável de origem.
- Testes para estabilidade da identidade OFX e separação de FITIDs reutilizados.
- Carregamento paginado de registros persistidos, até o limite documentado de 10.000 por carregamento, com aviso explícito e ação para carregar mais.
- Aplicação do período selecionado (30, 90 ou 365 dias) a indicadores, conciliação e listagem, usando limites de data local.
- Textos dos indicadores alinhados à origem persistida e ao período selecionado.

## Reconciliação com a main atual — PR #21
- Base de integração: `main` em `30ed5ff22bb6551f2ae226581c3a3c93e5f58c4a`.
- HEAD da candidata após a reconciliação inicial: `28ceba87c0da9eb409c4eaab6066ebad73917d3d`.
- Preservados `app/globals.css`, ativos oficiais, login institucional e white-label do workspace da `main`.
- O login visual foi conectado à Server Action `signIn`; o redirecionamento simulado foi removido.
- Preservados os módulos de baixas/conciliação, comprovantes/canhotos e entrada de pedidos; a camada D02 foi integrada ao workspace.
- Corrigida a atualização da listagem após importação para carregar páginas até o limite operacional de 10.000 registros.
- O tipo `FinancialRecord.status` agora contempla `ignorado`, evitando descartar esse estado retornado pelo banco.
- Comparação da PR #21 com `main`: `ahead` 1, `behind` 0, sem divergência de ancestralidade.
- CI no SHA `28ceba87c0da9eb409c4eaab6066ebad73917d3d`: `npm audit`, testes, typecheck e build aprovados.
- Workflow de database tests no mesmo SHA: migrations e pgTAP aprovados; encerramento do job ainda aguardava cleanup no momento do registro.
- Preview Vercel reportado como `success`; isso não substitui homologação funcional.

## Limites e gates não resolvidos
- Reexecutar CI e database tests após qualquer alteração subsequente à candidata validada.
- A paginação deve ser revisada em volume alto.
- Importação OFX precisa de homologação com extratos anonimizados de diferentes bancos.
- Auth, convite, membership, Storage, logout/login e isolamento entre tenants precisam de testes remotos.
- A divergência da linha de integração em relação à `main` deve ser resolvida por revisão/rebase controlado, sem descartar módulos operacionais.
- Não declarar produção, integração Omie ativa ou segurança multi-tenant homologada apenas com base em testes automatizados.

## Evidência e método
Este registro foi elaborado a partir das listas e patches das PRs #12, #19, #20 e #21, comparação de refs da linha original e da candidata com `main`, leitura de arquivos críticos e resultados de GitHub Actions/Vercel.

Este documento registra destinação e estado de consolidação; não declara merge, deploy, execução de CI ou homologação remota.