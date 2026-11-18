# Mapeamento dos datasets para operação e Sprint A

Este mapa usa o diagnóstico operacional do Mundo do Sabor e o Plano de Sprints do Ciclo 01 como contexto de domínio. Ele não substitui os registros oficiais de Projects & Sprints do workspace RSBUILD OS.

| Frente/tarefa existente | Contexto operacional | Dataset/caso | Evidência que o avaliador deve conferir |
|---|---|---|---|
| A2.1 | Leiautes BNB e Inter no normalizador | MS-QA-BANK-001 | Importação, datas, valores, direção, FITID e preservação de todos os movimentos |
| A2.2 | Escopo bancário: XP e Bradesco | Não coberto por este pacote | Decisão documentada de incluir ou excluir; não inferir suporte |
| A2.3 | Fila de exceção | MS-QA-REC-001 | Movimento não conciliado permanece visível e recuperável |
| A2.4 | Conciliação manual com justificativa | MS-QA-REC-001 | Justificativa obrigatória, autor, timestamp e histórico |
| A2.5 | Auditoria de conciliação manual | MS-QA-REC-001 | Filtro por período/autor e trilha imutável |
| A2.6 | Cinco divisões no plano de contas | MS-QA-BANK-001 + MS-QA-AR-001 | Aliases DIV-A a DIV-E segregados; conferir que não são entidades jurídicas reais |
| A2.7 | Protocolo de canhotos desenhado/aprovado | MS-QA-POD-001 | Busca por NF, origem, período e estado do documento |
| A3.1–A3.3 | Preparação e conferência de lote de baixas | MS-QA-BATCH-001 | Totais, duplicidades, títulos ausentes e itens de revisão; nenhum pagamento executado |
| A3.4–A3.5 | Captura, indexação e busca de canhotos | MS-QA-POD-001 | Recuperação por referência de NF e sinalização de documento ausente |
| A3.6 | Perfis por função nos módulos | Todos | Ações permitidas/bloqueadas por papel; trilha das ações autorizadas |

## Contexto real que orientou o modelo

O diagnóstico descreve uma operação com:
- contas em Itaú, Inter, BNB e XP; a Sprint A2 menciona BNB e Inter como leiautes prioritários e pede decisão formal sobre XP/Bradesco;
- múltiplas divisões contábeis, que neste pacote são abstraídas em cinco aliases fictícios;
- recebíveis via boletos, PIX, cheques pré-datados e cartões;
- conciliação manual como tratamento legítimo de exceções, com justificativa e autoria;
- preparação de baixas em lote separada da autorização/execução financeira;
- canhotos oriundos de loja, comércio e transportadoras, indexados por NF-e.

Os dados deste pacote não reproduzem valores, saldos, contas, documentos, nomes ou registros das planilhas originais.

## Limite de uso

O plano de sprint define demonstrações sobre dado real da operação. Portanto, estes fixtures servem para testes técnicos, preparação do QA, regressão e ensaio dos fluxos. Eles não substituem a amostra real autorizada exigida para aceite operacional quando o critério da sprint exigir dado real. Essa amostra deve ser tratada em ambiente e fluxo de acesso aprovados, sem copiar o bruto para este repositório.
