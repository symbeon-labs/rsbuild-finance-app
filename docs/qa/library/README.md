# RSBUILD QA Data Library — Mundo do Sabor

Versão: 1.0.0  
Classificação: Dados sintéticos para homologação  
Escopo inicial: Mundo do Sabor QA — Financeiro e Reconciliação  
Origem estrutural: diagnóstico operacional e plano do Ciclo 01 mantidos sob custódia Symbeon. Nenhum registro bruto de cliente foi copiado para este diretório.

## Objetivo
Disponibilizar datasets reproduzíveis para testar fluxos financeiros e de reconciliação com a estrutura real da operação, sem transportar dados pessoais, bancários ou financeiros reais para QA.

## Regra de segurança
- Todos os nomes, documentos, identificadores, datas e valores nos arquivos desta pasta são fictícios.
- Não usar planilhas originais de clientes, saldos reais, números de contas, CNPJs, nomes de funcionários, fornecedores ou clientes.
- Não carregar dados reais no QA compartilhado sem autorização específica, minimização, classificação e ambiente aprovado.
- Nunca misturar dados de Mundo do Sabor e Hub Açaí.
- Nenhum dataset autoriza pagamento, baixa real, escrita no ERP ou execução de operação financeira.
- Os datasets são para QA/Sandbox; nunca Production.
- Os originais permanecem na custódia restrita e não devem ser replicados para este projeto.

## Contexto operacional representado
O modelo sintético contempla:
- conciliação multicontas com Itaú, Inter e BNB;
- divisões/entidades operacionais distintas, representadas por aliases DIV-A a DIV-E;
- recebíveis por boleto, PIX, cheque pré-datado e cartão;
- correspondências exatas, parciais, não correspondidas e duplicadas;
- decisões manuais com justificativa e trilha de auditoria;
- preparação de lote de baixas sem executar pagamento;
- protocolo de canhotos indexados por NF-e.

Os aliases não correspondem a CNPJs, contas, nomes ou entidades jurídicas reais.

## Inventário
| Dataset | Arquivo | Finalidade |
|---|---|---|
| MS-QA-BANK-001 | bank-statements-synthetic.csv | Extratos sintéticos multicontas |
| MS-QA-AR-001 | receivables-synthetic.csv | Títulos/recebíveis sintéticos |
| MS-QA-REC-001 | reconciliation-expected-results.csv | Oráculo esperado para matching e exceções |
| MS-QA-BATCH-001 | batch-settlement-synthetic.csv | Preparação e rejeição de lote, sem pagamento |
| MS-QA-POD-001 | proof-of-delivery-index-synthetic.csv | Índice sintético de canhotos, sem imagem real |

## Reprodutibilidade
Cada dataset possui ID, versão, quantidade de linhas e expectativa documentada em manifest.json. Execute node scripts/qa/verify-synthetic-library.mjs para validar os totais e gerar os SHA-256 de cada arquivo. O hash deve ser registrado na evidência da execução. Mudança de conteúdo exige nova versão.

## Relação com planejamento
A biblioteca apoia tarefas já existentes do Ciclo 01 — especialmente Sprint A2 (A2.1 a A2.6) e prepara fixtures para A3 (A3.1 a A3.6). Não cria sprint, tarefa, escopo contratual ou critério de aceite novo. O vínculo operacional definitivo deve apontar para os registros correspondentes em Projects & Sprints no workspace RSBUILD OS.

## Resultado esperado
O avaliador consegue repetir cenários, comparar resultado observado com resultado esperado e anexar evidências à avaliação QA vinculada ao projeto/sprint/entregável correspondente.
