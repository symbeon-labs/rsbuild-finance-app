"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import { FinancialRecord, formatCurrency, formatDate, parseCsv, parseOfx } from "@/lib/finance";

type Section = "visao-geral" | "movimentacoes" | "importacoes" | "contas" | "relatorios";

const navigation: { id: Section; label: string; icon: string }[] = [
  { id: "visao-geral", label: "Visão geral", icon: "◫" },
  { id: "movimentacoes", label: "Movimentações", icon: "⇄" },
  { id: "importacoes", label: "Importações", icon: "⇧" },
  { id: "contas", label: "Contas", icon: "▤" },
  { id: "relatorios", label: "Relatórios", icon: "▥" }
];

export default function FinanceWorkspace() {
  const [section, setSection] = useState<Section>("visao-geral");
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [pendingImport, setPendingImport] = useState<FinancialRecord[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("30");
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const totals = useMemo(() => {
    const incoming = records.filter((item) => item.direction === "entrada").reduce((sum, item) => sum + item.amount, 0);
    const outgoing = records.filter((item) => item.direction === "saída").reduce((sum, item) => sum + item.amount, 0);
    return { incoming, outgoing, balance: incoming - outgoing };
  }, [records]);

  const filteredRecords = useMemo(() => records.filter((item) =>
    `${item.description} ${item.category} ${item.source}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))
  ), [records, query]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setNotice("");
    const text = await file.text();
    const result = file.name.toLowerCase().endsWith(".ofx") ? parseOfx(text) : parseCsv(text);
    setPendingImport(result.records);
    setImportErrors(result.errors);
    setSection("importacoes");
    event.target.value = "";
  }

  function confirmImport() {
    setRecords((current) => [...pendingImport, ...current]);
    setNotice(`${pendingImport.length} movimentação(ões) adicionada(s) à sessão atual.`);
    setPendingImport([]);
    setImportErrors([]);
    setFileName("");
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
              <Metric label="Entradas no período" value={formatCurrency(totals.incoming)} tone="positive" detail={records.length ? "Registros importados nesta sessão" : "Aguardando dados"} icon="↙" />
              <Metric label="Saídas no período" value={formatCurrency(totals.outgoing)} tone="negative" detail={records.length ? "Registros importados nesta sessão" : "Aguardando dados"} icon="↗" />
              <Metric label="Resultado do período" value={formatCurrency(totals.balance)} tone="neutral" detail="Entradas menos saídas" icon="＝" />
              <Metric label="Movimentações" value={String(records.length)} tone="neutral" detail={records.filter((item) => item.status === "pendente").length + " pendentes de revisão"} icon="▤" />
            </div>
            <div className="dashboard-grid">
              <section className="panel chart-panel">
                <div className="panel-heading"><div><h2>Movimentação financeira</h2><p>Consolidação dos registros importados</p></div><span className="subtle-tag">BRL</span></div>
                {records.length ? <div className="activity-summary"><div><span>Entradas</span><strong className="positive">{formatCurrency(totals.incoming)}</strong></div><div><span>Saídas</span><strong className="negative">{formatCurrency(totals.outgoing)}</strong></div><div><span>Saldo líquido</span><strong>{formatCurrency(totals.balance)}</strong></div></div> : <EmptyState icon="⌁" title="Ainda não há movimentações" text="Importe um extrato bancário para começar a visualizar a posição financeira." action="Importar extrato" onAction={() => inputRef.current?.click()} />}
              </section>
              <section className="panel">
                <div className="panel-heading"><div><h2>Qualidade dos dados</h2><p>Situação dos registros carregados</p></div></div>
                <div className="quality-row"><span>Movimentações importadas</span><strong>{records.length}</strong></div>
                <div className="quality-row"><span>Pendentes de revisão</span><strong>{records.filter((item) => item.status === "pendente").length}</strong></div>
                <div className="quality-row"><span>Fontes identificadas</span><strong>{new Set(records.map((item) => item.source)).size}</strong></div>
                <div className="quality-footnote">A classificação e a conciliação serão habilitadas conforme a configuração das fontes.</div>
              </section>
            </div>
            <section className="panel recent-panel">
              <div className="panel-heading"><div><h2>Movimentações recentes</h2><p>Últimos registros adicionados</p></div><button className="text-button" onClick={() => setSection("movimentacoes")}>Ver todas <span>→</span></button></div>
              {records.length ? <RecordTable records={[...records].sort((a,b) => b.date.localeCompare(a.date)).slice(0,5)} /> : <div className="table-empty">Os registros aparecerão aqui após a primeira importação.</div>}
            </section>
          </>}

          {section === "movimentacoes" && <>
            <div className="page-heading"><div><div className="eyebrow">LANÇAMENTOS</div><h1>Movimentações</h1><p>Consulte os registros financeiros carregados.</p></div><button className="primary-button" onClick={() => inputRef.current?.click()}>＋ Importar arquivo</button></div>
            <section className="panel"><div className="table-toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por descrição, categoria ou origem..." aria-label="Buscar movimentações" /><span>{filteredRecords.length} registro(s)</span></div>{filteredRecords.length ? <RecordTable records={[...filteredRecords].sort((a,b) => b.date.localeCompare(a.date))} /> : <EmptyState icon="⇄" title="Nenhuma movimentação encontrada" text="Carregue um extrato CSV ou OFX para consultar os lançamentos." action="Importar arquivo" onAction={() => inputRef.current?.click()} />}</section>
          </>}

          {section === "importacoes" && <>
            <div className="page-heading"><div><div className="eyebrow">ENTRADA DE DADOS</div><h1>Importações</h1><p>Carregue extratos e revise os registros antes de adicioná-los.</p></div></div>
            <section className="panel import-panel">
              <div className="upload-zone"><div className="upload-icon">⇧</div><h2>Importar extrato financeiro</h2><p>Selecione um arquivo CSV ou OFX para visualizar os registros.</p><button className="secondary-button" onClick={() => inputRef.current?.click()}>Selecionar arquivo</button><span className="file-hint">CSV ou OFX · Até 10 MB</span></div>
              {fileName && <div className="import-file"><span className="file-badge">ARQ</span><div><strong>{fileName}</strong><span>{pendingImport.length} registro(s) reconhecido(s)</span></div></div>}
              {importErrors.length > 0 && <div className="error-list"><strong>Revisar importação</strong>{importErrors.map((error, index) => <p key={index}>{error}</p>)}</div>}
              {pendingImport.length > 0 && <><div className="preview-heading"><div><h2>Prévia dos registros</h2><p>Confira os dados antes de confirmar a importação.</p></div><span>{pendingImport.length} registros</span></div><RecordTable records={pendingImport.slice(0,8)} /><div className="import-actions"><button className="secondary-button" onClick={() => {setPendingImport([]);setFileName("");setImportErrors([]);}}>Cancelar</button><button className="primary-button" onClick={confirmImport}>Confirmar importação</button></div></>}
            </section>
            <div className="inline-note">Os registros desta versão permanecem disponíveis durante a sessão atual. A persistência segura e a conexão com as fontes serão configuradas na etapa de integração.</div>
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
