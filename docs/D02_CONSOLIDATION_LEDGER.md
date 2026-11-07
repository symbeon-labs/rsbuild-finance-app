# Registro de consolidação — D02 (#12 → #19/#20)

**Data:** 2026-11-06  
**Linha candidata:** `integration/d02-finance-controlled-merge` (PR #19) + `fix/d02-finance-corrective-round` (PR #20)  
**Escopo:** registrar a destinação das contribuições exclusivas identificadas na PR #12 e preservar a separação entre integração funcional e correções financeiras.

## Decisão de consolidação
A PR #19 é a integração controlada da fundação D02 com os módulos operacionais existentes. A PR #20 é uma rodada corretiva baseada diretamente na #19. A #20 não substitui a #19: complementa quatro arquivos com correções de identidade OFX, paginação e filtros temporais.

Nenhuma destas PRs deve ser mesclada antes dos gates técnicos e de homologação descritos nas próprias PRs.

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

## Limites e gates não resolvidos
- CI completa e database tests/pgTAP devem passar no HEAD final da #20.
- A paginação deve ser revisada em volume alto.
- Importação OFX precisa de homologação com extratos anonimizados de diferentes bancos.
- Auth, convite, membership, Storage, logout/login e isolamento entre tenants precisam de testes remotos.
- A divergência da linha de integração em relação à `main` deve ser resolvida por revisão/rebase controlado, sem descartar módulos operacionais.
- Não declarar produção, integração Omie ativa ou segurança multi-tenant homologada apenas com base em testes automatizados.

## Evidência e método
Este registro foi elaborado a partir das listas de arquivos das PRs #12, #19 e #20, comparação de refs `main` → `integration/d02-finance-controlled-merge` e `integration/d02-finance-controlled-merge` → `fix/d02-finance-corrective-round`, e leitura dos arquivos `.github/workflows/ci.yml` e `docs/IMPLEMENTATION_PLAN.md` nas branches da linha candidata.

Este documento registra destinação e estado de consolidação; não declara merge, deploy, execução de CI ou homologação remota.