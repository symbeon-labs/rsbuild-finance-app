# Motor de DRE gerencial — Mundo do Sabor QA

## Pipeline
1. Ler movimentações financeiras persistidas do tenant autorizado.
2. Normalizar apenas a descrição para comparação; preservar registro original.
3. Executar regras determinísticas com direção (entrada/saída), termos, tratamento e confiança.
4. Sugerir rubrica somente quando a regra for suficientemente forte e existir unidade/rateio documentado.
5. Encaminhar ambiguidades, centro de custo ausente e classificações sem rateio para revisão humana.
6. Consolidar apenas classificações aprováveis, em centavos inteiros, por rubrica, mês e unidade.
7. Manter transferências e estornos fora do resultado; separar financiamento, imobilizado, retirada e recebíveis.

## Guardrails
- PIX, TED, crédito bancário ou direção da movimentação isoladamente não significam faturamento.
- Recebimento de recebível não pode ser somado novamente ao faturamento.
- Principal de financiamento não é despesa operacional automática.
- Aquisição de ativo, retirada de sócio, aporte e transferência não entram como receita/despesa operacional.
- Sem unidade e regra de rateio comprovada, o lançamento fica em revisão.
- Valores são convertidos para centavos inteiros antes de ratear; a última unidade absorve eventual diferença de arredondamento.
- Overrides manuais exigem rubrica e justificativa; quando não houver rateio explícito, também exigem unidade.

## Rateios codificados nesta etapa
Percentuais reproduzidos da planilha DRE 2026.xlsx:
- Veículos (IPVA/multas/seguro; manutenção veicular, rastreador, pedágio e combustível): ALS/CSN 30%, P&L 20%, RRT 50%.
- Material de escritório e toner: ALS/CSN 66%, P&L 20%, RRT 14%.
- Material de limpeza: ALS/CSN 52%, P&L 11%, RRT 37%.

Outros rateios presentes na planilha (copa/mercado, farmácia, cursos, brindes, TI, gráfica, bonificação, folha por colaborador, entre outros) ainda não são aplicados pelo motor. Precisam de mapeamento por rubrica e revisão da origem antes de ativação.

## Persistência e governança das decisões
- A tabela `dre_classifications` mantém o estado atual por lançamento e organização.
- A tabela `dre_classification_events` preserva o histórico de sugestões, aprovações, reclassificações e exclusões.
- A RPC `save_dre_classification` valida sessão, membership, papel, lançamento de origem e conservação do valor rateado; estado e evento são gravados na mesma transação.
- As tabelas usam RLS por organização. Clientes autenticados não recebem escrita direta; a RPC SECURITY DEFINER é a única fronteira de escrita e valida owner/admin/operator.
- A interface permite selecionar rubrica, unidade e justificativa e consultar as decisões persistidas.
- O catálogo de regras segue versionado no código; gestão de regras por tenant e vigência ainda não foi implementada.
- A estrutura fonte possui ALS/CSN, P&L e RRT; confirmar o mapeamento jurídico/operacional do tenant antes de consolidar.
- O ambiente Supabase consultado contém zero movimentações em mundo_sabor_qa; três registros sintéticos pertencem a hub_acai_qa. Não usar esses três registros para validar Mundo do Sabor.
- Nenhum valor da planilha de referência foi copiado para o banco ou para o código.

## Homologação necessária
1. Carregar amostra autorizada do Mundo do Sabor QA.
2. Validar rubrica, natureza, unidade e rateio com o responsável financeiro.
3. Persistir overrides com ator, justificativa, data e versão da regra.
4. Executar reconciliação por mês e por unidade contra a planilha.
5. Liberar a DRE de apresentação somente após cobertura e diferenças explicadas.
