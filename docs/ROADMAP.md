# RSBUILD Finance — Roadmap de Evolução

**Versão:** 0.1  
**Status:** Direção de produto  
**Contexto inicial:** operação de duas empresas

## Objetivo

Desenvolver uma solução de gestão financeira capaz de acompanhar a realidade operacional das empresas, consolidar informações de diferentes fontes e ampliar progressivamente sua capacidade de controle, análise e integração.

Este documento apresenta a direção de evolução do produto. A presença de uma capacidade no roadmap não significa que ela já esteja implementada, contratada ou disponível. Cada entrega depende de definição de escopo, acesso às fontes, validação dos dados e aceite.

## Princípios de evolução

- **Evolução progressiva:** incorporar capacidades conforme a maturidade e a complexidade das operações.
- **Rastreabilidade:** permitir identificar a origem das informações e os tratamentos aplicados.
- **Confiabilidade:** manter cálculos financeiros verificáveis e reproduzíveis.
- **Integração responsável:** conectar sistemas somente após autorização e validação técnica.
- **Adaptação operacional:** incorporar novas unidades, fontes, regras e módulos sem impor um modelo único a todas as empresas.
- **Transparência de estado:** distinguir capacidades planejadas, em desenvolvimento, disponíveis para teste e liberadas.

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

### 03 — Integração operacional

**Objetivo:** reduzir a fragmentação de informações entre os sistemas utilizados pelas empresas.

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

### 06 — Expansão adaptativa

**Objetivo:** permitir que a solução acompanhe a evolução das operações.

Possibilidades de expansão:
- Novas empresas, unidades e estruturas operacionais.
- Novas fontes, formatos e integrações.
- Regras específicas por operação.
- Novos módulos e visões gerenciais.
- Ampliação da capacidade de processamento e acompanhamento conforme volume e complexidade.

**Resultado esperado:** evolução contínua da solução sem impor um modelo operacional único a todas as empresas.

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

Novas necessidades identificadas durante a operação devem ser registradas, avaliadas e priorizadas. A inclusão de uma necessidade no roadmap não constitui, por si só, compromisso de prazo, preço ou entrega.

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

---

**Nota:** este documento expressa a direção de evolução do produto. Não representa declaração de que todas as capacidades descritas já estejam implementadas ou incluídas em uma contratação vigente.
