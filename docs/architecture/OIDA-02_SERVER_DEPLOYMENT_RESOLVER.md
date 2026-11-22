# OIDA-02 — Server Deployment Resolver

**Status:** implementação proposta em PR encadeada à OIDA-01  
**Boundary:** server-only; sem integração automática ao runtime existente

## Entrega

- Validador estrito em runtime para o contrato schemaVersion 1.0.0, alinhado ao deployment/manifest.schema.json.
- Resolvedor de variáveis de ambiente exclusivamente no servidor.
- Contexto de deployment imutável, com identidade, capacidades, modo, release, Supabase e Storage.
- Loader server-only que lê apenas deployment/manifest.json no diretório de trabalho da aplicação.
- Testes negativos para schema incompatível, campos desconhecidos, combinações inválidas, segredos públicos, variáveis ausentes e URL insegura.

## Configuração

Cada artefato de implantação deve fornecer seu próprio deployment/manifest.json e definir as variáveis referenciadas pelo manifesto no ambiente de execução. O arquivo de produção não é versionado neste repositório: os exemplos de OIDA-01 continuam sendo modelos, não configuração ativa.

O loader não lê identidade de query string, cookie, body, local storage, user metadata ou cabeçalhos de requisição. O caminho do manifesto é fixo e não pode ser escolhido pelo cliente.

## Segurança

- secretKeyEnv não pode usar o prefixo NEXT_PUBLIC_.
- A URL do Supabase exige HTTPS; HTTP é permitido apenas para localhost/127.0.0.1.
- Variáveis obrigatórias ausentes ou configuração inválida interrompem a inicialização com erro.
- O contexto é congelado superficialmente e seus subobjetos também.
- O segredo fica no contexto server-only. Não o serializar, retornar em Server Actions/Route Handlers, registrar em logs ou passá-lo a componentes client.
- O manifesto não concede autorização: Auth, membership, RBAC e RLS continuam sendo as autoridades.
- O loader ainda não substitui os clientes Supabase atuais e não altera os fluxos de autenticação.

## Limites explícitos

Esta PR não adiciona um manifesto ativo à implantação atual, não chama o loader a partir das rotas existentes, não altera Auth/RLS, não cria clientes administrativos, não migra dados, não executa migrations e não altera Vercel, Supabase, QA ou produção. Portanto, ela entrega o mecanismo testável, mas não declara nenhuma implantação independente operacional.

## Uso futuro

A integração ao runtime existente deve ocorrer em uma etapa posterior, com um manifesto managed_shared validado para o ambiente atual, revisão de compatibilidade e testes de runtime. A migração para standalone depende também de OIDA-03 e de infraestrutura própria provisionada.
