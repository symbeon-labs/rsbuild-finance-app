# Cadastro de Relacionamentos — proposta V1

## Objetivo

Substituir o Diretório Base estático por um cadastro persistente de entidades e relacionamentos, disponível de forma transversal aos workspaces autorizados, preservando o isolamento multi-tenant do RSBUILD OS.

## Modelo conceitual

- **Entidade:** identidade cadastral (CPF/CNPJ), razão social/nome, nome fantasia e dados cadastrais.
- **Relacionamento:** vínculo explícito entre uma entidade e uma organização; contém status, observações, origem dos dados e metadados próprios daquele vínculo.
- **Classificação:** um ou mais papéis associados ao relacionamento.

Uma entidade global não implica visibilidade global. Cada organização só poderá consultar os relacionamentos aos quais possui vínculo autorizado. Compartilhamento futuro exige concessão explícita, escopo definido, trilha de auditoria e revogação.

## Classificações iniciais

Cliente, fornecedor, transportadora, parceiro comercial, prestador de serviço, distribuidor e outros. Um relacionamento pode possuir múltiplas classificações.

## Campos previstos

- Documento (CPF/CNPJ)
- Razão social/nome e nome fantasia
- Inscrição estadual (opcional)
- E-mail e telefone
- Endereço, município e UF
- Status: ativo, inativo ou arquivado
- Observações e origem dos dados
- Histórico/auditoria

## Escopo funcional V1

1. Cadastro manual e edição.
2. Validação de CPF e CNPJ, incluindo CNPJ alfanumérico conforme especificação oficial vigente.
3. Classificações múltiplas.
4. Pesquisa e filtros.
5. Inativação e arquivamento sem exclusão destrutiva.
6. Registro de autoria e histórico das alterações.
7. Interface integrada ao padrão visual atual, sem redesign do workspace.

## Evolução posterior

- **V2:** compartilhamento controlado entre organizações, com autorização explícita e revogável.
- **V3:** deduplicação, enriquecimento cadastral e integrações ERP.

## Requisitos de segurança

- RLS em todas as tabelas expostas.
- Escopo organizacional obrigatório em consultas e mutações.
- Verificação de membership e papel do usuário no servidor.
- Nenhum dado cadastral de uma organização será exposto a outra por simples igualdade de documento.
- Dados sintéticos nos testes.
- Nenhuma migration remota, alteração de dados operacionais, merge ou deploy de produção como parte desta PR.

## Critérios de aceite

- Usuário autorizado cadastra e consulta relacionamentos apenas no workspace permitido.
- Usuário sem membership não consegue ler nem alterar os registros.
- Usuários de organizações distintas não enxergam dados uns dos outros sem compartilhamento concedido.
- Validação documental cobre CPF, CNPJ numérico e CNPJ alfanumérico.
- Pesquisa, filtros, edição e arquivamento possuem testes.
- A interface preserva a identidade visual atual.
- Build, typecheck e testes são executados e seus resultados registrados antes da homologação.

## Estado desta PR

Esta PR inicia o trabalho com o escopo e as invariantes de segurança documentados. A implementação funcional, migrations e evidências de teste serão adicionadas em commits subsequentes nesta branch. Não representa funcionalidade pronta ou homologada.
