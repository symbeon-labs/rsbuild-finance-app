# RSBUILD Finance — PR Reconciliation Ledger

**Data de corte:** 2026-11-12  
**Repositório:** `symbeon-labs/rsbuild-finance-app`  
**Base desta reconciliação:** `main` em `0e71ad7f01c767d436f90f2c64fc330859eeffbd`  
**Branch deste documento:** `docs/pr-reconciliation-ledger-2026-11-12`

## 1. Objetivo e limites

Este ledger registra o estado das Pull Requests abertas, suas relações de dependência, divergência em relação à linha principal e recomendação de tratamento. Seu propósito é impedir integrações duplicadas ou baseadas em branches antigas e estabelecer uma sequência confiável para concluir F01–F04.

A revisão foi feita com metadados atuais do GitHub (base/head, SHA, draft, mergeability, contagem de arquivos/linhas e comparação de commits), descrições das PRs e leitura direcionada de patches de arquivos críticos. **Não equivale a uma auditoria linha a linha de todos os arquivos, execução de CI, QA funcional, teste de banco ou homologação de segurança.** Onde essas evidências não foram consultadas, o gate permanece explicitamente pendente.

Nenhuma PR foi mesclada, fechada, alterada ou rebaseada. Nenhuma migration foi aplicada. Nenhum dado ou configuração Supabase/Vercel foi alterado.

## 2. Estado de referência

- `main`: `0e71ad7f01c767d436f90f2c64fc330859eeffbd`.
- Última integração observada em main: PR #39, responsividade mobile/tablet.
- PRs abertas identificadas nesta revisão: #40, #37, #33, #32, #31, #29, #25, #23, #21, #20, #19, #15, #14, #13 e #12.
- A existência de uma PR, migration ou teste em uma branch não significa que o artefato esteja na main ou no banco remoto.
- O indicador GitHub `mergeable` é apenas uma avaliação estrutural momentânea. Não representa aprovação funcional, de segurança ou de produto.

## 3. Ledger consolidado

| PR | Escopo | Base da PR | Estado observado | Relação / risco | Decisão recomendada |
|---|---|---|---|---|---|
| [#40](https://github.com/symbeon-labs/rsbuild-finance-app/pull/40) | Portfólio de projetos, sprints, tarefas, dependências e entregáveis | main | Aberta, não Draft; 12 arquivos; +1.570/-154; head `00ed05a`; 50 commits; mergeable, checks/validação pendentes no texto | Nova migration e RLS; alteração do workspace e da Torre de Controle. Não é entrega financeira F01–F04, mas afeta a plataforma e permissões | **Preservar como candidata prioritária**, revisar SQL/RLS/API e concluir build, typecheck, testes pgTAP e QA por tenant antes de merge |
| [#37](https://github.com/symbeon-labs/rsbuild-finance-app/pull/37) | Lifecycle de convites organizacionais | main (base SHA antigo) | Draft; 6 arquivos; +328/-73; head `f19c5cc`; 25 commits; GitHub mergeable | Depende de `20261110013000_d02_organization_admin_and_branding.sql`; callback e RPC; QA Auth/SMTP e expiração ainda pendente | **Preservar e reconciliar sobre main atual**; validar migration, callback, privilégio da RPC, convite/aceite/revogação e dois tenants |
| [#33](https://github.com/symbeon-labs/rsbuild-finance-app/pull/33) | Workflows de auditoria e remediação de segurança Supabase | main (base SHA antigo) | Draft; 3 arquivos; +338; head `bbea5b8`; 8 commits; mergeable | Exige secrets e Environment protegido; workflow de remediação altera default privileges. Não foi executado | **Manter em espera**; revisão manual do YAML/SQL e configuração protegida; somente executar com autorização administrativa explícita |
| [#32](https://github.com/symbeon-labs/rsbuild-finance-app/pull/32) | Reconciliação de grants para anon/authenticated | main (base SHA antigo) | Draft; 1 migration; +33; head `7599579`; 1 commit; mergeable | A migration registra/reaplica revogações de privilégios; não corrige default privileges. Precisa ser comparada ao estado remoto e à cadeia atual de migrations | **Preservar, rebasear/recriar sobre main atual e validar catálogo** antes de decidir merge |
| [#31](https://github.com/symbeon-labs/rsbuild-finance-app/pull/31) | Arquitetura híbrida Edge ↔ RSBUILD e contratos | main (base SHA antigo) | Draft; 2 arquivos; +1.186; head `86d3254`; 3 commits; mergeable | Documentação, sem runtime/schema. Complementa direção da #23; não deve ser confundida com integração existente | **Preservar como proposta arquitetural**, consolidar referências com #23 e manter contratos como Proposed até aceite formal |
| [#29](https://github.com/symbeon-labs/rsbuild-finance-app/pull/29) | Organização ativa, seletor e isolamento de estado local por organização | main (base SHA antigo) | Aberta, não Draft; 7 arquivos; +115/-46; head `bdbd4a8`; 17 commits; não mergeable / dirty | Altera auth actions, page e EnterpriseWorkspace. O diff também namespacia localStorage, mas isso não transforma títulos/baixas em persistência server-side | **Não mesclar como está**; reconciliar conflitos manualmente com #37 e #40; testar autorização da organização ativa e troca de tenant. Não declarar F01 resolvido |
| [#25](https://github.com/symbeon-labs/rsbuild-finance-app/pull/25) | Auditoria D02 e inventário Workspace Experience | main (base SHA antigo) | Draft; 2 arquivos; +628; head `8e036cf`; 2 commits; mergeable | Registra lacunas: títulos, baixas, canhotos e pedidos sem tabelas dedicadas no inventário; decisões de domínio e persistência pendentes | **Preservar como insumo de F01**; revisar contra schema atual e atualizar se houver divergência. Não tratar inventário estático como estado remoto atual |
| [#23](https://github.com/symbeon-labs/rsbuild-finance-app/pull/23) | Baseline de arquitetura RSBUILD OS / Finance | main (base SHA antigo) | Draft; 6 arquivos; +1.028/-53; head `4a74568`; 7 commits; mergeable | Define modular monolith, fronteiras de domínio e sequência M0–M4; conteúdo parcialmente sobreposto à #31 e aos documentos posteriores | **Preservar decisões arquiteturais úteis**, reconciliar documentos com #31 e main; remover afirmações temporais obsoletas antes de aprovação |
| [#21](https://github.com/symbeon-labs/rsbuild-finance-app/pull/21) | Reconciliação D02 sobre main | main (base SHA antigo) | Draft; 45 arquivos; +3.719/-391; head `b1eff36`; 7 commits; não mergeable / dirty | Descrição registra 7 commits ahead/20 behind no corte de 09/11; comparação atual main…head: 7 ahead/177 behind. Contém linha ampla de integração, conflitos e bloqueios de segurança/Storage já identificados | **Não mesclar**. Usar como registro de investigação; extrair mudanças ainda válidas e reaplicá-las em branch nova sobre main, sem tentar ressuscitar a branch inteira |
| [#20](https://github.com/symbeon-labs/rsbuild-finance-app/pull/20) | Correções D02: identidade OFX, paginação, filtros e ledger | #19 / branch `integration/d02-finance-controlled-merge` | Draft; 7 arquivos; +184/-124; head `8e3695d`; 9 commits; mergeable contra sua base | PR filha; não é candidata independente para main. Sua base é branch de integração antiga. Comparação main…head: 56 ahead/183 behind | **Preservar seletivamente** as correções de OFX/paginação/período; reaplicar e testar na integração D02 atual, não fazer merge direto |
| [#19](https://github.com/symbeon-labs/rsbuild-finance-app/pull/19) | Integração D02 + núcleo financeiro em centavos | main (base SHA antigo) | Draft; 42 arquivos; +3.544/-86; head `bdb5ec3`; 47 commits; não mergeable / dirty | Integra auth, persistência e importação com módulos operacionais. Comparação main…head: 47 ahead/183 behind. Base histórica anterior à main atual | **Não mesclar**. Tratar como snapshot histórico de integração; reaproveitar apenas commits/arquivos necessários após comparação semântica com main e schema remoto |
| [#15](https://github.com/symbeon-labs/rsbuild-finance-app/pull/15) | Console restrito de observabilidade | #13 / branch `feat/rsbuild-branded-login` | Draft; 3 arquivos; +55/-3; head `519bdec`; 3 commits; mergeable contra base | PR filha da #13; não aponta diretamente para main. Requer variável `RSBUILD_DEV_EMAIL` e QA de autorização | **Preservar como contribuição**, mas rebasear/recriar sobre main após decisão sobre #13; validar allowlist no servidor e ausência de exposição de segredos |
| [#14](https://github.com/symbeon-labs/rsbuild-finance-app/pull/14) | Baseline de execução do MVP e contrato de integração | #12 / branch `feat/d02-auth-persistence-completion` | Draft; 4 arquivos; +352/-38; head `bdff5c1`; 5 commits; mergeable contra base | PR filha documental da #12; base antiga. Pode conter escopo histórico do MVP anterior à persistência | **Preservar como histórico de produto**, revisar e atualizar após a decisão D02; não usar suas exclusões antigas como descrição automática do estado atual |
| [#13](https://github.com/symbeon-labs/rsbuild-finance-app/pull/13) | Identidade visual da tela de login e governança | #12 / branch `feat/d02-auth-persistence-completion` | Draft; 9 arquivos; +348/-25; head `eb0df63`; 22 commits; mergeable contra base | PR filha da #12; alterações visuais e documentais. Não deve trazer junto a linha inteira D02 para main | **Preservar seletivamente** identidade e documentos pertinentes; reaplicar sobre main atual e validar visualmente |
| [#12](https://github.com/symbeon-labs/rsbuild-finance-app/pull/12) | Fundação D02: Auth SSR, provisionamento, persistência de importações | main (base SHA antigo) | Aberta, não Draft; 41 arquivos; +3.599/-160; head `d92c02d`; 174 commits; não mergeable / dirty | Comparação main…head: 174 ahead/192 behind. Parte da evolução D02 aparece nas #19/#20/#21; risco alto de duplicação e regressão ao integrar a branch integral | **Não mesclar integralmente**. Tratar como origem histórica; inventariar contribuições exclusivas e verificar cada uma contra main e banco antes de reaplicar |

## 4. Grafo de dependências e linhagens

### 4.1 Linha D02 — integração financeira

```text
#12 D02 foundation
 ├── #13 branded login
 │    └── #15 developer observability
 ├── #14 execution baseline
 └── #19 controlled D02 integration
      └── #20 corrective round

#21 D02 reconciliation on main
    (linha alternativa de reconciliação; não é continuação automaticamente segura de #19/#20)
```

**Conclusão:** #12, #19, #20 e #21 não devem ser integradas em bloco. #12 e #19 são snapshots amplos e antigos; #20 depende da base #19; #21 é uma tentativa posterior de reconciliação, mas continua divergente e com bloqueios documentados. O caminho seguro é comparar as contribuições exclusivas e reaplicá-las em uma branch nova baseada na main atual, validando cada migration em ordem.

### 4.2 Linha de autenticação e workspace

```text
main atual
 ├── #29 active organization / workspace state
 ├── #37 invitation lifecycle
 └── #40 project portfolio / sprint workspace
```

Essas PRs tocam superfícies adjacentes, mas têm objetivos diferentes. #29 altera o workspace e a organização ativa; #37 altera convite/callback/membership; #40 adiciona permissões e tabelas de projetos. Devem ser testadas em conjunto quanto à identidade da organização, escopo de autorização e isolamento cross-tenant.

### 4.3 Segurança e arquitetura

- #32 registra hardening de privilégios; #33 documenta automação operacional para auditoria e remediação. A segunda não substitui a revisão e a aplicação controlada da primeira.
- #23 é baseline de arquitetura; #31 amplia a direção com Edge e contratos. Manter uma fonte canônica para evitar dois documentos normativos divergentes.
- #25 é o insumo de domínio mais diretamente útil para F01.

## 5. Decisões de reconciliação

1. **Nenhuma integração em massa.** PRs antigas e divergentes não serão mescladas apenas por estarem abertas ou por apresentarem CI histórica.
2. **Main é a referência de código.** Novas branches de implementação devem partir do SHA atual de main, salvo decisão explícita de integração diferente.
3. **PR filha não é PR independente.** #13/#14/#15 e #20 devem ter suas contribuições selecionadas, não mescladas como se fossem branches baseadas em main.
4. **Migrations são versionadas e verificadas.** Antes de nova migration F01, comparar migrations do repositório, histórico remoto e catálogo do projeto Supabase correto. Não aplicar nada remotamente sem autorização explícita.
5. **Persistência não pode ser simulada por localStorage.** Estado de sessão, fixtures e armazenamento local não satisfazem os critérios F01 de persistência multi-tenant.
6. **Domínios financeiros separados:** título a pagar/receber representa obrigação/direito; movimentação representa fato bancário; liquidação relaciona título e pagamento/recebimento; conciliação registra decisão entre fontes; classificação representa regra econômica.
7. **Segurança cross-tenant é gate de release.** Testes unitários ou mergeability não substituem pgTAP, teste com dois tenants e verificação de políticas efetivas.
8. **Sem merge, deploy ou mudança remota neste trabalho.** Este ledger é documentação de governança e decisão, não autorização de execução operacional.

## 6. Sequência recomendada após o ledger

| Ordem | Ação | Saída / critério |
|---|---|---|
| R0 | Confirmar main e atualizar o inventário de PRs | SHA e lista de branches registrados |
| R1 | Consolidar decisões arquiteturais #23/#31 e baseline #14 | Uma referência canônica, sem status históricos contraditórios |
| R2 | Reconciliar D02 por contribuições exclusivas de #12/#19/#20/#21 | Branch nova, migrations ordenadas, testes e diff revisado |
| R3 | Tratar #32 e #33 como pacote de segurança separado | Auditoria read-only, revisão de privilégios e gates administrativos |
| R4 | Reconciliar #29 e #37 com a superfície atual de Auth/Workspace | Organização ativa, convites e autorização validados |
| R5 | Homologar #40 em conjunto com os controles multi-tenant | Acesso isolado por projeto/organização e QA responsivo |
| R6 | Iniciar F01 sobre schema real reconciliado | Inventário de tabelas, modelo AP/AR, liquidação, histórico, permissões e testes de aceite |

## 7. Relação com F01–F04

| Entrega | Reaproveitamento identificado | Lacuna que permanece |
|---|---|---|
| **F01 — Gestão financeira persistente** | #25 inventário de domínio; D02 (#12/#19/#21) base de Auth, contas e movimentações; #20 paginação e identidade OFX | Títulos AP/AR, liquidações persistentes, histórico/auditoria e políticas de acesso precisam ser especificados e verificados no schema real |
| **F02 — Conciliação operacional** | #19/#20/#21 e lógica existente de reconciliação/importação | Conciliação operacional precisa de decisões persistentes, vínculo com títulos, divergências rastreáveis e dados ERP autorizados |
| **F03 — Inteligência financeira** | Dados normalizados, centavos inteiros, filtros e período de #20 | Indicadores reproduzíveis, classificação governada, fluxo de caixa e DRE ainda precisam de regras e dados de origem consistentes |
| **F04 — Acabamento e homologação** | #13 identidade, #15 observabilidade, #29 organização ativa, #33 operações de segurança, #37 convites, #39 responsividade integrada em main | QA E2E, permissões, evidências de homologação, acessibilidade e aceite operacional |

## 8. Gates que continuam abertos

- [ ] Ler todos os patches restantes das PRs com alterações de runtime/SQL antes de aprovar qualquer integração.
- [ ] Consultar checks/status do SHA atual de cada PR; este ledger não declara CI aprovada com base apenas no texto descritivo.
- [ ] Comparar migrations versionadas com o histórico remoto do projeto Supabase correto, em modo somente leitura.
- [ ] Confirmar o estado efetivo de Auth, Storage, grants, RLS e policies com testes autorizados.
- [ ] Revalidar build, typecheck, testes unitários e pgTAP na branch reconciliada.
- [ ] Fazer QA de organização/tenant e de fluxos de negócio em ambiente de homologação.
- [ ] Revisar este ledger após cada integração, registrando SHA, PR e evidência.

## 9. Conclusão executiva

O repositório não precisa de uma integração indiscriminada das PRs abertas. Precisa de **seleção de contribuições, reconciliação sobre a main atual e gates de evidência**.

As PRs #12/#19/#20/#21 formam a maior dívida de integração e não devem ser mescladas integralmente. #25 é o insumo imediato para desenhar F01, mas precisa ser confrontado com o banco atual. #29, #37 e #40 precisam de validação conjunta das fronteiras de tenant. #32/#33 devem permanecer sob governança de segurança. As propostas #23/#31 devem convergir para uma referência arquitetural única.

**Próximo marco:** concluir a reconciliação D02 e a leitura do schema remoto antes de abrir migrations ou implementação de F01.

---
*Documento de trabalho. Estado e recomendações refletem a evidência consultada em 2026-11-12; devem ser atualizados quando branches, checks, banco ou PRs mudarem.*
