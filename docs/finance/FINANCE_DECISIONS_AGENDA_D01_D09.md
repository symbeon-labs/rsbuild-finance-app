# Pauta de Decisões Financeiras — D-01 a D-09

**Cliente:** Mundo do Sabor · **Preparado por:** RSBUILD · **Data:** 2026-11-19
**Objetivo:** destravar a quarentena A1 e o onboarding dos dados financeiros. Cada item traz a evidência já levantada, a recomendação técnica da RSBUILD e a pergunta objetiva para o financeiro.

---

## D-01 · Conta e período dos extratos Safra — divergência de saldo

**Pergunta:** qual conta e período o extrato Safra PJ cobre, e por que o saldo final difere do PDF?

**Evidência levantada:**
- OFX: conta `422 / 00085887641`, CHECKING, 10–17/nov/2026, **285 transações**, saldo final **R$ 441.380,79**, movimento líquido +R$ 1.620,70
- A1 v2 reportou divergência entre saldo anterior/final do PDF e o OFX

**Recomendação RSBUILD:** tratar como conta separada da Itaú (hoje o QA só importou Itaú). Antes de importar Safra, o financeiro confirma conta, período e saldo de abertura/fechamento assinado.

**Resposta necessária:** confirmar conta/período ou enviar extrato corrigido.

---

## D-02 · Itaú — diferença entre soma dos movimentos e saldo do PDF

**Status: ✅ RESOLVIDO COM EVIDÊNCIA — aguardando só confirmação**

**Evidência levantada:** existem **dois arquivos OFX** da mesma conta (`0341 / 7421996567`, 10–17/nov):
- Arquivo com **110 transações**: soma líquida R$ 93.028,37 — contém **1 lançamento espúrio**: `09/11 +R$ 78.371,49` sem nome (saldo de abertura registrado como transação)
- Arquivo com **109 transações**: soma líquida R$ 14.656,88 — **correto**, é o que está no QA

Cálculo: 293.771,54 (entradas c/ espúrio) − 200.743,17 (saídas) = 93.028,37 · removendo o espúrio: 215.400,05 − 200.743,17 = **14.656,88** ✓

**Recomendação RSBUILD:** adotar o arquivo de 109 transações como fonte; o arquivo de 110 é a versão bruta com o saldo de abertura mal classificado. O sistema já filtra "SALDO ANTERIOR/DISPONÍVEL" — a regra deve ser reforçada na importação OFX.

**Resposta necessária:** confirmar que a conta é a mesma e que o arquivo de 109 é o oficial.

---

## D-03 · Contas a pagar em aberto × em atraso — data-base e critérios

**Pergunta:** qual a data-base de cada relatório e por que um título aparece em um mas não no outro?

**Evidência levantada:** Omie exporta 4 planilhas de pagar (pagos 575, aberto 210, atraso 81, recorrentes 72) e 3 de receber. A1 v2 não encontrou interseção pela chave conservadora — mas isso não prova exclusividade mútua.

**Recomendação RSBUILD:** assumir que "em aberto" = a vencer + atraso (visão consolidada) e "em atraso" = subset por vencimento < hoje. Pedir ao financeiro os **filtros exatos de cada exportação**.

**Resposta necessária:** data-base e critérios de cada relatório Omie.

---

## D-04 · Contas a pagar recorrentes — atributo ou títulos futuros?

**Pergunta:** as 72 linhas de "recorrentes" são projeções (aluguel, folha, assinaturas) ou títulos a vencer?

**Evidência levantada:** todas as 72 linhas têm valor placeholder R$ 1,00 e vencimentos mensais futuros (ex.: Sem Parar todo dia 10) — são **regras recorrentes**, não títulos.

**Recomendação RSBUILD:** modelar como **template de recorrência** (frequência, valor, conta, categoria) que gera títulos mensais — nunca importar como título. Isso evita a sobreposição 72/72 detectada na auditoria.

**Resposta necessária:** confirmar que recorrentes = projeção e informar quais geram título real vs despesa fixa fora do AP.

---

## D-05 · Divergência interna na DRE 2026 — aba RRT

**Pergunta:** explicar a diferença de ~R$ 9 mil no ANUAL da aba RRT e os meses sem rateio.

**Evidência levantada:** ANUAL consolida ALS/CSN + P&L + RRT; a aba RRT tem rateios próprios (ex.: "Aluguel metade ALS", "Energia Solar/ALS") que podem não fechar com a soma das unidades. O A1 marcou como divergência interna relevante.

**Recomendação RSBUILD:** o financeiro envia a **memória de cálculo** da aba RRT (fórmulas do Excel). Enquanto isso, a DRE gerencial do sistema usa apenas lançamentos classificados — divergência do Excel legado não contamina a base.

**Resposta necessária:** explicação da divergência RRT ou planilha com fórmulas.

---

## D-06 · POP de cobrança — conflito de prazos

**Status: 🔴 CONFLITO REAL DOCUMENTADO — requer decisão formal**

**Evidência levantada (POP Contas a receber.XLSX):**
- Aba "Cobrança": 1º contato **2 dias**, 2º **6 dias**, 3º **10 dias**, negativação/protesto **15 dias**
- Aba "Negativação e Protesto": **"Não existe prazo para se negativar ou protestar"**
- Regra de bloqueio: cliente com **mais de 2 contas atrasadas** → bloquear (não 1)
- Custo: R$ 6,00 negativação + R$ 6,00 protesto — **nunca receber da empresa** (custo do cliente)

**Interpretação técnica:** "15 dias" é o alvo operacional da régua de cobrança; "não existe prazo" provavelmente significa que não há prazo legal limite — ou seja, negativação pode ocorrer antes/depois dos 15 dias conforme critério. **Não é contradição lógica, mas é ambíguo para automação.**

**Recomendação RSBUILD:** adotar régua conservadora — contatos 2/6/10 dias, alerta de negativação aos 15 dias, bloqueio automático com ≥2 títulos vencidos, negativação/protesto sempre com aprovação humana + custo lançado no cliente. Negativação/protesto **nunca automático** (efeito jurídico irreversível parcial).

**Resposta necessária:** confirmar a régua oficial e quem aprova negativação/protesto.

---

## D-07 · Devolução e "Caixinha Prata" — modelo de dados

**Pergunta:** como modelar devolução de venda e a operação especial Caixinha Prata?

**Evidência levantada (POP):**
- **Devolução:** gera par de lançamentos — um crédito loja (desconto 100% no recebível já pago) + novo título do pedido novo. Fluxo: vendedora sobe NF de devolução + NF do novo pedido
- **Caixinha Prata:** operação especial — na baixa de cheque, a conta corrente depende do tipo: "NORMAL" (conta cheque) ou "PRATA" (caixinha prata)

**Recomendação RSBUILD:**
- Devolução → evento `return` vinculado ao título original + novo título, com razão de crédito — nunca edição do título pago
- Caixinha Prata → flag `settlement_account_type` no título/baixa ('normal' | 'prata') — afeta qual conta corrente recebe

**Resposta necessária:** confirmar os dois fluxos com exemplos reais (1 devolução, 1 baixa prata).

---

## D-08 · Dicionário de categorias Omie → plano RSBUILD

**Status: 🟡 EM ANDAMENTO — maior desbloqueio técnico**

**Evidência levantada:** 408 combinações fornecedor+categoria; categorias reais identificadas incluem "Compras de Mercadorias para Revenda", "Frete sobre vendas/compras", "Contabilidade", "Benefício Flash", "Assistência Médica", "Energia Elétrica", "Pedagio", "DARF - PIS/COFINS", "FGTS", "Salários", "Adiantamentos", "Cartão Empresarial", "ICMS Regime Normal", "Manutenção de TI" etc. — mais nomes de fornecedor usados como categoria.

**Recomendação RSBUILD:** entregamos uma **planilha de mapeamento proposta** (categoria Omie → rubrica DRE + unidade sugerida) para o financeiro validar/corrigir. Isso alimenta a tabela de tradução que substituirá a heurística de texto do engine.

**Resposta necessária:** validar a planilha de mapeamento (próximo entregável RSBUILD).

---

## D-09 · Originais PDF/OFX para revalidação de saldos

**Status: 🟡 PARCIALMENTE RESOLVIDO**

**Evidência levantada:** os arquivos fonte **estão na pasta** — `1. Extratos bancários/` contém OFX+PDF do Itaú (2 versões), Safra e Omie Cash. D-02 já foi explicado com os próprios arquivos.

**Recomendação RSBUILD:** manter os originais como evidência imutável por pacote de importação (já previsto no modelo `source_artifacts` + SHA-256). Para D-01/D-02 basta o financeiro apontar qual arquivo é oficial.

**Resposta necessária:** identificação do arquivo oficial por conta (Itaú: provavelmente o de 109 transações).

---

## Resumo executivo para a reunião

| # | Decisão | Bloqueio | Recomendação RSBUILD | Esforço do financeiro |
|---|---|---|---|---|
| D-01 | Safra conta/período | Importação Safra | Confirmar conta ou enviar extrato correto | 15 min |
| D-02 | Itaú OFX×PDF | ~~Importação Itaú~~ | **Resolvido**: arquivo de 109 transações é o correto | 5 min p/ confirmar |
| D-03 | AB aberto×atraso | Consolidação AP | Informar filtros/data-base dos relatórios | 15 min |
| D-04 | Recorrentes | Carga AP | Tratar como template, não título | 10 min |
| D-05 | DRE RRT | DRE gerencial | Enviar memória de cálculo da aba RRT | 30 min |
| D-06 | POP cobrança | Aut. cobrança | Régua 2/6/10d + alerta 15d + bloqueio ≥2 + humano na negativação | Decisão formal |
| D-07 | Devolução/Caixinha | Baixa automática | Modelo `return` + flag conta corrente | 2 exemplos |
| D-08 | Categorias Omie | Classificação | Receber planilha de mapeamento p/ validar | Validar planilha |
| D-09 | Originais | Certificação | Arquivos já disponíveis na pasta | Apontar oficiais |

**Próximo entregável RSBUILD:** planilha de mapeamento categorias Omie → rubricas DRE (D-08) — é o item de maior alavancagem técnica.
