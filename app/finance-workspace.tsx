"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import { BankMetadata, FinancialRecord, encodeWindows1252, filterRecordsByPeriod, formatCurrency, formatDate, generateOmieOfx, parseCsv, parseOfx } from "@/lib/finance";
import {
  ReceivableTitle,
  ReconciliationMatch,
  matchTitlesWithRecords,
  buildSettlementItems,
  generateOmieBatchSettlementCsv,
  parseReceivablesCsv
} from "@/lib/reconciliation";

type Section = "visao-geral" | "movimentacoes" | "importacoes" | "baixas" | "relatorios";

const navigation: { id: Section; label: string; icon: string }[] = [
  { id: "visao-geral", label: "Visão geral", icon: "◫" },
  { id: "movimentacoes", label: "Movimentações", icon: "⇄" },
  { id: "importacoes", label: "Importações", icon: "⇧" },
  { id: "baixas", label: "Baixas Omie (ENG-02)", icon: "✓" },
  { id: "relatorios", label: "Relatórios", icon: "▥" }
];

const INITIAL_SAMPLE_TITLES: ReceivableTitle[] = [
  {
    id: "tit-101",
    documentNumber: "NF-4580",
    customerName: "Supermercado Real Salvador",
    amount: 1500.0,
    dueDate: "2026-04-10",
    bankAccount: "Itaú Unibanco",
    ourNumber: "0341999888",
    status: "pendente"
  },
  {
    id: "tit-102",
    documentNumber: "NF-4581",
    customerName: "Distribuidora Alimentos Bahia",
    amount: 3200.5,
    dueDate: "2026-04-12",
    bankAccount: "Banco do Nordeste (BNB)",
    status: "pendente"
  },
  {
    id: "tit-103",
    documentNumber: "NF-4582",
    customerName: "Padaria e Lanchonete Estrela",
    amount: 850.0,
    dueDate: "2026-04-15",
    bankAccount: "Banco Inter",
    status: "pendente"
  },
  {
    id: "tit-104",
    documentNumber: "NF-4583",
    customerName: "Mercado Regional Lauro de Freitas",
    amount: 5000.0,
    dueDate: "2026-04-20",
    bankAccount: "Itaú Unibanco",
    status: "pendente"
  },
  {
    id: "tit-105",
    documentNumber: "NF-4584",
    customerName: "Cantina Sabor Central",
    amount: 2400.0,
    dueDate: "2026-04-22",
    bankAccount: "Itaú Unibanco",
    status: "pendente"
  }
];

export default function FinanceWorkspace() {
  const [section, setSection] = useState<Section>("visao-geral");
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [pendingImport, setPendingImport] = useState<FinancialRecord[]>([]);
  const [pendingMetadata, setPendingMetadata] = useState<BankMetadata | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("30");
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Estado para Contas a Receber e Baixas em Lote (ENG-MS-02)
  const [titles, setTitles] = useState<ReceivableTitle[]>(INITIAL_SAMPLE_TITLES);
  const titlesInputRef = useRef<HTMLInputElement>(null);

  const periodRecords = useMemo(() => filterRecordsByPeriod(records, Number(period)), [records, period]);

  const totals = useMemo(() => {
    const incoming = periodRecords.filter((item) => item.direction === "entrada").reduce((sum, item) => sum + item.amount, 0);
    const outgoing = periodRecords.filter((item) => item.direction === "saída").reduce((sum, item) => sum + item.amount, 0);
    return { incoming, outgoing, balance: incoming - outgoing };
  }, [periodRecords]);

  const filteredRecords = useMemo(() => periodRecords.filter((item) =>
    `${item.description} ${item.category} ${item.source} ${item.bankName || ""}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))
  ), [periodRecords, query]);

  // Casamento algorítmico entre títulos a receber e extratos importados
  const matches = useMemo(() => {
    return matchTitlesWithRecords(titles, records);
  }, [titles, records]);

  const matchStats = useMemo(() => {
    const ready = matches.filter((m) => m.suggestedStatus === "pronto_para_baixa");
    const divergent = matches.filter((m) => m.suggestedStatus === "divergente");
    const pending = matches.filter((m) => m.suggestedStatus === "nao_identificado");
    const totalReadyAmount = ready.reduce((sum, m) => sum + (m.statementRecord?.amount || 0), 0);
    return { ready, divergent, pending, totalReadyAmount };
  }, [matches]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setNotice("");
    const text = await file.text();
    const result = file.name.toLowerCase().endsWith(".ofx") ? parseOfx(text) : parseCsv(text);
    setPendingImport(result.records);
    setImportErrors(result.errors);
    setPendingMetadata(result.metadata || null);
    setSection("importacoes");
    event.target.value = "";
  }

  function confirmImport() {
    setRecords((current) => [...pendingImport, ...current]);
    setNotice(`${pendingImport.length} movimentação(ões) adicionada(s) à sessão atual.`);
    setPendingImport([]);
    setPendingMetadata(null);
    setImportErrors([]);
    setFileName("");
  }

  function resetSession() {
    setRecords([]);
    setPendingImport([]);
    setPendingMetadata(null);
    setImportErrors([]);
    setNotice("A sessão foi limpa.");
  }

  function handleExportOmie(targetRecords?: FinancialRecord[]) {
    const list = targetRecords && targetRecords.length ? targetRecords : (records.length ? records : pendingImport);
    if (!list.length) return;
    try {
      const ofxContent = generateOmieOfx(list, pendingMetadata || undefined);
      const blob = new Blob([encodeWindows1252(ofxContent)], { type: "application/x-ofx;charset=windows-1252" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `extrato_padronizado_omie_${dateStr}.ofx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
      setNotice(`Arquivo OFX normalizado para o Omie exportado com sucesso (${list.length} registros).`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível gerar o arquivo OFX.");
    }
  }

  // Ações de Baixa em Lote (ENG-MS-02)
  async function handleImportTitlesFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const result = parseReceivablesCsv(text);
    if (result.errors.length > 0) {
      setNotice(`Aviso: ${result.errors[0]}`);
    } else {
      setTitles((curr) => [...result.titles, ...curr]);
      setNotice(`${result.titles.length} título(s) a receber carregado(s) do Omie com sucesso.`);
    }
    event.target.value = "";
  }

  function handleExportBatchSettlement(customMatches?: ReconciliationMatch[]) {
    const target = customMatches && customMatches.length ? customMatches : matchStats.ready;
    if (!target.length) {
      setNotice("Não há títulos com correspondência bancária pronta para baixa.");
      return;
    }
    const settlements = buildSettlementItems(target);
    const csvContent = generateOmieBatchSettlementCsv(settlements);
    const blob = new Blob([csvContent], { type: "text/csv;charset=windows-1252" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `lote_baixas_omie_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNotice(`Planilha oficial de Baixa em Lote do Omie gerada com sucesso (${settlements.length} títulos liquidados).`);
  }

  function handleConfirmSettlementInSession() {
    const matchedTitleIds = new Set(matchStats.ready.map((m) => m.title.id));
    setTitles((curr) =>
      curr.map((t) => (matchedTitleIds.has(t.id) ? { ...t, status: "baixado" as const } : t))
    );
    setNotice(`${matchedTitleIds.size} título(s) marcados como baixados na sessão.`);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">R</div>
          <div><strong>RSBUILD</strong><span>FINANCEIRO</span></div>
        </div>
        <div className="workspace-label">ESPAÇO DE TRABALHO</div>
        <nav className="nav-list" aria-label="Navegação principal">
          {navigation.map((item) => (
            <button key={item.id} className={section === item.id ? "nav-item active" : "nav-item"} onClick={() => setSection(item.id)}>
              <span className="nav-icon">{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="connection-dot" />
          <div><strong>Ambiente de trabalho</strong><span>Configuração inicial</span></div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb">RSBUILD <span>/</span> {navigation.find((item) => item.id === section)?.label}</div>
          <div className="topbar-right"><span className="period-label">PERÍODO</span><select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Período"><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="365">Últimos 12 meses</option></select><div className="avatar">R</div></div>
        </header>

        <div className="content">
          {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Fechar aviso">×</button></div>}

          {section === "visao-geral" && <>
            <div className="page-heading">
              <div><div className="eyebrow">PAINEL FINANCEIRO</div><h1>Visão geral</h1><p>Acompanhe a movimentação e a posição financeira da empresa.</p></div>
              <button className="primary-button" onClick={() => inputRef.current?.click()}><span>＋</span> Importar movimentações</button>
            </div>
            <div className="metric-grid">
              <Metric label="Entradas no período" value={formatCurrency(totals.incoming)} tone="positive" detail={periodRecords.length ? "Registros importados no período" : "Aguardando dados"} icon="↙" />
              <Metric label="Saídas no período" value={formatCurrency(totals.outgoing)} tone="negative" detail={periodRecords.length ? "Registros importados no período" : "Aguardando dados"} icon="↗" />
              <Metric label="Resultado do período" value={formatCurrency(totals.balance)} tone="neutral" detail="Entradas menos saídas" icon="＝" />
              <Metric label="Movimentações" value={String(periodRecords.length)} tone="neutral" detail={periodRecords.filter((item) => item.status === "pendente").length + " pendentes de revisão"} icon="▤" />
            </div>
            <div className="dashboard-grid">
              <section className="panel chart-panel">
                <div className="panel-heading"><div><h2>Movimentação financeira</h2><p>Consolidação dos registros importados</p></div><span className="subtle-tag">BRL</span></div>
                {periodRecords.length ? <div className="activity-summary"><div><span>Entradas</span><strong className="positive">{formatCurrency(totals.incoming)}</strong></div><div><span>Saídas</span><strong className="negative">{formatCurrency(totals.outgoing)}</strong></div><div><span>Saldo líquido</span><strong>{formatCurrency(totals.balance)}</strong></div></div> : <EmptyState icon="⌁" title="Ainda não há movimentações" text="Importe um extrato bancário para começar a visualizar a posição financeira." action="Importar extrato" onAction={() => inputRef.current?.click()} />}
              </section>
              <section className="panel">
                <div className="panel-heading"><div><h2>Qualidade dos dados</h2><p>Situação dos registros carregados</p></div></div>
                <div className="quality-row"><span>Movimentações importadas</span><strong>{periodRecords.length}</strong></div>
                <div className="quality-row"><span>Pendentes de revisão</span><strong>{periodRecords.filter((item) => item.status === "pendente").length}</strong></div>
                <div className="quality-row"><span>Fontes identificadas</span><strong>{new Set(periodRecords.map((item) => item.source)).size}</strong></div>
                <div className="quality-footnote">A classificação e a conciliação serão habilitadas conforme a configuração das fontes.</div>
              </section>
            </div>
            <section className="panel recent-panel">
              <div className="panel-heading"><div><h2>Movimentações recentes</h2><p>Últimos registros adicionados</p></div><button className="text-button" onClick={() => setSection("movimentacoes")}>Ver todas <span>→</span></button></div>
              {periodRecords.length ? <RecordTable records={[...periodRecords].sort((a,b) => b.date.localeCompare(a.date)).slice(0,5)} /> : <div className="table-empty">Os registros aparecerão aqui após a primeira importação.</div>}
            </section>
          </>}

          {section === "movimentacoes" && <>
            <div className="page-heading">
              <div>
                <div className="eyebrow">LANÇAMENTOS</div>
                <h1>Movimentações</h1>
                <p>Consulte os registros financeiros carregados.</p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                {records.length > 0 && (
                  <button className="secondary-button" onClick={() => handleExportOmie()} title="Exportar lote padronizado para conciliação no Omie">
                    📥 Exportar OFX (Omie)
                  </button>
                )}
                <button className="primary-button" onClick={() => inputRef.current?.click()}>＋ Importar arquivo</button>
              </div>
            </div>
            <section className="panel"><div className="table-toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por descrição, categoria ou origem..." aria-label="Buscar movimentações" /><span>{filteredRecords.length} registro(s)</span></div>{filteredRecords.length ? <RecordTable records={[...filteredRecords].sort((a,b) => b.date.localeCompare(a.date))} /> : <EmptyState icon="⇄" title="Nenhuma movimentação encontrada" text="Carregue um extrato CSV ou OFX para consultar os lançamentos." action="Importar arquivo" onAction={() => inputRef.current?.click()} />}</section>
          </>}

          {section === "importacoes" && <>
            <div className="page-heading"><div><div className="eyebrow">ENTRADA DE DADOS</div><h1>Importações</h1><p>Carregue extratos e revise os registros antes de adicioná-los.</p></div></div>
            <section className="panel import-panel">
              <div className="upload-zone"><div className="upload-icon">⇧</div><h2>Importar extrato financeiro</h2><p>Selecione um arquivo CSV ou OFX para visualizar os registros.</p><button className="secondary-button" onClick={() => inputRef.current?.click()}>Selecionar arquivo</button><span className="file-hint">CSV ou OFX · Até 10 MB</span></div>
              {fileName && (
                <div className="import-file">
                  <span className="file-badge">ARQ</span>
                  <div>
                    <strong>{fileName}</strong>
                    <span>{pendingImport.length} registro(s) reconhecido(s)</span>
                    {pendingMetadata?.bankName && (
                      <span style={{ display: "block", fontSize: "12px", color: "#0284c7", marginTop: "3px" }}>
                        🏦 {pendingMetadata.bankName}
                        {pendingMetadata.accountId ? ` · Conta: ${pendingMetadata.accountId}` : ""}
                        {pendingMetadata.balance !== undefined ? ` · Saldo: ${formatCurrency(pendingMetadata.balance)}` : ""}
                      </span>
                    )}
                  </div>
                </div>
              )}
              {importErrors.length > 0 && <div className="error-list"><strong>Revisar importação</strong>{importErrors.map((error, index) => <p key={index}>{error}</p>)}</div>}
              {pendingImport.length > 0 && <>
                <div className="preview-heading"><div><h2>Prévia dos registros</h2><p>Confira os dados antes de confirmar a importação.</p></div><span>{pendingImport.length} registros</span></div>
                <RecordTable records={pendingImport.slice(0,8)} />
                <div className="import-actions">
                  <button className="secondary-button" onClick={() => {setPendingImport([]);setFileName("");setImportErrors([]);setPendingMetadata(null);}}>Cancelar</button>
                  <button className="secondary-button" onClick={() => handleExportOmie(pendingImport)} title="Exportar lote normalizado pronto para Omie">
                    ⚡ Exportar OFX (Omie)
                  </button>
                  <button className="primary-button" onClick={confirmImport}>Confirmar importação</button>
                </div>
              </>}
            </section>
            <div className="inline-note">Os registros desta versão permanecem disponíveis durante a sessão atual. A persistência segura e a conexão com as fontes serão configuradas na etapa de integração.</div>
          </>}

          {section === "baixas" && <>
            <div className="page-heading">
              <div>
                <div className="eyebrow">BRIDGE OMIE · ENG-MS-02</div>
                <h1>Baixas Automatizadas de Títulos</h1>
                <p>Conciliação inteligente e liquidação de contas a receber sem arrastar cards manuais no ERP.</p>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button className="secondary-button" onClick={() => setTitles(INITIAL_SAMPLE_TITLES)} title="Recarregar títulos exemplo da Mundo do Sabor">
                  ⚡ Amostra Mundo do Sabor
                </button>
                <button className="secondary-button" onClick={() => titlesInputRef.current?.click()}>
                  ＋ Importar Títulos (CSV)
                </button>
                {matchStats.ready.length > 0 && (
                  <button className="primary-button" onClick={() => handleExportBatchSettlement()}>
                    📥 Gerar Lote de Baixas (.CSV)
                  </button>
                )}
              </div>
            </div>

            <section className="dashboard-grid">
              <Metric
                label="Prontos para Baixa (Casados)"
                value={`${matchStats.ready.length} títulos`}
                tone="positive"
                detail={`Total liquidável: ${formatCurrency(matchStats.totalReadyAmount)}`}
                icon="✓"
              />
              <Metric
                label="Divergentes / Juros / Desconto"
                value={`${matchStats.divergent.length} títulos`}
                tone={matchStats.divergent.length > 0 ? "warning" : "neutral"}
                detail="Requer validação expressa do operador"
                icon="!"
              />
              <Metric
                label="Aguardando Extrato Bancário"
                value={`${matchStats.pending.length} títulos`}
                tone="neutral"
                detail="Ainda não localizados nas entradas bancárias"
                icon="◫"
              />
            </section>

            <section className="panel" style={{ marginTop: "24px" }}>
              <div className="panel-heading">
                <div>
                  <h2>Painel de Conciliação e Baixa em Lote</h2>
                  <p>Cruzamento entre contas a receber do Omie e lançamentos bancários conciliados</p>
                </div>
                {matchStats.ready.length > 0 && (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button className="secondary-button" onClick={handleConfirmSettlementInSession}>
                      Marcar Baixados na Sessão
                    </button>
                    <button className="primary-button" onClick={() => handleExportBatchSettlement()}>
                      ⚡ Baixar Lote Oficial Omie (.CSV)
                    </button>
                  </div>
                )}
              </div>

              {titles.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Nº Documento</th>
                        <th>Cliente / Sacado</th>
                        <th>Vencimento</th>
                        <th className="align-right">Valor Título</th>
                        <th>Entrada Extrato Bancário</th>
                        <th>Confiança</th>
                        <th>Diferença</th>
                        <th>Status Sugerido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matches.map((m) => {
                        const isReady = m.suggestedStatus === "pronto_para_baixa";
                        const isDivergent = m.suggestedStatus === "divergente";
                        return (
                          <tr key={m.title.id} style={{ opacity: m.title.status === "baixado" ? 0.6 : 1 }}>
                            <td>
                              <strong>{m.title.documentNumber}</strong>
                              {m.title.ourNumber && (
                                <span style={{ display: "block", fontSize: "11px", color: "#64748B" }}>
                                  Nosso Nº: {m.title.ourNumber}
                                </span>
                              )}
                            </td>
                            <td>
                              <div className="description-cell">{m.title.customerName}</div>
                              <span style={{ fontSize: "11px", color: "#64748B" }}>{m.title.bankAccount || "Conta Geral"}</span>
                            </td>
                            <td>{formatDate(m.title.dueDate)}</td>
                            <td className="align-right">{formatCurrency(m.title.amount)}</td>
                            <td>
                              {m.statementRecord ? (
                                <div>
                                  <strong style={{ fontSize: "12px", color: "#0F172A" }}>
                                    {formatCurrency(m.statementRecord.amount)} em {formatDate(m.statementRecord.date)}
                                  </strong>
                                  <span style={{ display: "block", fontSize: "11px", color: "#64748B" }}>
                                    {m.statementRecord.source} · {m.statementRecord.sourceRecordId ? `FITID: ${m.statementRecord.sourceRecordId}` : ""}
                                  </span>
                                </div>
                              ) : (
                                <span style={{ color: "#94A3B8", fontStyle: "italic", fontSize: "12px" }}>Nenhuma entrada compatível</span>
                              )}
                            </td>
                            <td>
                              <span
                                className="status-pill"
                                style={{
                                  background: m.confidence === "exato" || m.confidence === "documental" ? "#DCFCE7" : m.confidence === "aproximado" ? "#FEF3C7" : "#F1F5F9",
                                  color: m.confidence === "exato" || m.confidence === "documental" ? "#15803D" : m.confidence === "aproximado" ? "#92400E" : "#64748B",
                                  borderColor: m.confidence === "exato" || m.confidence === "documental" ? "#86EFAC" : m.confidence === "aproximado" ? "#FCD34D" : "#CBD5E1"
                                }}
                              >
                                {m.confidence === "exato" ? "Exato (100%)" : m.confidence === "documental" ? "Documental" : m.confidence === "aproximado" ? "Aproximado" : "Pendente"}
                              </span>
                            </td>
                            <td>
                              {m.amountDifference !== 0 ? (
                                <span style={{ color: m.amountDifference > 0 ? "#DC2626" : "#2563EB", fontWeight: 600, fontSize: "12px" }}>
                                  {m.amountDifference > 0 ? `+ ${formatCurrency(m.amountDifference)} (Juros)` : `- ${formatCurrency(Math.abs(m.amountDifference))} (Desc.)`}
                                </span>
                              ) : (
                                <span style={{ color: "#64748B", fontSize: "12px" }}>—</span>
                              )}
                            </td>
                            <td>
                              {m.title.status === "baixado" ? (
                                <span className="status-pill" style={{ background: "#E2E8F0", color: "#334155" }}>Baixado</span>
                              ) : isReady ? (
                                <span className="status-pill" style={{ background: "#DCFCE7", color: "#15803D", borderColor: "#86EFAC" }}>Pronto p/ Baixa</span>
                              ) : isDivergent ? (
                                <span className="status-pill" style={{ background: "#FEF3C7", color: "#92400E", borderColor: "#FCD34D" }}>Revisar Diferença</span>
                              ) : (
                                <span className="status-pill" style={{ background: "#F1F5F9", color: "#64748B" }}>Aguardando</span>
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
                  icon="✓"
                  title="Nenhum título a receber carregado"
                  text="Carregue os títulos pendentes do Omie ou utilize a amostra da Mundo do Sabor."
                  action="Carregar Amostra Mundo do Sabor"
                  onAction={() => setTitles(INITIAL_SAMPLE_TITLES)}
                />
              )}
            </section>
            <div className="inline-note" style={{ marginTop: "16px" }}>
              <strong>Diretriz Omie Blueprint (ENG-MS-02):</strong> O motor de conciliação assistida gera o lote de liquidação e o arquivo de importação oficial para o Omie sem intervenção manual de arraste de cards, preservando a alçada de aprovação do operador financeiro antes da efetivação bancária.
            </div>
          </>}

          {section === "relatorios" && <Placeholder title="Relatórios" eyebrow="ANÁLISE FINANCEIRA" text="Os relatórios serão habilitados após a validação das fontes e dos dados financeiros importados." />}
        </div>
      </section>
      <input ref={inputRef} className="hidden-input" type="file" accept=".csv,.ofx,text/csv,application/x-ofx" onChange={handleFile} />
      <input ref={titlesInputRef} className="hidden-input" type="file" accept=".csv,text/csv" onChange={handleImportTitlesFile} />
      <button className="session-reset" onClick={resetSession} title="Limpar os registros da sessão">Limpar sessão</button>
    </main>
  );
}

function Metric({ label, value, tone, detail, icon }: { label: string; value: string; tone: string; detail: string; icon: string }) {
  return <div className="metric-card"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}>{icon}</span></div><strong className="metric-value">{value}</strong><span className="metric-detail">{detail}</span></div>;
}

function EmptyState({ icon, title, text, action, onAction }: { icon: string; title: string; text: string; action: string; onAction: () => void }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><strong>{title}</strong><p>{text}</p><button className="text-button" onClick={onAction}>{action} →</button></div>;
}

function RecordTable({ records }: { records: FinancialRecord[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Descrição</th>
            <th>Categoria</th>
            <th>Origem / Instituição</th>
            <th>Status</th>
            <th className="align-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td>{formatDate(record.date)}</td>
              <td className="description-cell">
                <div>{record.description}</div>
                {record.sourceRecordId && (
                  <span style={{ fontSize: "11px", color: "#64748B", fontFamily: "var(--font-mono, monospace)" }}>
                    FITID: {record.sourceRecordId}
                  </span>
                )}
              </td>
              <td>{record.category}</td>
              <td>
                <span className="status-pill" style={{ background: "#F1F5F9", color: "#334155", borderColor: "#CBD5E1" }}>
                  {record.bankName || record.source}
                </span>
              </td>
              <td><span className="status-pill">{record.status}</span></td>
              <td className={record.direction === "entrada" ? "align-right positive" : "align-right negative"}>
                {record.direction === "entrada" ? "+" : "−"} {formatCurrency(record.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Placeholder({ title, eyebrow, text }: { title: string; eyebrow: string; text: string }) {
  return <><div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{text}</p></div></div><section className="panel placeholder-panel"><div className="empty-icon">◌</div><strong>Configuração em preparação</strong><p>Esta área será disponibilizada após a definição dos dados e regras operacionais correspondentes.</p></section></>;
}
