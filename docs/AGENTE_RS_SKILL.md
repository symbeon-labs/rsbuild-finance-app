# Especificação de Arquitetura: Agente RS & Futuro MCP Server

> **Status:** Ativo / Em Produção (v1.1.0)  
> **Classificação:** Inteligência de Governança Operacional e Sincronização Assistida com ERP  
> **Propósito:** Atuar como o cérebro operacional do **RSBUILD OS**, adaptando-se às regras de negócio específicas de cada cliente (distribuidoras, indústrias e atacados), auditando fluxos em tempo real e orquestrando integrações seguras com ERPs (Omie, Totvs, SAP).

---

## 1. Visão Geral e Filosofia do Agente RS

O **Agente RS** não é um chatbot de conversação genérico. Ele é um **Agente de Execução Assistida (*Human-in-the-Loop*)** desenhado para resolver o abismo entre:
1. **A Realidade Humana da Operação:** Mensagens informais no WhatsApp, canhotos físicos de papel assinados na doca, extratos bancários com descrições truncadas.
2. **A Rigidez Burocrática do ERP:** Cadastros complexos de produtos, regras fiscais rígidas, amarrações de plano de contas e exigência de dados estruturados.

O Agente RS absorve o atrito da operação, traduz e valida os dados através de algoritmos determinísticos e apresenta **planos de ação já mastigados** para a alçada humana do gestor ou operador responsável.

```mermaid
flowchart LR
    A["Operação Real (WhatsApp, Doca, Extratos)"] --> B["Agente RS (Contexto & Auditoria)"]
    B --> C["Plano de Ação Assistido"]
    C --> D["Aprovação do Operador Humano"]
    D --> E["Sincronização ERP (Omie)"]
```

---

## 2. Contexto Operacional por Cliente (Personalização Dinâmica)

Cada organização possui dinâmicas operacionais distintas. O Agente RS armazena e respeita o perfil do cliente:

### Caso 1: Hub Açaí (Distribuição de Sorvetes e Polpas)
* **Regras de Negócio do Catálogo:**
  * Produtos comercializados em caixas físicas de 10L (`ACAI-TRAD-10L`, `ACAI-BAN-10L`, `ACAI-MOR-10L`, `ACAI-CUPU-10L`, `ACAI-TRUF-10L`).
  * Fator de conversão: 1 caixa = 1 volume físico.
* **Capacidade de Frete e Expedição:**
  * Veículo principal: **Caminhão Hyundai HR**.
  * Capacidade máxima de carregamento: **350 caixas físicas**.
  * Gatilho de alerta: Ocupação > 85% exige alerta de saturação ou acionamento de veículo auxiliar.
* **Condições de Pagamento:**
  * Pix na entrega, boleto faturado 7 dias, boleto 14 dias.

### Caso 2: Mundo do Sabor (Indústria & Distribuição de Alimentos)
* **Regras de Faturamento e Duplicatas:**
  * Títulos a receber emitidos contra supermercados, padarias e mercearias.
* **Blindagem Jurídica de Cobrança (Lei nº 5.474/1968, Art. 15):**
  * Toda duplicata mercantil para protesto exige comprovação de entrega (canhoto assinado).
  * O Agente RS aplica **bloqueio preventivo** para qualquer título vencido cujo canhoto de NF-e não esteja registrado na doca.

---

## 3. Matriz de Capacidades do Agente RS

| Capacidade | Tipo | Entrada | Saída / Ação |
| :--- | :--- | :--- | :--- |
| **`parse_whatsapp_order`** | Semântico | Texto livre ou transcrição de áudio do cliente | Pedido estruturado (SKU, qtd, caixas, total R$, método de pgto) |
| **`compute_fleet_cubage`** | Determinístico | Lista de pedidos do dia | Ocupação percentual do caminhão HR (x / 350 cx) |
| **`audit_sefaz_nfe_key`** | Validação Fiscal | Chave de acesso de 44 dígitos | Validação de UF, data, CNPJ, modelo e dígito Módulo 11 |
| **`evaluate_protest_risk`** | Compliance Jurídico | NF-e, vencimento, canhoto de entrega | Parecer: `Apto a Protesto`, `Bloqueio Preventivo` ou `Atenção Prazo` |
| **`reconcile_bank_statement`** | Algorítmico | Extrato OFX/CSV vs Títulos a Receber | Correspondência bancária (exata, documental, divergente) |
| **`build_batch_settlement`** | Integração | Títulos conciliados com sucesso | Arquivo/Payload de liquidação em lote para o Omie |
| **`generate_executive_memo`** | Síntese Executiva | KPIs consolidados de Finanças e Doca | Diagnóstico estratégico para conselho de administração |

---

## 4. Governança e Transição para MCP Server (Model Context Protocol)

O Agente RS foi estruturado para ser desacoplado da interface visual e transformado em um **MCP Server Oficial**, permitindo que LLMs corporativas externas (Claude, Gemini, ChatGPT) interajam diretamente com o RSBUILD OS através de ferramentas padronizadas.

### Ferramentas Expostas no Protocolo MCP:

```typescript
// Exemplo de Tools expostas pelo Agente RS via MCP:
interface RSBuildMcpTools {
  // 1. Ingestão de pedidos via WhatsApp
  parseOrderMessage(params: { rawText: string; customerHint?: string }): Promise<ParsedOrderResult>;

  // 2. Consulta de ocupação da expedição
  getFleetCapacity(params: { date: string }): Promise<FleetCapacityResult>;

  // 3. Auditoria de duplicatas e risco de protesto
  auditReceivableRisk(params: { titleId?: string; nfeNumber?: string }): Promise<ProtestRiskResult>;

  // 4. Preparação de lote para ERP
  prepareOmieSyncBatch(params: { batchType: "settlements" | "sales_orders" }): Promise<SyncBatchResult>;
}
```

---

## 5. Princípios de Confiança Operacional
1. **Nunca executar escrituração no ERP sem confirmação humana:** O Agente RS prepara o lote com precisão de centavos, mas a decisão de envio ao ERP permanece sob alçada do operador ou diretor.
2. **Auditabilidade Total:** Toda recomendação do Agente RS traz a fundamentação (ex: citação do artigo da lei de duplicatas, divergência de valor no extrato bancário).
3. **Resiliência a Falhas:** Se o ERP estiver indisponível ou fora do ar, o Agente RS opera normalmente em modo de contingência através de arquivos canônicos `.OFX` e `.CSV`.

