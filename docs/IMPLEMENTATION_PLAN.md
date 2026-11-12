# RSBUILD OS — Plano de Implementação do Domínio Finance

**Versão:** 0.2  
**Status:** Plano técnico de trabalho do primeiro domínio  
**Escopo:** Finance; não representa o plano de implementação de todos os domínios do RSBUILD OS.

## Relação com a arquitetura da plataforma

Este documento orienta a evolução do domínio Finance dentro do RSBUILD OS. A arquitetura da plataforma, seus limites de domínio e a sequência de migração são definidos em [RSBUILD OS Architecture & Repository Migration v1.0](RSBUILD_OS_ARCHITECTURE_MIGRATION_v1.0.md) e na baseline arquitetural sujeita a revisão.

O RSBUILD OS é a plataforma; Finance é o primeiro domínio estruturado. Este plano preserva as prioridades financeiras existentes sem declarar outros domínios implementados, nem autorizar mudanças no Symbeon Financial Core.

## Objetivo

Organizar a evolução do domínio Finance a partir das capacidades financeiras priorizadas, mantendo entregas verificáveis e separando funcionalidades já presentes de capacidades futuras.

## Estado identificado na aplicação

A versão atualmente registrada contém:
- Aplicação Next.js com interface responsiva.
- Painel de visão geral com indicadores calculados sobre os registros carregados na sessão.
- Importação e pré-visualização de CSV e OFX.
- Pesquisa de movimentações.
- Áreas de contas e relatórios ainda em preparação.
- Pipeline de CI configurado para instalação, verificação de tipos e build.

Limitações identificadas:
- Os registros ficam somente no estado da sessão e são perdidos ao recarregar a página.
- Não há autenticação nem separação de acesso por empresa.
- Não há persistência em banco de dados.
- O seletor de período ainda não filtra os indicadores ou a lista.
- Não há cadastro operacional de contas e fontes.
- Não há integração ativa com Omie, bancos ou adquirentes.
- Não há motor de conciliação.
- Os registros importados não possuem ainda um processo robusto de deduplicação ou idempotência.
- A classificação automática do CSV utiliza heurísticas simples e deve ser tratada como não validada.
- A leitura OFX deve ser ampliada com fixtures reais anonimizadas e testes de conformidade.

## Sequência de implementação

### D01 — Integridade da importação

- Definir contrato de importação para CSV e OFX.
- Criar conjunto de arquivos de teste anonimizados.
- Validar datas, valores, sinais, moeda e campos obrigatórios.
- Preservar identificação da origem e referência ao lote.
- Detectar duplicidades e permitir reprocessamento seguro.
- Exibir erros por linha e resumo da importação.

**Aceite:** fixtures aprovadas, totais conferidos e importações repetidas sem duplicação indevida.

### D02 — Persistência e organização por empresa

- Definir entidades de empresa, usuário, conta, fonte, lote e movimentação.
- Implementar persistência com isolamento por empresa.
- Estabelecer trilha de criação e atualização dos registros.
- Definir política de acesso e retenção.
- Remover dependência do estado transitório do navegador.

**Aceite:** dados persistem após nova sessão e não são acessíveis entre empresas sem autorização.

### D03 — Visão financeira confiável

- Implementar filtros reais por período, conta, origem e direção.
- Separar valores confirmados, pendentes e estimados.
- Calcular indicadores a partir de registros persistidos e validados.
- Exibir cobertura, período e atualização da informação.
- Adicionar testes de cálculo financeiro com precisão decimal.

**Aceite:** indicadores reproduzíveis e reconciliados com os registros de origem usados no teste.

### D04 — Gestão financeira

- Modelar contas a pagar e a receber sem confundi-las com movimentações bancárias.
- Separar fluxo realizado de fluxo projetado.
- Criar relatórios com critérios e período explícitos.
- Registrar regras e classificações aprovadas pelos responsáveis.

**Aceite:** cenários operacionais validados e relatórios reproduzíveis.

### D05 — Integrações de fontes

- Validar acesso, escopo e amostras do Omie antes de desenvolver o adaptador.
- Implementar consulta somente leitura inicialmente.
- Definir mapeamento de identificadores e paginação.
- Adicionar adaptadores para outras fontes somente com amostras e testes representativos.

**Aceite:** cobertura e integridade dos campos demonstradas, sem mutação nos sistemas de origem.

### D06 — Conciliação

- Definir relações possíveis entre movimentos, recebíveis, pagamentos e liquidações.
- Gerar candidatos explicáveis, sem confirmar automaticamente casos ambíguos.
- Criar fila de exceções e revisão humana.
- Registrar decisões e justificativas.

**Aceite:** conjunto de casos rotulados e métricas de precisão por tipo de relacionamento.

### D07 — Expansão adaptativa do domínio Finance

- Permitir habilitar capacidades financeiras por empresa conforme configuração e validação.
- Versionar regras operacionais e mapeamentos específicos.
- Adicionar fontes, unidades e módulos conforme necessidade observada.
- Monitorar cobertura, desempenho e qualidade por empresa.

**Aceite:** expansão validada sem regressão de isolamento, integridade ou compatibilidade.

## Regras de implementação

- Não introduzir dados financeiros reais em fixtures ou no controle de versão.
- Usar valores monetários com representação decimal exata ou unidades monetárias inteiras.
- Não tratar sugestão algorítmica como confirmação financeira.
- Não realizar escrita em ERP ou banco sem autorização e escopo próprios.
- Cada etapa deve possuir testes automatizados, evidências e critérios de aceite.
- Não declarar capacidade como disponível antes de cumprir seus critérios.
- Respeitar a baseline de arquitetura do RSBUILD OS e os gates aprovados.
- Não replicar no aplicativo algoritmos, semântica financeira ou metodologia interna do Symbeon Financial Core.

## Próxima prioridade técnica

A primeira prioridade do domínio Finance permanece D01 — Integridade da importação. Antes de ampliar fontes ou construir indicadores mais sofisticados, a aplicação precisa demonstrar que interpreta corretamente os arquivos, preserva sua origem e evita duplicidades.

**Nota:** este plano é restrito ao domínio Finance. A expansão para outros domínios depende de descoberta, delimitação, validação e contratação próprias.
