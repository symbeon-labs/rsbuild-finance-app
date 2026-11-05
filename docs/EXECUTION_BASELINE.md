# RSBUILD Finance — Execution Baseline v0.1

**Status:** proposta interna de organização da execução  
**Produto:** RSBUILD Finance  
**Caso inicial:** Mundo do Sabor  
**Referência de escopo:** pacote de cinco documentos do produto, com prioridade para a Definição do MVP e a Arquitetura e Roadmap.

Este documento consolida decisões de produto e arquitetura para orientar a execução sistemática. Não altera, por si só, o escopo comercial, não constitui contratação e não autoriza acesso a dados ou sistemas de terceiros.

## 1. Direção do produto

O RSBUILD Finance começa como uma camada operacional de reconciliação bancária assistida. Reúne informações financeiras de fontes distintas, organiza e normaliza os registros, permite consulta e comparação, apoia a identificação de correspondências e exceções e oferece um dashboard para acompanhamento operacional e tomada de decisão.

O produto não substitui o ERP, o banco ou os sistemas oficiais da empresa. As fontes de origem continuam sendo autoritativas.

### 1.1 Princípio de evolução

A visão de longo prazo pode evoluir para uma plataforma mais ampla de inteligência e gestão financeira. Essa visão não deve expandir o MVP atual nem antecipar funcionalidades sem necessidade, dados, contratos e validação.

**Regra de execução:** construir o MVP delimitado; preservar contratos e fronteiras arquiteturais que permitam evoluir sem reescrever o núcleo.

## 2. Escopo do MVP demonstrativo

### Incluído no recorte demonstrativo atual

- Workspace e navegação básica.
- Importação de arquivos CSV e OFX.
- Normalização dos registros importados.
- Visualização e busca de movimentações.
- Testes dos parsers implementados.
- Dados sintéticos ou anonimizados.
- Dashboard operacional orientado à consulta e análise das movimentações importadas.

### Não incluído no MVP demonstrativo atual

- Persistência produtiva e operação multiempresa com dados reais, até que os controles sejam implementados e aceitos.
- Integração operacional direta com Omie ou outros ERPs.
- Sincronização bancária automática.
- Exportação geral estruturada.
- XLSX, XML, JSON, PDF e variantes adicionais de arquivos.
- API pública, webhooks e automações.
- Escrita ou atualização de dados no ERP.
- Pagamentos, transferências, baixas ou liquidações automáticas.
- Plataforma ampla de planejamento, orçamento, crédito, rentabilidade ou previsão financeira.

### 2.1 Reconciliação: linguagem e estado

A missão de produto é reconciliação bancária assistida. Entretanto, não devemos declarar que a reconciliação automática ou um fluxo completo de aprovação já está implementado apenas porque existe importação e visualização.

O trabalho de reconciliação deverá distinguir, no mínimo, entre:
- registro importado;
- candidato/sugestão de correspondência;
- correspondência confirmada;
- divergência/exceção;
- pendência sem correspondência conclusiva.

A confirmação humana, a evidência usada e o histórico de decisão devem ser registrados quando esse fluxo for implementado. Nenhum estado financeiro deve ser alterado silenciosamente.

## 3. Dashboard: uma base, duas perspectivas

O dashboard é parte central do produto, não um adorno nem um BI genérico.

### 3.1 Visão operacional — equipe financeira
- consultar e pesquisar movimentações;
- filtrar por período, fonte e atributos disponíveis;
- inspecionar registros e sua origem;
- revisar candidatos, divergências e pendências quando o fluxo de reconciliação estiver disponível;
- acompanhar eventos e histórico quando persistidos.

### 3.2 Visão executiva — diretoria
Uma perspectiva resumida da mesma base de dados, orientada à tomada de decisão. Deve mostrar apenas indicadores que possam ser derivados e explicados pelos dados e estados efetivamente disponíveis, por exemplo:
- volume de registros importados/analisados;
- quantidade e percentual de correspondências confirmadas, quando suportadas;
- divergências e pendências;
- evolução por período;
- itens que exigem atenção.

Cada indicador deve permitir aprofundamento até os registros de origem, respeitando permissões. Não inventar métricas de caixa, liquidez, rentabilidade ou projeção sem fontes e regras próprias.

A visão executiva é uma camada de apresentação do dashboard de reconciliação, não um segundo produto nem um novo escopo financeiro.

## 4. Acesso e experiência

- Landing page pública: apresentação institucional e entrada para autenticação.
- Login: acesso a usuários convidados/autorizados; cadastro público permanece desabilitado.
- Área financeira: acesso conforme papel e organização.
- Visão executiva: destinada a usuários de diretoria autorizados.
- Developer Console: acesso restrito exclusivamente ao responsável técnico designado nesta fase; sem rota pública desprotegida, bypass de autenticação ou exposição de ferramentas internas.
- Administração: permissões administrativas separadas de ferramentas de desenvolvimento.

A implementação de autenticação, papéis, isolamento por organização e autorização deve preceder o uso de dados financeiros reais.

## 5. Arquitetura de interoperabilidade

### 5.1 Núcleo independente

O core trabalha com um modelo interno comum e não deve depender do esquema específico de um banco, ERP ou arquivo. Adaptadores traduzem estruturas externas para contratos internos versionados.

Camadas conceituais:
1. Fontes: bancos, arquivos, ERPs e demais fontes autorizadas.
2. File adapters: leitura e, futuramente, geração de arquivos.
3. ERP/source adapters: conectores específicos por fornecedor ou fonte.
4. Ingestion/validation: identificação de formato, parsing, validação e normalização.
5. Core: modelo financeiro comum e regras de domínio.
6. Reconciliation: comparação, candidatos, exceções e decisões.
7. Dashboard: perspectivas operacional e executiva.
8. Evidence/events: proveniência, processamento, autoria, justificativas e histórico.
9. Export/API: saídas estruturadas e integrações futuras, sob contratos próprios.

### 5.2 Ingestion Engine

No MVP demonstrativo, limitar a implementação a CSV e OFX, conforme layouts e fixtures definidos.

A arquitetura deve permitir que futuras variantes sejam adicionadas sem lógica específica de formato espalhada pelo core. Cada parser deve preservar:
- origem e nome lógico da fonte;
- arquivo/lote e identificador do registro de origem, quando fornecidos;
- versão do parser e do layout;
- dados originais relevantes para auditoria;
- resultado de validação e erros por registro;
- referência de reprocessamento e deduplicação.

### 5.3 Format Registry

Introduzir o conceito de catálogo de formatos, sem exigir um serviço complexo no MVP. Inicialmente pode ser documentação/configuração versionada no repositório.

Cada formato/layout suportado deve declarar:
- identificador e versão;
- direção: ingestão ou exportação;
- extensão e variante/layout;
- codificação, delimitador, convenções de data e decimal, quando aplicável;
- campos de origem e mapeamento para o modelo interno;
- campos obrigatórios e opcionais;
- regras de validação e tratamento de ambiguidades;
- parser/gerador responsável;
- fixtures e testes de contrato;
- status: planejado, em desenvolvimento, homologado ou descontinuado;
- responsável pela manutenção.

CSV não deve ser tratado como um único layout universal. Variantes bancárias e de ERP precisam ser identificadas e homologadas individualmente.

### 5.4 Export Engine

Exportação geral estruturada permanece fora do MVP atual. Quando priorizada, deve gerar arquivos a partir do modelo interno e de um contrato de destino explícito. Um formato de ingestão não precisa, automaticamente, ser oferecido como formato de exportação.

Formatos candidatos para avaliação futura: CSV, XLSX, XML e JSON. Outros formatos somente após caso de uso, amostras, contrato e homologação. PDF deve ser avaliado conforme o tipo de documento e a confiabilidade da extração; não assumir que será um formato transacional universal.

### 5.5 ERP adapters e Omie

Omie é o primeiro candidato a adaptador ERP por sua relevância no caso inicial, mas não integra o MVP demonstrativo por presunção.

A parametrização do Omie é uma frente de diagnóstico/implantação no ambiente do cliente. O adaptador Omie é um componente reutilizável de software. São entregas relacionadas, mas distintas.

Antes de implementar:
- confirmar escopo e autorização;
- identificar módulos, entidades, campos e layouts relevantes;
- obter amostras representativas;
- mapear dados para o modelo interno;
- definir limites, paginação, rate limits e falhas;
- implementar inicialmente leitura autorizada;
- testar e homologar com dados aprovados.

Outros ERPs seguem o mesmo contrato, sem acoplar o core a um fornecedor.

### 5.6 API e escrita em sistemas externos

API versionada, webhooks e escrita em ERP são evolução futura, não parte do MVP.

Leitura e escrita devem ser permissões e capacidades separadas. Qualquer escrita futura exigirá escopo explícito, autorização humana adequada, menor privilégio, idempotência, validação prévia, tratamento de falha/retentativa, confirmação do sistema de destino, trilha de auditoria e plano de reversão ou compensação quando tecnicamente possível.

O dashboard não deve disparar baixa, pagamento ou alteração externa apenas porque uma reconciliação foi confirmada.

## 6. Backlog de execução e gates

As frentes abaixo organizam dependências. O status precisa ser atualizado com evidência em PRs, testes ou demonstrações; não inferir conclusão pelo nome da tarefa.

| Ordem | Frente | Resultado/critério de saída |
|---|---|---|
| G00 | Baseline e escopo | MVP, exclusões, hipótese e critérios de demonstração registrados |
| W01 | Integridade de importação | CSV/OFX, validação de datas/valores, fixtures e testes reproduzíveis |
| W02 | Persistência e identidade | autenticação, organização, isolamento, proveniência, retenção, backup e recuperação testados; ou demo explicitamente sem dados reais |
| W03 | Dashboard confiável | filtros coerentes, totais determinísticos, fonte/período/qualidade visíveis |
| W04 | Fluxo de reconciliação assistida | candidatos, revisão humana, estados, exceções e confirmação sem mutação silenciosa |
| W05 | Eventos e auditabilidade | autoria, data, evidência, justificativa, resultado e histórico consultáveis |
| W06 | Visão executiva | indicadores derivados do fluxo de reconciliação, com drill-down para evidências |
| W07 | Demonstração e aceite | dataset anonimizado, roteiro reproduzível, limitações explícitas e critérios aceitos |

**Estado herdado registrado:** W01 e ENG-01 foram documentados como aceitos no handoff anterior. Isso deve ser revalidado contra o estado atual do repositório e CI antes de usar como evidência corrente. A prontidão global do MVP não está estabelecida.

### Gates de evolução — fora do MVP

| Etapa futura | Escopo | Condição de entrada |
|---|---|---|
| E01 — novos layouts | XLSX, variantes CSV, XML, JSON e outros | necessidade real, amostras, contrato e testes |
| E02 — exportação | Export Engine e layouts de destino | processo consumidor definido e homologação |
| E03 — Omie read-only | adaptador de leitura e mapeamento | descoberta, acesso autorizado e contrato |
| E04 — outros ERPs/fontes | adaptadores adicionais | demanda e prioridade aprovadas |
| E05 — API/webhooks | interface versionada | autenticação, autorização, isolamento e documentação |
| E06 — ERP write-back | operações externas controladas | autorização separada, idempotência, auditoria e homologação |

Nenhuma etapa futura começa automaticamente por estar listada neste roadmap.

## 7. Critérios transversais de engenharia

- Contratos e schemas versionados.
- Testes unitários, fixtures anonimizadas e testes de contrato.
- Idempotência e deduplicação explícitas; nunca deduplicar silenciosamente apenas por data e valor.
- Proveniência preservada até a interface.
- Observabilidade sem exposição de dados financeiros ou segredos.
- Gestão de credenciais fora do código.
- Menor privilégio e separação de ambientes.
- Isolamento por organização antes de dados reais multiempresa.
- Erros explicáveis, com falha por registro/lote e possibilidade de reprocessamento controlado.
- Mudanças de escopo registradas antes de implementação.

## 8. Protocolo de execução sistemática

Cada item de trabalho deve conter:
1. objetivo e hipótese;
2. escopo incluído e excluído;
3. dependências, dados e permissões;
4. contrato e critérios de aceite;
5. implementação em branch/PR;
6. testes e evidências;
7. revisão técnica;
8. decisão: aceito, rejeitado ou bloqueado;
9. atualização deste handoff e do backlog.

Não avançar para integração real sem autorização e formalização aplicáveis. Não publicar em produção, alterar dados remotos ou habilitar escrita em sistemas de origem sem aprovação explícita.

## 9. Referências de produto

Este baseline operacionaliza, sem substituir, os documentos de alinhamento:
- 01 — Apresentação Executiva.
- 02 — Definição do MVP.
- 03 — Arquitetura e Roadmap.
- 04 — Decisões e Condições de Continuidade.
- 05 — Plano de Diagnóstico, Validação e Condições Comerciais.

Em caso de conflito, o escopo aprovado do MVP e as decisões formalizadas prevalecem sobre possibilidades do roadmap. Este documento é um instrumento interno de execução e não altera condições comerciais, responsabilidades ou propriedade intelectual acordadas entre as partes.
