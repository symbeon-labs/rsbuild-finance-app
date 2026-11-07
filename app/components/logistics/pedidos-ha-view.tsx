"use client";

import { ParsedWhatsAppOrder } from "@/lib/orders";
import { formatCurrency } from "@/lib/finance";
import { Metric, EmptyState } from "@/app/components/finance/common";

interface PedidosHaViewProps {
  orders: ParsedWhatsAppOrder[];
  hubAcaiMetrics: {
    totalOrders: number;
    totalBoxes: number;
    totalRevenue: number;
    hrOccupancy: number;
  };
  whatsAppText: string;
  parsedPreview: ParsedWhatsAppOrder | null;
  onWhatsAppTextChange: (text: string) => void;
  onParseMessage: () => void;
  onConfirmOrder: () => void;
  onReloadSample: () => void;
  onExportOmieCsv: () => void;
  onClearText: () => void;
  onLoadExample: () => void;
}

export function PedidosHaView({
  orders,
  hubAcaiMetrics,
  whatsAppText,
  parsedPreview,
  onWhatsAppTextChange,
  onParseMessage,
  onConfirmOrder,
  onReloadSample,
  onExportOmieCsv,
  onClearText,
  onLoadExample
}: PedidosHaViewProps) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">OPERAÇÃO DE VENDAS & EXPEDIÇÃO</div>
          <h1>Padronizador Inteligente de Pedidos WhatsApp</h1>
          <p>
            Conversão automática de texto livre em pedidos estruturados com grade de produtos, quantidades e contagem de volumes para expedição.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button className="primary-button" onClick={onExportOmieCsv}>
            <span>⤓</span> Exportar Pedidos para ERP (CSV)
          </button>
        </div>
      </div>

      <div className="metric-grid">
        <Metric
          label="Carga do Dia"
          value={`${hubAcaiMetrics.totalBoxes} caixas`}
          tone="neutral"
          detail={`${hubAcaiMetrics.totalOrders} pedidos na esteira`}
          icon="📦"
        />
        <Metric
          label="Faturamento do Dia"
          value={formatCurrency(hubAcaiMetrics.totalRevenue)}
          tone="positive"
          detail="Receita bruta dos pedidos decifrados"
          icon="💰"
        />
        <Metric
          label="Ocupação Caminhão HR"
          value={`${hubAcaiMetrics.hrOccupancy}%`}
          tone={hubAcaiMetrics.hrOccupancy > 90 ? "negative" : "positive"}
          detail={`${hubAcaiMetrics.totalBoxes} / 350 caixas de capacidade`}
          icon="🚚"
        />
        <Metric
          label="Produtividade Atendimento"
          value="Zero Digitação"
          tone="positive"
          detail="Elimina contagem manual no dedo (C1)"
          icon="⚡"
        />
      </div>

      <div className="dashboard-grid" style={{ marginBottom: "20px" }}>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Ingestão de Mensagem do WhatsApp</h2>
              <p>Cole o texto da conversa ou áudio transcrito do cliente.</p>
            </div>
            <button
              className="secondary-button"
              style={{ fontSize: "10px", padding: "6px 10px" }}
              onClick={onLoadExample}
            >
              Carregar Exemplo Real
            </button>
          </div>
          <textarea
            style={{
              width: "100%",
              minHeight: "140px",
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid var(--line)",
              fontSize: "12px",
              fontFamily: "inherit",
              resize: "vertical",
              outline: "none",
              background: "var(--surface)",
              color: "var(--ink)"
            }}
            placeholder="Ex: Bom dia! Aqui é o Marcos do Açaí do Parque. Manda 10 caixas do tradicional 10L e 5 de banana pra amanhã cedo..."
            value={whatsAppText}
            onChange={(e) => onWhatsAppTextChange(e.target.value)}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button className="secondary-button" onClick={onClearText}>
              Limpar
            </button>
            <button className="primary-button" onClick={onParseMessage}>
              <span>⚡</span> Decifrar Mensagem de Pedido
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Pré-visualização Estruturada</h2>
              <p>Validação da interpretação semântica antes de confirmar.</p>
            </div>
            {parsedPreview && (
              <span
                className="status-pill"
                style={{
                  background:
                    parsedPreview.confidence === "alta"
                      ? "var(--green-bg, #DCFCE7)"
                      : "var(--yellow-bg, #FEF3C7)",
                  color:
                    parsedPreview.confidence === "alta"
                      ? "var(--green-text, #15803D)"
                      : "var(--yellow-text, #92400E)",
                  fontWeight: 700
                }}
              >
                Confiança: {parsedPreview.confidence.toUpperCase()}
              </span>
            )}
          </div>

          {parsedPreview ? (
            <div>
              <div style={{ marginBottom: "12px", fontSize: "12px" }}>
                <strong>Cliente:</strong> {parsedPreview.customerName}
                <span style={{ display: "block", color: "var(--muted)", fontSize: "11px", marginTop: "2px" }}>
                  Condição: {parsedPreview.paymentMethod.replace("_", " ").toUpperCase()} · Total: {parsedPreview.totalBoxes} caixas · {formatCurrency(parsedPreview.totalAmount)}
                </span>
              </div>

              <div className="table-wrap" style={{ maxHeight: "150px" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Sabor / Produto</th>
                      <th className="align-right">Qtd</th>
                      <th className="align-right">Caixas</th>
                      <th className="align-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedPreview.items.map((it, idx) => (
                      <tr key={idx}>
                        <td>
                          <strong>{it.flavor}</strong>{" "}
                          <span style={{ fontSize: "10px", color: "var(--muted)" }}>({it.productName})</span>
                        </td>
                        <td className="align-right">{it.quantity}</td>
                        <td className="align-right font-semibold">{it.boxesTotal} cx</td>
                        <td className="align-right font-semibold">{formatCurrency(it.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: "14px", display: "flex", justifyContent: "flex-end" }}>
                <button className="primary-button" onClick={onConfirmOrder}>
                  <span>✓</span> Confirmar e Adicionar à Carga do Dia
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ minHeight: "150px" }}>
              <div className="empty-icon">📱</div>
              <strong>Nenhuma mensagem processada</strong>
              <p>Cole o texto do WhatsApp ao lado e clique em decifrar para visualizar a decomposição dos itens.</p>
            </div>
          )}
        </section>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Fila de Pedidos do Dia (Expedição & Carregamento)</h2>
            <p>Consolidação da carga para os veículos de entrega e expedição logística.</p>
          </div>
          <button className="secondary-button" onClick={onReloadSample}>
            Restaurar Amostra de Demonstração
          </button>
        </div>

        {orders.length > 0 ? (
          <div className="table-wrap">
            <table className="sticky-actions">
              <thead>
                <tr>
                  <th>Cód. Pedido</th>
                  <th>Cliente / Sacado</th>
                  <th>Sabores e Quantidades</th>
                  <th className="align-right">Caixas Físicas</th>
                  <th>Pagamento</th>
                  <th className="align-right">Valor Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((ord) => (
                  <tr key={ord.id}>
                    <td>
                      <strong>{ord.id.slice(0, 12)}</strong>
                    </td>
                    <td>
                      <div className="description-cell">{ord.customerName}</div>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", maxWidth: "340px" }}>
                        {ord.items.map((it, i) => (
                          <span
                            key={i}
                            style={{
                              fontSize: "10px",
                              background: "var(--surface-raised, #F1F5F9)",
                              color: "var(--ink)",
                              padding: "3px 7px",
                              borderRadius: "4px",
                              border: "1px solid var(--line)"
                            }}
                          >
                            {it.quantity}x {it.flavor}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="align-right font-semibold" style={{ color: "var(--rsbuild-terracotta)" }}>
                      {ord.totalBoxes} cx
                    </td>
                    <td>
                      <span
                        className="status-pill"
                        style={{ background: "var(--surface-raised, #F1F5F9)", color: "var(--ink)" }}
                      >
                        {ord.paymentMethod.replace("_", " ").toUpperCase()}
                      </span>
                    </td>
                    <td className="align-right font-semibold">{formatCurrency(ord.totalAmount)}</td>
                    <td>
                      <span
                        className="status-pill"
                        style={{
                          background: "var(--green-bg, #DCFCE7)",
                          color: "var(--green-text, #15803D)"
                        }}
                      >
                        {ord.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="📱"
            title="Nenhum pedido na esteira"
            text="Decifre novas mensagens do WhatsApp para montar a carga de expedição."
            action="Carregar Pedidos de Exemplo"
            onAction={onReloadSample}
          />
        )}
      </section>

      <div className="inline-note" style={{ marginTop: "16px" }}>
        <strong>Automação de Entrada de Pedidos:</strong> Pedidos recebidos via mensagem de WhatsApp de clientes são interpretados em lote, decodificando produtos, quantidades e totalizando volumes físicos automaticamente para capacidade dos veículos de entrega e geração dos pedidos de venda integrados ao ERP.
      </div>
    </>
  );
}

