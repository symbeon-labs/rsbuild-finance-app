# RSBUILD OS — Roadmap do Domínio Finance

**Versão:** 0.2  
**Status:** Direção de evolução do primeiro domínio  
**Contexto inicial:** operação de duas empresas

## Relação com o produto

RSBUILD OS é a plataforma operacional empresarial. Finance é seu primeiro domínio estruturado. Este roadmap descreve somente a evolução de Finance; não é um roadmap de todos os domínios da plataforma.

A visão de domínios e a migração arquitetural estão registradas em [RSBUILD OS Architecture & Repository Migration v1.0](RSBUILD_OS_ARCHITECTURE_MIGRATION_v1.0.md).

A presença de uma capacidade neste roadmap não significa que ela já esteja implementada, contratada ou disponível. Cada entrega depende de definição de escopo, acesso às fontes, validação dos dados e aceite.

## Princípios de evolução

- **Evolução progressiva:** incorporar capacidades conforme a maturidade e a complexidade das operações.
- **Rastreabilidade:** permitir identificar a origem das informações e os tratamentos aplicados.
- **Confiabilidade:** manter cálculos financeiros verificáveis e reproduzíveis.
- **Integração responsável:** conectar sistemas somente após autorização e validação técnica.
- **Adaptação operacional:** incorporar novas unidades, fontes e regras sem impor um modelo único a todas as empresas.
- **Transparência de estado:** distinguir capacidades planejadas, em desenvolvimento, disponíveis para teste e liberadas.
- **Fronteira de domínio:** preservar Finance como contexto próprio, sem absorver Purchasing, Inventory, Production ou Logistics.

## Etapas de evolução

### 01 — Visibilidade financeira

**Objetivo:** reunir informações financeiras essenciais em uma visão operacional.

Capacidades previstas:
- Importação controlada de extratos OFX e arquivos CSV mapeados.
- Visualização de movimentações, entradas, saídas e saldos.
- Pesquisa e filtros por período, conta e descrição.
- Identificação da origem e do período dos dados.
- Indicadores básicos de cobertura e atualização.

**Resultado esperado:** visão consolidada das movimentações disponíveis, com origem identificável.

### 02 — Gestão financeira

**Objetivo:** apoiar o acompanhamento das obrigações e dos recursos financeiros.

Capacidades previstas:
- Visões de contas a pagar e a receber.
- Fluxo de caixa realizado e projetado, apresentados separadamente.
- Relatórios gerenciais reproduzíveis.
- Regras de acompanhamento e alertas validados pela operação.
- Identificação de informações ausentes, incompletas ou desatualizadas.

**Resultado esperado:** maior previsibilidade e organização da rotina financeira.

### 03 — Integração operacional do domínio Finance

**Objetivo:** reduzir a fragmentação de informações entre sistemas utilizados pelas empresas.

Capacidades previstas:
- Integração inicial com ERP, começando por consulta e validação de dados do Omie.
- Ampliação para bancos, adquirentes, sistemas de ponto de venda e outras fontes efetivamente utilizadas.
- Mapeamento de informações e identificadores por fonte.
- Monitoramento da qualidade e da atualização das integrações.

**Resultado esperado:** redução de consolidações manuais e maior cobertura das informações operacionais.

### 04 — Conciliação e confiabilidade

**Objetivo:** identificar relações, diferenças e pendências entre registros de diferentes fontes.

Capacidades previstas:
- Identificação de possíveis correspondências entre movimentações.
- Tratamento de relações um-para-um, um-para-muitos e muitos-para-um quando suportadas pelos dados.
- Fila de divergências e exceções.
- Revisão humana de correspondências que exijam decisão.
- Histórico das decisões e justificativas.

**Resultado esperado:** maior confiabilidade na interpretação dos registros e visibilidade das pendências.

### 05 — Inteligência gerencial

**Objetivo:** transformar dados validados em informação útil para decisões.

Capacidades previstas:
- Indicadores de desempenho financeiro.
- Análises de receitas, despesas, custos e tendências, conforme disponibilidade e qualidade dos dados.
- Comparações entre períodos e unidades.
- Relatórios executivos e acompanhamento de indicadores.
- Sinalização explícita de estimativas, lacunas e limitações dos dados.

**Resultado esperado:** apoio mais consistente ao planejamento e à tomada de decisão.

### 06 — Expansão adaptativa do domínio

**Objetivo:** permitir que Finance acompanhe a evolução das operações.

Possibilidades de expansão:
- Novas empresas, unidades e estruturas operacionais.
- Novas fontes, formatos e integrações.
- Regras específicas por operação.
- Novas capacidades financeiras.
- Ampliação da capacidade de processamento e acompanhamento conforme volume e complexidade.

**Resultado esperado:** evolução do domínio sem impor um modelo financeiro único a todas as empresas.

## Domínios adjacentes — fora deste roadmap

A descoberta operacional identificou oportunidades em Purchasing, Receiving, Inventory, Production, Quality, Commercial, Stores, E-commerce, Logistics, Corporate Services e outras áreas.

Essas oportunidades serão avaliadas no nível do RSBUILD OS e não devem ser adicionadas automaticamente ao escopo de Finance. Cada domínio requer descoberta, ownership, contratos, critérios de aceite, dependências e condições comerciais próprios.

## Critérios de disponibilização

Cada capacidade deve possuir um estado explícito:

- **Planejada:** identificada como possibilidade ou prioridade futura.
- **Em desenvolvimento:** implementação em andamento.
- **Disponível para teste:** implementada em ambiente de validação.
- **Disponível:** validada e liberada para uso no escopo definido.
- **Suspensa:** temporariamente indisponível ou bloqueada por dependência.

Uma capacidade somente deve ser considerada disponível após implementação, testes, validação das fontes necessárias e aceite correspondente.

## Dependências operacionais

A evolução pode depender de:
- Amostras representativas e dados autorizados.
- Acesso aprovado aos sistemas e contas necessários.
- Validação dos significados dos campos e regras operacionais.
- Participação dos responsáveis pelas informações financeiras.
- Homologação e aceite dos resultados.

## Gestão da evolução

Novas necessidades devem ser registradas, avaliadas e priorizadas no domínio responsável. A inclusão de uma necessidade no roadmap não constitui, por si só, compromisso de prazo, preço ou entrega.

Cada evolução será detalhada conforme seu escopo, dependências, critérios de aceite e condições comerciais aplicáveis.

## Limites de segurança

- Os sistemas de origem permanecem como referência para os registros que administram.
- A importação e a consulta não autorizam alterações nos sistemas de origem.
- Pagamentos, transferências, baixas ou liquidações automáticas não fazem parte da direção inicial.
- Informações estimadas, incompletas ou não conciliadas não devem ser apresentadas como fatos confirmados.
- Dados de clientes e credenciais não devem ser armazenados no repositório de código.

## Indicadores de sucesso

As metas quantitativas serão definidas após estabelecer uma linha de base operacional. Indicadores a acompanhar:
- Sucesso e completude das importações.
- Cobertura das fontes.
- Atualização dos dados.
- Precisão dos cálculos.
- Volume de divergências identificadas e resolvidas.
- Tempo operacional gasto em consolidação.
- Reprodutibilidade dos relatórios.
- Aceite dos responsáveis pela operação.

**Nota:** este roadmap expressa a direção do domínio Finance. Não representa declaração de que todas as capacidades descritas já estejam implementadas ou incluídas em uma contratação vigente.
