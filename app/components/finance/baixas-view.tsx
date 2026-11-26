"use client";

import { useRef, useState, useMemo } from "react";
import { formatCurrency, formatDate } from "@/lib/finance";
import { ReceivableTitle, ReconciliationMatch } from "@/lib/reconciliation";
import { DeliveryProof } from "@/lib/delivery";
import { canApproveBatchSettlement, getRoleMetadata } from "@/lib/permissions";
import { Metric, EmptyState } from "./common";

interface BaixasViewProps {
  titles: ReceivableTitle[];
  matches: ReconciliationMatch[];
  matchStats: {
    ready: ReconciliationMatch[];
    divergent: ReconciliationMatch[];
    pending: ReconciliationMatch[];
    totalReadyAmount: number;
  };
  proofs?: DeliveryProof[];
  role?: string;
  onImportTitlesFile: (file: File) => void;
  onConfirmSettlementInSession: () => void;
  onExportBatchSettlement: () => void;
  onLoadOperationalData?: () => void;
  onSyncOmieTitles?: () => Promise<void> | void;
  isSyncingOmie?: boolean;
}

type NatureFilter = "todos" | "a_receber" | "a_pagar";
type StatusFilter = "todos" | "prontos" | "divergentes" | "atraso" | "a_vencer" | "baixados";

export function BaixasView({
  titles,
  matches,
  matchStats,
  proofs = [],
  role,
  onImportTitlesFile,
  onConfirmSettlementInSession,
  onExportBatchSettlement,
  onLoadOperationalData,
  onSyncOmieTitles,
  isSyncingOmie = false
}: BaixasViewProps) {
  const titlesInputRef = useRef<HTMLInputElement>(null);
  const [natureFilter, setNatureFilter] = useState<NatureFilter>("todos");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const hasSettlementAuth = canApproveBatchSettlement(role);
  const roleMeta = getRoleMetadata(role);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Mapa de canhotos de entrega por número limpo do documento
  const proofsMap = useMemo(() => {
    const map = new Map<string, DeliveryProof>();
    for (const p of proofs) {
      const clean = (p.nfeNumber || "").replace(/[^0-9]/g, "").replace(/^0+/, "");
      if (clean) map.set(clean, p);
    }
    return map;
  }, [proofs]);

  // Cálculos executivos da carteira
  const summary = useMemo(() => {
    let totalValue = 0;
    let receivableValue = 0;
    let payableValue = 0;
    let overdueValue = 0;
    let overdueCount = 0;
    let futureValue = 0;
    let futureCount = 0;
    let settledValue = 0;
    let settledCount = 0;

    for (const t of titles) {
      totalValue += t.amount;
      if (t.category === "payable") {
        payableValue += t.amount;
      } else {
        receivableValue += t.amount;
      }
      if (t.status === "baixado") {
        settledCount += 1;
        settledValue += t.paidAmount || t.amount;
      } else if (t.dueDate < todayStr) {
        overdueCount += 1;
        overdueValue += t.balance ?? t.amount;
      } else {
        futureCount += 1;
        futureValue += t.balance ?? t.amount;
      }
    }

    return {
      totalTitles: titles.length,
      totalValue,
      receivableValue,
      payableValue,
      overdueValue,
      overdueCount,
      futureValue,
      futureCount,
      settledValue,
      settledCount,
      readyCount: matchStats.ready.length,
      readyValue: matchStats.totalReadyAmount,
      divergentCount: matchStats.divergent.length
    };
  }, [titles, matchStats, todayStr]);

  // Map de matches por titleId
  const matchByTitleId = useMemo(() => {
    const map = new Map<string, ReconciliationMatch>();
    for (const m of matches) {
      map.set(m.title.id, m);
    }
    return map;
  }, [matches]);

  // Filtragem dos títulos de acordo com a aba e a busca
  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      const t = m.title;
      const isSettled = t.status === "baixado";
      const isOverdue = !isSettled && t.dueDate < todayStr;
      const isFuture = !isSettled && t.dueDate >= todayStr;

      // Filtro da aba
      if (statusFilter === "prontos" && m.suggestedStatus !== "pronto_para_baixa") return false;
      if (statusFilter === "divergentes" && m.suggestedStatus !== "divergente") return false;
      if (statusFilter === "atraso" && !isOverdue) return false;
      if (statusFilter === "a_vencer" && !isFuture) return false;
      if (statusFilter === "baixados" && !isSettled) return false;
      if (natureFilter === "a_receber" && t.category === "payable") return false;
      if (natureFilter === "a_pagar" && t.category !== "payable") return false;

      // Filtro da busca
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const doc = t.documentNumber.toLowerCase();
        const cust = t.customerName.toLowerCase();
        const ourNum = (t.ourNumber || "").toLowerCase();
        const bank = (t.bankAccount || "").toLowerCase();
        if (!doc.includes(q) && !cust.includes(q) && !ourNum.includes(q) && !bank.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [matches, natureFilter, statusFilter, searchQuery, todayStr]);

  return (
    <>
      {/* Hidden Input para upload de planilhas (.xlsx, .xls ou .csv) */}
      <input
        type="file"
        ref={titlesInputRef}
        style={{ display: "none" }}
        accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImportTitlesFile(file);
          if (e.target) e.target.value = "";
        }}
      />

      <div className="page-heading">
        <div>
          <div className="eyebrow">INTEGRAÇÃO ERP · RECONCILIAÇÃO DE TÍTULOS</div>
          <h1>Reconciliação de Títulos (Receber &amp; Pagar)</h1>
          <p>
            Cruzamento automatizado entre títulos a receber e a pagar do ERP, extratos bancários (Itaú / Safra) e comprovantes de entrega (Canhotos).
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          {onLoadOperationalData && (
            <button
              className="secondary-button"
              onClick={onLoadOperationalData}
              title="Carrega os 423 títulos operacionais reais da Mundo do Sabor e 395 extratos OFX Itaú/Safra"
              style={{ fontWeight: 600, borderColor: "var(--accent, #EA580C)", color: "var(--accent, #EA580C)" }}
            >
              ⚡ Insumos Reais (Mundo do Sabor)
            </button>
          )}

          {onSyncOmieTitles && (
            <button
              className="secondary-button"
              onClick={onSyncOmieTitles}
              disabled={isSyncingOmie}
              title="Sincroniza títulos em aberto diretamente da API do Omie ERP"
            >
              {isSyncingOmie ? "🔄 Sincronizando Omie..." : "🔄 Sincronizar API Omie"}
            </button>
          )}

          <button
            className="secondary-button"
            onClick={() => titlesInputRef.current?.click()}
            title="Importa planilha de títulos do Omie ou ERP (.xlsx ou .csv) — suporta contas a receber e contas a pagar"
            style={{ fontWeight: 600 }}
          >
            ＋ Importar Títulos (Receber/Pagar)
          </button>

          {matchStats.ready.length > 0 && (
            hasSettlementAuth ? (
              <button className="primary-button" onClick={onExportBatchSettlement}>
                📥 Gerar Lote de Baixas ({matchStats.ready.length})
              </button>
            ) : (
              <button
                className="secondary-button"
                disabled
                title="Alçada Restrita: Exige aprovação de perfil Diretoria (Owner ou Admin) para emitir baixas financeiras no ERP."
                style={{ opacity: 0.6, cursor: "not-allowed", borderStyle: "dashed" }}
              >
                🔒 Baixa Restrita à Diretoria
              </button>
            )
          )}
        </div>
      </div>

      {/* Grid de KPIs Executivos */}
      <section className="dashboard-grid">
        <Metric
          label="Carteira Total (Receber & Pagar)"
          value={formatCurrency(summary.totalValue)}
          tone="neutral"
          detail={
            summary.payableValue > 0
              ? `${summary.totalTitles} títulos · 📥 ${formatCurrency(summary.receivableValue)} · 📤 ${formatCurrency(summary.payableValue)}`
              : `${summary.totalTitles} títulos importados do ERP`
          }
          icon="💼"
        />
        <Metric
          label="Prontos para Baixa (Casados)"
          value={`${summary.readyCount} títulos`}
          tone="positive"
          detail={`Total liquidável: ${formatCurrency(summary.readyValue)}`}
          icon="✓"
        />
        <Metric
          label="Divergentes / Juros / Desconto"
          value={`${summary.divergentCount} títulos`}
          tone={summary.divergentCount > 0 ? "warning" : "neutral"}
          detail="Requer validação de alçada de Diretoria"
          icon="!"
        />
        <Metric
          label="Inadimplência / Em Atraso"
          value={`${summary.overdueCount} títulos`}
          tone={summary.overdueCount > 0 ? "critical" : "neutral"}
          detail={`Exposição vencida: ${formatCurrency(summary.overdueValue)}`}
          icon="⏱"
        />
        <Metric
          label="A Vencer (Projeção)"
          value={`${summary.futureCount} títulos`}
          tone="neutral"
          detail={`A receber futuro: ${formatCurrency(summary.futureValue)}`}
          icon="📅"
        />
      </section>

      {/* Painel Principal de Reconciliação */}
      <section className="panel" style={{ marginTop: "24px" }}>
        <div className="panel-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2>Painel de Conciliação e Baixa em Lote</h2>
            <p>Triangulação entre Títulos do ERP, Entradas Bancárias e Blindagem de Canhotos.</p>
          </div>

          {matchStats.ready.length > 0 && (
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="secondary-button"
                onClick={onConfirmSettlementInSession}
                disabled={!hasSettlementAuth}
                title={!hasSettlementAuth ? "Ação restrita à Diretoria (Owner ou Admin)." : "Marcar títulos como baixados nesta sessão."}
              >
                {hasSettlementAuth ? "Marcar Baixados na Sessão" : "🔒 Baixa Restrita à Diretoria"}
              </button>
              <button
                className={hasSettlementAuth ? "primary-button" : "secondary-button"}
                onClick={onExportBatchSettlement}
                disabled={!hasSettlementAuth}
                title={!hasSettlementAuth ? "Ação restrita à Diretoria (Owner ou Admin)." : "Gerar CSV para conferência e importação no Omie."}
              >
                {hasSettlementAuth ? "Exportar Lote Omie (.csv)" : "🔒 Baixa Restrita à Diretoria"}
              </button>
            </div>
          )}
        </div>

        {/* Filtros organizados por natureza e situação */}
        <div className="settlement-filter-panel" aria-label="Filtros de títulos">
          <div className="settlement-filter-group">
            <div className="settlement-filter-heading">
              <strong>Natureza</strong>
              <span>Tipo de título</span>
            </div>
            <div className="settlement-filter-options" role="group" aria-label="Filtrar por natureza">
              <button type="button" className={natureFilter === "todos" ? "tab-button active" : "tab-button"} aria-pressed={natureFilter === "todos"} onClick={() => setNatureFilter("todos")}>Todos ({titles.length})</button>
              <button type="button" className={natureFilter === "a_receber" ? "tab-button active" : "tab-button"} aria-pressed={natureFilter === "a_receber"} onClick={() => setNatureFilter("a_receber")}>📥 A Receber ({titles.filter((t) => t.category !== "payable").length})</button>
              <button type="button" className={natureFilter === "a_pagar" ? "tab-button active" : "tab-button"} aria-pressed={natureFilter === "a_pagar"} onClick={() => setNatureFilter("a_pagar")}>📤 A Pagar ({titles.filter((t) => t.category === "payable").length})</button>
            </div>
          </div>
          <div className="settlement-filter-group">
            <div className="settlement-filter-heading">
              <strong>Situação</strong>
              <span>Etapa financeira ou de conciliação</span>
            </div>
            <div className="settlement-filter-options" role="group" aria-label="Filtrar por situação">
              <button type="button" className={statusFilter === "todos" ? "tab-button active" : "tab-button"} aria-pressed={statusFilter === "todos"} onClick={() => setStatusFilter("todos")}>Todas ({matches.length})</button>
              <button type="button" className={statusFilter === "prontos" ? "tab-button active" : "tab-button"} aria-pressed={statusFilter === "prontos"} onClick={() => setStatusFilter("prontos")}>Prontos p/ Baixa ({matchStats.ready.length})</button>
              <button type="button" className={statusFilter === "divergentes" ? "tab-button active" : "tab-button"} aria-pressed={statusFilter === "divergentes"} onClick={() => setStatusFilter("divergentes")}>Divergentes ({matchStats.divergent.length})</button>
              <button type="button" className={statusFilter === "atraso" ? "tab-button active" : "tab-button"} aria-pressed={statusFilter === "atraso"} onClick={() => setStatusFilter("atraso")}>Em Atraso ({summary.overdueCount})</button>
              <button type="button" className={statusFilter === "a_vencer" ? "tab-button active" : "tab-button"} aria-pressed={statusFilter === "a_vencer"} onClick={() => setStatusFilter("a_vencer")}>A Vencer ({summary.futureCount})</button>
              <button type="button" className={statusFilter === "baixados" ? "tab-button active" : "tab-button"} aria-pressed={statusFilter === "baixados"} onClick={() => setStatusFilter("baixados")}>Liquidados ({summary.settledCount})</button>
            </div>
          </div>
          <div className="settlement-search">
            <label htmlFor="settlement-title-search">Buscar títulos</label>
            <input id="settlement-title-search" type="text" placeholder="NF, cliente, banco ou nosso número..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="search-input" />
            <span className="settlement-result-count" aria-live="polite">{filteredMatches.length} de {matches.length} títulos encontrados</span>
          </div>
        </div>

        {titles.length ? (
          <div className="table-wrap">
            <table className="sticky-actions">
              <thead>
                <tr>
                  <th>Nº Documento / NF</th>
                  <th>Cliente / Fornecedor</th>
                  <th>Vencimento</th>
                  <th className="align-right">Valor Original</th>
                  <th>Blindagem (Canhoto)</th>
                  <th>Movimento Extrato Bancário</th>
                  <th>Confiança</th>
                  <th>Diferença</th>
                  <th>Status & Ação</th>
                </tr>
              </thead>
              <tbody>
                {filteredMatches.map((m) => {
                  const t = m.title;
                  const isReady = m.suggestedStatus === "pronto_para_baixa";
                  const isDivergent = m.suggestedStatus === "divergente";
                  const isSettled = t.status === "baixado";
                  const isOverdue = !isSettled && t.dueDate < todayStr;

                  // Busca comprovante de canhoto correspondente
                  const cleanDoc = t.documentNumber.replace(/[^0-9]/g, "").replace(/^0+/, "");
                  const proof = proofsMap.get(cleanDoc);

                  return (
                    <tr key={t.id} style={{ opacity: isSettled ? 0.65 : 1 }}>
                      <td>
                        <strong style={{ fontSize: "13px" }}>{t.documentNumber}</strong>
                        {t.ourNumber && (
                          <span style={{ display: "block", fontSize: "11px", color: "var(--muted)" }}>
                            Nosso Nº: {t.ourNumber}
                          </span>
                        )}
                        {t.issueDate && (
                          <span style={{ display: "block", fontSize: "11px", color: "var(--muted)" }}>
                            Emissão: {formatDate(t.issueDate)}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="description-cell" style={{ fontWeight: 500 }}>
                          <span
                            style={{
                              display: "inline-block",
                              fontSize: "10px",
                              fontWeight: 600,
                              padding: "1px 6px",
                              borderRadius: "4px",
                              marginRight: "6px",
                              background: t.category === "payable" ? "rgba(220, 38, 38, 0.12)" : "rgba(22, 163, 74, 0.12)",
                              color: t.category === "payable" ? "var(--red, #DC2626)" : "var(--green, #16A34A)"
                            }}
                          >
                            {t.category === "payable" ? "📤 A Pagar" : "📥 A Receber"}
                          </span>
                          {t.customerName}
                        </div>
                        <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                          Previsão: {t.bankAccount || "Conta Geral"}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: isOverdue ? "var(--red, #DC2626)" : "var(--ink)", fontWeight: isOverdue ? 600 : 400 }}>
                          {formatDate(t.dueDate)}
                        </span>
                        {isOverdue && (
                          <span
                            className="status-pill"
                            style={{
                              display: "inline-block",
                              marginLeft: "6px",
                              padding: "1px 6px",
                              fontSize: "10px",
                              background: "rgba(239, 68, 68, 0.12)",
                              color: "var(--red, #DC2626)",
                              borderColor: "var(--red, #DC2626)"
                            }}
                          >
                            Vencido
                          </span>
                        )}
                      </td>
                      <td className="align-right">
                        <strong>{formatCurrency(t.amount)}</strong>
                        {t.balance !== undefined && t.balance !== t.amount && (
                          <span style={{ display: "block", fontSize: "11px", color: "var(--muted)" }}>
                            Saldo: {formatCurrency(t.balance)}
                          </span>
                        )}
                      </td>
                      <td>
                        {proof ? (
                          proof.status === "comprovado" ? (
                            <span
                              className="status-pill"
                              style={{ background: "rgba(22, 132, 92, 0.15)", color: "var(--green, #10B981)", borderColor: "var(--green, #10B981)" }}
                              title={`Canhoto assinado em ${formatDate(proof.deliveryDate || "")} por ${proof.receiverName || "Destinatário"}`}
                            >
                              🟢 Canhoto Assinado
                            </span>
                          ) : proof.status === "pendente_entrega" ? (
                            <span
                              className="status-pill"
                              style={{ background: "rgba(234, 179, 8, 0.15)", color: "#B45309", borderColor: "#F59E0B" }}
                              title="Mercadoria em transporte com motorista"
                            >
                              🟡 Em Trânsito
                            </span>
                          ) : (
                            <span
                              className="status-pill"
                              style={{ background: "rgba(239, 68, 68, 0.12)", color: "var(--red)", borderColor: "var(--red)" }}
                              title="Comprovante com recusa de entrega ou extravio"
                            >
                              🔴 Recusado / Devolvido
                            </span>
                          )
                        ) : (
                          <span
                            className="status-pill"
                            style={{ background: "var(--bg)", color: "var(--muted)", borderColor: "var(--line)" }}
                            title="Sem evidência de canhoto digitalizado cadastrado"
                          >
                            ⚪ Canhoto Pendente
                          </span>
                        )}
                      </td>
                      <td>
                        {m.statementRecord ? (
                          <div>
                            <strong style={{ fontSize: "12px", color: "var(--ink)" }}>
                              {formatCurrency(m.statementRecord.amount)} em {formatDate(m.statementRecord.date)}
                            </strong>
                            <span style={{ display: "block", fontSize: "11px", color: "var(--muted)" }}>
                              {m.statementRecord.source} {m.statementRecord.bankName ? `· ${m.statementRecord.bankName}` : ""}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: "var(--muted)", fontStyle: "italic", fontSize: "12px" }}>
                            Nenhuma entrada compatível
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className="status-pill"
                          style={{
                            background: m.confidence === "exato" || m.confidence === "documental" ? "rgba(22, 132, 92, 0.15)" : m.confidence === "aproximado" ? "rgba(234, 179, 8, 0.15)" : "var(--bg)",
                            color: m.confidence === "exato" || m.confidence === "documental" ? "var(--green)" : m.confidence === "aproximado" ? "#B45309" : "var(--muted)",
                            borderColor: m.confidence === "exato" || m.confidence === "documental" ? "var(--green)" : m.confidence === "aproximado" ? "#F59E0B" : "var(--line)"
                          }}
                        >
                          {m.confidence === "exato" ? "Exato (100%)" : m.confidence === "documental" ? "Documental" : m.confidence === "aproximado" ? "Aproximado" : "Pendente"}
                        </span>
                      </td>
                      <td>
                        {m.amountDifference !== 0 ? (
                          <span style={{ color: m.amountDifference > 0 ? "var(--red)" : "#2563EB", fontWeight: 600, fontSize: "12px" }}>
                            {m.amountDifference > 0 ? `+ ${formatCurrency(m.amountDifference)} (Juros)` : `- ${formatCurrency(Math.abs(m.amountDifference))} (Desc.)`}
                          </span>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: "12px" }}>—</span>
                        )}
                      </td>
                      <td>
                        {isSettled ? (
                          <span className="status-pill" style={{ background: "var(--bg)", color: "var(--muted)" }}>
                            Baixado no ERP
                          </span>
                        ) : isReady ? (
                          <span className="status-pill" style={{ background: "rgba(22, 132, 92, 0.15)", color: "var(--green)", borderColor: "var(--green)" }}>
                            Pronto p/ Baixa
                          </span>
                        ) : isDivergent ? (
                          <span className="status-pill" style={{ background: "rgba(234, 179, 8, 0.15)", color: "#B45309", borderColor: "#F59E0B" }}>
                            Revisar Diferença
                          </span>
                        ) : (
                          <span className="status-pill" style={{ background: "var(--bg)", color: "var(--muted)" }}>
                            Aguardando Extrato
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="💼"
            title="Nenhum título carregado"
            text="Importe uma planilha do Omie (.xlsx / .csv) ou clique no botão acima para carregar os insumos operacionais reais da Mundo do Sabor."
          />
        )}
      </section>

      <div className="inline-note" style={{ marginTop: "16px" }}>
        <strong>Governança & Alçadas:</strong> a exportação gera um lote em formato CSV compatível com o Omie para conferência e importação assistida. Nenhuma baixa direta é disparada no ERP sem validação expressa da Diretoria.
      </div>
    </>
  );
}
