"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { FinancialRecord, formatCurrency, formatDate, parseCsv, parseOfx } from "@/lib/finance";
import { validateImportFile } from "@/lib/import-validation";
import { signOut } from "@/app/auth/actions";

type Section = "visao-geral" | "movimentacoes" | "importacoes" | "contas" | "relatorios";

const navigation: { id: Section; label: string; icon: string }[] = [
  { id: "visao-geral", label: "Visão geral", icon: "◫" },
  { id: "movimentacoes", label: "Movimentações", icon: "⇄" },
  { id: "importacoes", label: "Importações", icon: "⇧" },
  { id: "contas", label: "Contas", icon: "▤" },
  { id: "relatorios", label: "Relatórios", icon: "▥" }
];

export default function FinanceWorkspace({ organizationId }: { organizationId: string }) {
  const [section, setSection] = useState<Section>("visao-geral");
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [pendingImport, setPendingImport] = useState<FinancialRecord[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("30");
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/finance/records?organizationId=" + organizationId, { cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error("Não foi possível carregar os registros."); return response.json(); })
      .then((payload) => { if (active) setRecords(payload.records ?? []); })
      .catch(() => { if (active) setNotice("Não foi possível carregar os dados persistidos."); });
    return () => { active = false; };
  }, [organizationId]);

  const periodRecords = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - Number(period));
    const toIsoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const fromDate = toIsoDate(cutoff);
    const toDate = toIsoDate(today);
    return records.filter((item) => item.date >= fromDate && item.date <= toDate);
  }, [records, period]);

  const totals = useMemo(() => {
    const incoming = periodRecords.filter((item) => item.direction === "entrada").reduce((sum, item) => sum + item.amount, 0);
    const outgoing = periodRecords.filter((item) => item.direction === "saída").reduce((sum, item) => sum + item.amount, 0);
    return { incoming, outgoing, balance: incoming - outgoing };
  }, [periodRecords]);

  const filteredRecords = useMemo(() => periodRecords.filter((item) =>
    `${item.description} ${item.category} ${item.source}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))
  ), [periodRecords, query]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const fileError = validateImportFile(file);
    if (fileError) {
      setFileName(file.name);
      setSourceFile(null);
      setPendingImport([]);
      setImportErrors([fileError]);
      setSection("importacoes");
      event.target.value = "";
      return;
    }
    setFileName(file.name);
    setSourceFile(file);
    setNotice("");
    const text = await file.text();
    const result = file.name.toLowerCase().endsWith(".ofx") ? parseOfx(text) : parseCsv(text);
    setPendingImport(result.records);
    setImportErrors(result.errors);
    setSection("importacoes");
    event.target.value = "";
  }

  async function confirmImport() {
    if (!sourceFile || !pendingImport.length || isSaving) return;
    setIsSaving(true);
    setNotice("");
    try {
      const form = new FormData();
      form.set("organizationId", organizationId);
      form.set("file", sourceFile);
      form.set("records", JSON.stringify(pendingImport));
      const response = await fetch("/api/imports", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Falha ao persistir a importação.");
      const refreshed = await fetch("/api/finance/records?organizationId=" + organizationId, { cache: "no-store" });
      if (!refreshed.ok) throw new Error("Importação salva, mas não foi possível atualizar a listagem.");
      const data = await refreshed.json();
      setRecords(data.records ?? []);
      setNotice((payload.result?.inserted_count ?? 0) + " movimentação(ões) persistida(s); " + (payload.result?.duplicate_count ?? 0) + " duplicada(s).");
      setPendingImport([]);
      setImportErrors([]);
      setFileName("");
      setSourceFile(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha ao persistir a importação.");
    } finally {
      setIsSaving(false);
    }
  }

  function resetSession() {
    setRecords([]);
    setPendingImport([]);
    setImportErrors([]);
    setNotice("A sessão foi limpa.");
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
          <div className="topbar-right"><span className="period-label">PERÍODO</span><select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Período"><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="365">Últimos 12 meses</option></select><form action={signOut}><button className="secondary-button" type="submit">Sair</button></form><div className="avatar">R</div></div>
        </header>

        <div className="content">
          {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Fechar aviso">×</button></div>}

          {section === "visao-geral" && <>
            <div className="page-heading">
              <div><div className="eyebrow">PAINEL FINANCEIRO</div><h1>Visão geral</h1><p>Acompanhe a movimentação e a posição financeira da empresa.</p></div>
              <button className="primary-button" onClick={() => inputRef.current?.click()}><span>＋</span> Importar movimentações</button>
            </div>
            <div className="metric-grid">
              <Metric label="Entradas no período" value={formatCurrency(totals.incoming)} tone="positive" detail={periodRecords.length ? "Registros no período selecionado" : "Aguardando dados"} icon="↙" />
              <Metric label="Saídas no período" value={formatCurrency(totals.outgoing)} tone="negative" detail={records.length ? "Registros importados nesta sessão" : "Aguardando dados"} icon="↗" />
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
                <div className="quality-row"><span>Movimentações importadas</span><strong>{records.length}</strong></div>
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
            <div className="page-heading"><div><div className="eyebrow">LANÇAMENTOS</div><h1>Movimentações</h1><p>Consulte os registros financeiros carregados.</p></div><button className="primary-button" onClick={() => inputRef.current?.click()}>＋ Importar arquivo</button></div>
            <section className="panel"><div className="table-toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por descrição, categoria ou origem..." aria-label="Buscar movimentações" /><span>{filteredRecords.length} registro(s)</span></div>{filteredRecords.length ? <RecordTable records={[...filteredRecords].sort((a,b) => b.date.localeCompare(a.date))} /> : <EmptyState icon="⇄" title="Nenhuma movimentação encontrada" text="Carregue um extrato CSV ou OFX para consultar os lançamentos." action="Importar arquivo" onAction={() => inputRef.current?.click()} />}</section>
          </>}

          {section === "importacoes" && <>
            <div className="page-heading"><div><div className="eyebrow">ENTRADA DE DADOS</div><h1>Importações</h1><p>Carregue extratos e revise os registros antes de adicioná-los.</p></div></div>
            <section className="panel import-panel">
              <div className="upload-zone"><div className="upload-icon">⇧</div><h2>Importar extrato financeiro</h2><p>Selecione um arquivo CSV ou OFX para visualizar os registros.</p><button className="secondary-button" onClick={() => inputRef.current?.click()}>Selecionar arquivo</button><span className="file-hint">CSV ou OFX · Até 10 MiB</span></div>
              {fileName && <div className="import-file"><span className="file-badge">ARQ</span><div><strong>{fileName}</strong><span>{pendingImport.length} registro(s) reconhecido(s)</span></div></div>}
              {importErrors.length > 0 && <div className="error-list"><strong>Revisar importação</strong>{importErrors.map((error, index) => <p key={index}>{error}</p>)}</div>}
              {pendingImport.length > 0 && <><div className="preview-heading"><div><h2>Prévia dos registros</h2><p>Confira os dados antes de confirmar a importação.</p></div><span>{pendingImport.length} registros</span></div><RecordTable records={pendingImport.slice(0,8)} /><div className="import-actions"><button className="secondary-button" onClick={() => {setPendingImport([]);setFileName("");setSourceFile(null);setImportErrors([]);}}>Cancelar</button><button className="primary-button" onClick={confirmImport} disabled={isSaving}>{isSaving ? "Salvando..." : "Confirmar importação"}</button></div></>}
            </section>
            <div className="inline-note">Os registros confirmados são persistidos na organização ativa. Arquivos originais ficam em armazenamento privado com isolamento por tenant.</div>
          </>}

          {section === "contas" && <Placeholder title="Contas financeiras" eyebrow="ESTRUTURA FINANCEIRA" text="A estrutura de contas será configurada a partir das instituições, contas e fontes autorizadas para a empresa." />}
          {section === "relatorios" && <Placeholder title="Relatórios" eyebrow="ANÁLISE FINANCEIRA" text="Os relatórios serão habilitados após a validação das fontes e dos dados financeiros importados." />}
        </div>
      </section>
      <input ref={inputRef} className="hidden-input" type="file" accept=".csv,.ofx,text/csv,application/x-ofx" onChange={handleFile} />
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
  return <div className="table-wrap"><table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Origem</th><th>Status</th><th className="align-right">Valor</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td>{formatDate(record.date)}</td><td className="description-cell">{record.description}</td><td>{record.category}</td><td>{record.source}</td><td><span className="status-pill">{record.status}</span></td><td className={record.direction === "entrada" ? "align-right positive" : "align-right negative"}>{record.direction === "entrada" ? "+" : "−"} {formatCurrency(record.amount)}</td></tr>)}</tbody></table></div>;
}

function Placeholder({ title, eyebrow, text }: { title: string; eyebrow: string; text: string }) {
  return <><div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{text}</p></div></div><section className="panel placeholder-panel"><div className="empty-icon">◌</div><strong>Configuração em preparação</strong><p>Esta área será disponibilizada após a definição dos dados e regras operacionais correspondentes.</p></section></>;
}
