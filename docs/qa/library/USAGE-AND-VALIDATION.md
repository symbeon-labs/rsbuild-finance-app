# Uso e validação da biblioteca

## Ambiente
Somente Mundo do Sabor QA e Sandbox isolado. Nunca Production. Não utilizar a biblioteca para Hub Açaí.

## Importação controlada
1. Confirmar workspace/organização e ambiente antes de iniciar.
2. Registrar dataset ID, versão e hash SHA-256 calculado no momento da execução.
3. Importar somente em organização de QA autorizada e com possibilidade de limpeza/reinicialização.
4. Conferir contagem de linhas, totais, rejeições e duplicidades contra manifest.json.
5. Capturar evidência sem tokens, cookies, credenciais ou dados de terceiros.
6. Registrar a execução na avaliação QA vinculada ao projeto, sprint, tarefa e deployment/commit.
7. Limpar/reinicializar apenas os dados sintéticos daquela execução, preservando trilha e evidência.

## Validações aritméticas de referência
- bank-statements-synthetic.csv: 7 linhas; créditos R$ 2.950,00; débitos R$ 1.630,00; líquido R$ 1.320,00.
- receivables-synthetic.csv: 6 títulos; total R$ 5.150,00; 4 abertos e 2 vencidos.
- batch-settlement-synthetic.csv: 5 itens; 2 preparáveis; 3 em revisão/rejeitados; payment_authorized=false em todas as linhas.
- proof-of-delivery-index-synthetic.csv: 3 documentos indexados e 1 documento ausente.

## Regras para aceite
- Um teste automatizado verde não equivale a homologação funcional.
- Um resultado sintético aprovado não prova correspondência com o processo real.
- O critério de aceite operacional continua sendo o definido no registro oficial da sprint.
- Quando o plano exigir dado real, somente utilizar amostra autorizada e minimizada em fluxo controlado; não transformar dados brutos em fixtures versionadas.
- Nenhum arquivo de lote pode disparar pagamento. Esta biblioteca testa preparação e conferência apenas.

## Integridade
Calcular SHA-256 de cada arquivo antes da carga e guardar o valor na evidência da execução. Alterações devem gerar nova versão do dataset e atualização do manifesto.
