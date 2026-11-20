# Lições Aprendidas e Decisões de Arquitetura — Reconciliação Financeira

**Origem:** homologação Mundo do Sabor QA (janela 10–17/nov/2026), pacote de insumos `INSUMOS_FINANCAS_RECONCILIACAO` e auditoria A1 v3.
**Status:** documento vivo — revisado a cada novo cliente onboardado.
**Princípio:** o primeiro cliente prova o modelo; os próximos reutilizam o motor e configuram o tenant.

---

## 1. Decisões de arquitetura confirmadas pelos dados reais

### 1.1 Título primeiro, banco depois

O extrato bancário **não é fonte de classificação**. A categoria autoritativa é a do título no ERP (Omie). Evidência: 74% dos 109 movimentos do QA casaram com títulos Omie por valor+data+contraparte; os 26% restantes são fluxos que nunca geram título (snapshots de saldo, rendimentos, liquidações agregadas de adquirente, vendas PDV sem NF).

**Regra:** importar títulos → conciliar banco contra títulos → exceções vão para fila de revisão humana. Nunca classificar rubrica DRE olhando só a descrição do extrato.

### 1.2 "PIX recebido" ≠ faturamento

A maioria das entradas é liquidação de recebível. No QA: R$ 131,7 mil em entradas vs R$ 4 títulos a receber — ou seja, recebimentos superam títulos porque incluem vendas PDV e liquidações de cartão. Classificar entrada como `REV_SALES` duplica receita quando o faturamento já foi reconhecido por competência.

**Regra do engine (confirmada):** `FATURAMENTO REAL` e `RECEBÍVEIS` são seções distintas e nunca se somam.

### 1.3 O extrato contém não-movimentos

Snapshots OFX "SALDO TOTAL DISPONÍVEL DIA" (5 registros, R$ 81,9 mil no QA) são saldo de fechamento, não movimentação. A view `dre_cash_movements_v1` e o fix de OFX opening-balance já filtram isso — manter o filtro em todo pipeline de importação.

### 1.4 Liquidações de adquirente são agregadas

Recebimentos de cartão (P&L, Rede/RedeCard) chegam ao banco em lote, enquanto o Omie registra por NF. Matching 1:1 por valor falha — é necessário matching por agregação/janela ou por conciliação de lote.

### 1.5 Dicionário de categorias é dado de primeira classe

O Omie exporta categorias como texto livre + nomes de fornecedor misturados (408 combinações distintas observadas). A classificação automática exige **tabela de mapeamento categoria→rubrica** versionada (decisão pendente D-08), não heurística de palavras-chave no description do banco.

---

## 2. Lições sobre qualidade de dados do cliente

| Achado | Evidência | Lição |
|---|---|---|
| OFX ≠ PDF no mesmo extrato | Safra: divergência de saldo (CRÍTICA); Itaú: soma líquida R$ 93 mil diverge do PDF | Todo pacote entra em **quarentena** até reconciliar as duas fontes |
| Duplicidade real em títulos | PEREIRA GELADOS 2× R$ 1.849,43 mesmo dia; recebimentos repetidos por cliente+NF | Matching de importação precisa de chave de deduplicação + detecção de suspeita, não confiar no ERP |
| Recorrentes sobrepostos | 72/72 linhas coincidentes entre "em aberto" e "recorrentes" | Recorrência é **atributo/projeção**, não título novo — modelar separado |
| Regras de negócio conflitantes | POP: "15 dias" vs "sem prazo para negativar" | Conflito de política exige decisão formal do cliente antes de automação |
| Movimentos sem lastro | Posto Vida Nova, L2P R$ 10.450, CEF R$ 440 sem título Omie correspondente | Pode ser outro CNPJ/conta ou lançamento não realizado — vira pergunta para o financeiro, não erro do sistema |

---

## 3. O que funcionou bem (manter)

- **RPC `save_dre_classification` auditada** — 109 classificações em minutos, cada uma com evento `approved`/`reclassified`/`excluded`, `reviewed_by`, `rule_version`. Classificação em massa é viável sem bypassar auditoria.
- **Rateio documentado** — regras FIXO/MENSAL do workbook do cliente (veículos 30/20/50, escritório 66/20/14, limpeza 52/11/37) viraram allocations exatas validadas no banco (soma = amount_minor).
- **Status `review` para ambiguidade real** — Contart Contabilidade ficou pendente por falta de rubrica própria; o sistema não forçou classificação errada.
- **Quarentena A1** — o processo de manifesto + SHA-256 + validação cruzada impediu importação de dados sabidamente divergentes.

---

## 4. Decisões pendentes que bloqueiam escala (D-01 a D-09)

Estas são **decisões de negócio do cliente**, não técnicas. O sistema está pronto; falta o financeiro responder:

1. Conta/período correto dos extratos Safra e divergência Itaú OFX↔PDF
2. Data-base e relação entre contas a pagar em aberto vs em atraso
3. Recorrentes como atributo ou títulos futuros
4. Divergência interna na aba RRT da DRE 2026 (fórmulas/rateios)
5. Regras conflitantes do POP de cobrança (prazos, negativação, bloqueio)
6. Regra de devolução e conta corrente da "Caixinha Prata"
7. Dicionário oficial das categorias Omie → plano de contas RSBUILD
8. Originais PDF/OFX para revalidação dos saldos

**Recomendação:** transformar D-01..D-09 em pauta formal com o financeiro antes de qualquer nova importação. Cada resposta vira regra configurável no tenant.

---

## 5. Roadmap de reuso (por que a 2ª empresa é mais barata)

| Camada | Mundo do Sabor (agora) | Próximos clientes |
|---|---|---|
| Engine de matching título↔banco | ✅ provado (74% match) | reutiliza direto |
| Fila de revisão + auditoria | ✅ provada | reutiliza direto |
| DRE multi-unidade + rateios | ✅ estrutura validada | adaptar rateios/unidades |
| Dicionário de categorias | 🔶 parcial (heurística) | tabela por ERP |
| Regras setoriais (POP, devolução) | ⏳ pendente D-06/D-07 | configurar por tenant |
| Onboarding de dados | 🔶 quarentena manual | pipeline A1 formalizado |

**Meta:** onboarding do próximo cliente = configurar categorias, rateios e regras — não desenvolver.

---

## 6. Dívida técnica identificada nesta homologação

- `dre_classifications` depende de rateio manual quando a rubrica não tem regra documentada — falta fallback configurável por tenant
- Engine de classificação por palavra-chave (`lib/dre-engine.ts`) deve ser **substituída/complementada** por lookup no dicionário de categorias Omie antes de produção
- Matching banco↔título hoje é manual/SQL — candidato a RPC `reconciliation_engine` com score de confiança
- 1 registro permanece em `review` (Contart) — precisa de rubrica "serviços profissionais" ou decisão de rateio

---

*Documento gerado a partir da sessão de homologação QA Mundo do Sabor — 109 registros classificados, 1.361 títulos Omie cruzados, pacote A1 v3 em quarentena.*
