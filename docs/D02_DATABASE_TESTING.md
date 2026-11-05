# D02 — Testes de banco de dados

## Pré-requisitos

- Docker compatível em execução.
- Supabase CLI v2 estável.
- Node.js 22 para os testes da aplicação.

## Executar localmente

```bash
supabase start -x studio,edge-runtime,logflare,vector
supabase test db
supabase stop --no-backup
```

O comando `supabase start` aplica as migrations versionadas em ordem cronológica. `supabase test db` executa os testes pgTAP em `supabase/tests` contra o PostgreSQL local.

## Cobertura D02

A suíte `d02_rls.test.sql` verifica:

- visibilidade isolada de organizações por membership;
- isolamento de objetos no Storage por prefixo de tenant;
- escrita permitida para operator e negada para viewer;
- rejeição de inserções cross-tenant;
- autoria derivada de `auth.uid()`, não do payload do cliente;
- estado inicial de movimentação não pode ser marcado como conciliado pelo cliente;
- caminho de artefato deve pertencer ao tenant;
- ausência de privilégios de exclusão e de mutação direta de estados de workflow;
- validações e eventos de auditoria não podem ser forjados pelo browser.

Os testes usam tenants e usuários sintéticos e fazem rollback ao final. Não utilizam dados financeiros reais.

## Cobertura complementar requerida para Storage remoto

A suíte pgTAP valida políticas no PostgreSQL local, mas não comprova o ciclo HTTP completo do Storage. A homologação deve executar com duas contas autenticadas e dois tenants: upload permitido no prefixo próprio; upload negado em prefixo alheio; download permitido apenas no tenant proprietário; delete permitido apenas para owner/admin/operator do tenant; viewer sem escrita; revogação de membership impedindo operações subsequentes. Guardar evidências sem incluir tokens, chaves ou dados financeiros reais.

A importação registra contadores separados (`inserted_count`, `duplicate_count`, `rejected_count`). O parser server-side rejeita integralmente arquivos com erros de parsing; por isso `rejected_count` no lote transacional é zero para os lotes aceitos, enquanto as duplicatas são contadas separadamente.

## Limites

A suíte local demonstra o comportamento das migrations e políticas no PostgreSQL local. Ela não substitui a validação no projeto remoto, os Supabase Advisors, nem a verificação de configuração de Auth, SMTP, callbacks e Storage do ambiente de homologação.
