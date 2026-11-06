# Contrato de Integração

## 1. Objetivo

Estabelecer princípios comuns para integrações do RSBUILD Finance com arquivos, bancos, ERPs e aplicações externas. Este contrato define fronteiras arquiteturais; cada formato, fonte ou destino deverá possuir especificação própria e aprovação de escopo.

O núcleo do RSBUILD Finance opera sobre um modelo financeiro interno comum. Adaptadores externos traduzem formatos e entidades de origem para esse modelo, sem propagar dependências específicas de fornecedor para o core.

## 2. Escopo por estágio

### MVP demonstrativo atual
- Ingestão de arquivos CSV e OFX, nos layouts efetivamente implementados e testados.
- Normalização, visualização e busca sobre registros importados.
- Dados sintéticos ou anonimizados.
- Nenhuma integração operacional direta com ERP ou banco é presumida.

### Evoluções condicionadas
- Novos layouts e formatos de ingestão.
- Exportação estruturada por contrato de destino.
- Adaptadores ERP/source, começando por avaliação do Omie.
- API versionada e webhooks.
- Escrita controlada em sistemas externos.

A presença de uma capacidade neste documento não significa que esteja implementada, contratada, homologada ou autorizada.

## 3. Tipos de adaptadores

### 3.1 File adapters
Responsáveis por ler ou gerar arquivos conforme um formato e uma variante/layout específicos. CSV não deve ser tratado como um layout universal. Cada variante precisa declarar delimitador, codificação, cabeçalhos, convenções de data e decimal, campos e regras de validação.

### 3.2 ERP/source adapters
Responsáveis por conectar a uma fonte específica, aplicar autenticação e permissões, mapear entidades e traduzir dados para contratos internos. A parametrização do ERP no ambiente do cliente é uma frente de diagnóstico/implantação distinta do desenvolvimento do adaptador reutilizável.

### 3.3 Ingestion Engine
Coordena identificação do formato, parsing, validação, normalização, registro do lote, erros por registro e reprocessamento controlado.

### 3.4 Export Engine
Futuramente gera arquivos a partir do modelo interno para um contrato de destino explicitamente definido. Um formato aceito na entrada não é automaticamente suportado na saída.

### 3.5 Format Registry
O catálogo de formatos deve registrar, no mínimo:
- identificador, versão e direção (ingestão/exportação);
- extensão, variante e layout;
- regras de codificação, separador, data e decimal;
- mapeamento de campos e obrigatoriedade;
- parser/gerador e versão;
- validações, erros conhecidos e fixtures;
- estado de homologação e responsável pela manutenção.

No MVP, o registry pode ser documentação/configuração versionada; não exige serviço autônomo.

## 4. Contratos e normalização

Cada adaptador deve declarar:
- sistema/fonte e entidade de origem;
- formato e versão do layout;
- campos de origem e mapeamento;
- campos obrigatórios, opcionais e ausentes;
- regras de validação e tratamento de ambiguidades;
- identificadores originais e metadados de proveniência;
- comportamento em duplicidade e reprocessamento;
- erros esperados e limites conhecidos.

O modelo interno deve preservar os identificadores de origem, referências do arquivo/lote, valores originais relevantes e versão do parser. Não deduplicar silenciosamente apenas por data e valor.

## 5. Segurança, permissões e separação de leitura/escrita

- Aplicar menor privilégio e armazenar credenciais em mecanismo apropriado de gestão de segredos.
- Separar ambientes de desenvolvimento, homologação e produção.
- Isolar dados por organização antes de uso multiempresa com dados reais.
- Começar integrações ERP/source por leitura autorizada.
- Tratar leitura e escrita como capacidades e permissões independentes.
- Não realizar pagamentos, baixas, transferências ou alterações externas no MVP demonstrativo.

Qualquer escrita futura exige autorização e escopo próprios, autenticação/autorização, idempotência, validação, confirmação do destino, auditoria, tratamento de retentativas e plano de reversão/compensação quando possível.

## 6. Falhas, observabilidade e reprocessamento

As integrações devem prever indisponibilidade, limites de taxa, paginação, timeout, dados inválidos e falhas parciais. Logs devem permitir diagnóstico sem expor credenciais ou dados financeiros desnecessários. Reprocessamentos devem ser identificáveis e seguros contra duplicação.

## 7. Compatibilidade e versionamento

Contratos, schemas, parsers e layouts devem ser versionados. Alterações incompatíveis exigem avaliação de impacto, testes de regressão, atualização da documentação e plano de migração quando aplicável.

## 8. Testes e homologação

Cada formato ou adaptador deve possuir:
- amostras representativas e anonimizadas, quando possível;
- fixtures de casos válidos, inválidos e limites;
- testes de parsing/mapeamento e schema;
- testes de duplicidade, reprocessamento e falhas;
- evidência de homologação com o responsável pela fonte/destino.

Novo formato ou adaptador só entra no roadmap de execução quando houver necessidade identificada, amostras, contrato, mapeamento, tratamento de erros, testes e responsável pela manutenção.

## 9. Roadmap de interoperabilidade

1. MVP: CSV/OFX, normalização, visualização e busca.
2. Evolução de arquivos: novos layouts e exportação definida.
3. ERP: avaliação e adaptador Omie read-only, mediante autorização e homologação.
4. API/webhooks: interface versionada, autenticação, permissões e isolamento.
5. Expansão: outros ERPs, bancos, adquirentes e fontes.
6. Escrita externa: somente após contrato, autorização, idempotência, auditoria e homologação específicos.

O roadmap não altera o escopo do MVP nem cria compromisso de implementação.

## 10. Referência de execução

Consultar [EXECUTION_BASELINE.md](./EXECUTION_BASELINE.md) para escopo do MVP, sequência de trabalho, gates e critérios de evolução. Consultar [MVP_READINESS_HANDOFF.md](./MVP_READINESS_HANDOFF.md) para o estado de engenharia e evidências.
