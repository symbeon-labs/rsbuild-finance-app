"use client";

import { useEffect, useMemo, useState } from "react";
import type { NavSection } from "@/app/types/workspace";
import { formatDatePtBr, formatDateTimePtBr } from "@/lib/date-format";

type GuideItem = { title: string; purpose: string; benefit: string; evidence: string[] };
type Evaluation = {
  id: string; organization_id: string; feature_key: string; assessment: string;
  scenario_summary: string; observation: string; operational_impact: string;
  rubric_version: string; created_by: string; created_at: string;
};

const GUIDE: Partial<Record<NavSection, GuideItem>> = {
  "visao-geral": {
    title: "Visão geral financeira",
    purpose: "Reunir em um único painel as entradas, saídas, resultado do período e situação dos registros financeiros carregados.",
    benefit: "Ajuda a entender o movimento do período e a localizar informações que precisam de conferência.",
    evidence: ["Totais de entradas e saídas coerentes com os registros apresentados", "Quantidade de movimentações e pendências de revisão", "Fontes identificadas e registros recentes"],
  },
  movimentacoes: {
    title: "Movimentações financeiras",
    purpose: "Consultar os lançamentos importados, pesquisar por descrição, categoria ou origem e revisar os registros disponíveis.",
    benefit: "Organiza a consulta e facilita localizar lançamentos que precisam ser conferidos.",
    evidence: ["Registros apresentados com data, valor, natureza e origem", "Busca retornando os lançamentos esperados", "Exportação disponível quando houver registros"],
  },
  importacoes: {
    title: "Importação de extratos",
    purpose: "Receber arquivos bancários CSV ou OFX, apresentar uma prévia e permitir a revisão antes da confirmação.",
    benefit: "Permite revisar os dados antes da confirmação e identificar inconsistências na entrada.",
    evidence: ["Arquivo e instituição identificados quando disponíveis", "Campos reconhecidos e registros apresentados na prévia", "Erros destacados e confirmação bloqueada quando há inconsistências", "Importação só persistida após confirmação explícita"],
  },
  conciliacao: {
    title: "Conciliação bancária",
    purpose: "Comparar movimentações bancárias com lançamentos do ERP, destacando correspondências, itens pendentes e possíveis divergências.",
    benefit: "Destaca diferenças entre fontes e direciona a conferência para os itens pendentes.",
    evidence: ["Totais por conta e situação das correspondências", "Itens conciliados e não conciliados identificáveis", "Decisões manuais acompanhadas de justificativa", "Divergências submetidas à alçada adequada"],
  },
  baixas: {
    title: "Baixas e conciliação de títulos",
    purpose: "Relacionar títulos a receber com entradas bancárias e organizar os itens prontos, divergentes ou ainda não identificados.",
    benefit: "Organiza a conferência dos recebimentos e destaca o que precisa de revisão antes de uma baixa.",
    evidence: ["Títulos relacionados a registros bancários", "Diferenças de valor e status sugerido visíveis", "Restrições de autorização respeitadas", "Exportação identificada como arquivo para conferência, sem baixa automática no ERP"],
  },
  relatorios: {
    title: "Relatórios DRE",
    purpose: "Área destinada à consolidação de demonstrativos de resultado e indicadores contábeis.",
    benefit: "Quando estiver disponível, deverá apoiar a leitura gerencial do desempenho financeiro.",
    evidence: ["A área informa que está em desenvolvimento", "Não apresentar demonstrativos como se já estivessem disponíveis", "Registrar quais indicadores e recortes seriam relevantes para a operação"],
  },
};

const ASSESSMENTS = ["Atendeu ao esperado", "Atendeu parcialmente", "Não atendeu", "Não foi possível verificar", "Não se aplica"];

export function FinanceEvaluationGuide({
  section, organizationName, organizationId,
}: { section: NavSection; organizationName: string; organizationId: string }) {
  const item = GUIDE[section];
  const [assessment, setAssessment] = useState("Não avaliado");
  const [scenarioSummary, setScenarioSummary] = useState("");
  const [observation, setObservation] = useState("");
  const [operationalImpact, setOperationalImpact] = useState("");
  const [entries, setEntries] = useState<Evaluation[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadEvaluations() {
    setLoading(true);
    try {
      const response = await fetch(`/api/qa-evaluations?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível recuperar as avaliações.");
      setEntries(Array.isArray(payload.evaluations) ? payload.evaluations : []);
      setFeedback("");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Falha ao carregar avaliações.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void loadEvaluations(); }, [organizationId]);

  const sectionEntries = useMemo(() => entries.filter((entry) => entry.feature_key === section), [entries, section]);
  const latestSectionEntry = sectionEntries[0];
  const latestSectionDate = latestSectionEntry
    ? formatDatePtBr(latestSectionEntry.created_at)
    : null;
  if (!item) return null;

  async function saveEvaluation() {
    if (assessment === "Não avaliado") return;
    setSaving(true);
    try {
      const response = await fetch("/api/qa-evaluations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId, featureKey: section, assessment,
          scenarioSummary, observation, operationalImpact, evidenceRefs: [],
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível salvar a avaliação.");
      setAssessment("Não avaliado"); setScenarioSummary(""); setObservation(""); setOperationalImpact("");
      await loadEvaluations();
      setFeedback("Avaliação registrada no ambiente QA.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Falha ao salvar avaliação.");
    } finally { setSaving(false); }
  }

  function exportEvaluations() {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "avaliacoes-financeiras-qa.json";
    anchor.click(); URL.revokeObjectURL(url);
  }

  return (
    <section className="qa-evaluation-guide" aria-labelledby="qa-guide-title">
      <div className={`qa-guide-header${expanded ? " is-expanded" : " is-compact"}`}>
        <div className="qa-guide-heading">
          <div className="qa-guide-kicker"><span className="qa-guide-kicker-dot" /> HOMOLOGAÇÃO · AMBIENTE QA</div>
          <h2 id="qa-guide-title">{item.title}</h2>
          {expanded && <>
            <p>Verifique o comportamento apresentado, compare com os critérios e registre evidências observáveis da operação.</p>
            <div className="qa-guide-context"><span>ROTEIRO v0.2</span><span>REGISTRO AUDITÁVEL</span></div>
          </>}
        </div>
        <div className="qa-guide-header-meta">
          <div className="qa-guide-count" aria-live="polite">
            <strong>{loading ? "…" : sectionEntries.length}</strong>
            <span>{sectionEntries.length === 1 ? "avaliação registrada" : "avaliações registradas"}</span>
          </div>
          {latestSectionDate && <span className="qa-guide-last-activity">Último registro · {latestSectionDate}</span>}
          <button type="button" className="qa-guide-toggle" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-controls="qa-guide-content">
            <span>{expanded ? "Recolher" : "Abrir roteiro"}</span>
            <span className={`qa-guide-toggle-icon${expanded ? " is-open" : ""}`} aria-hidden="true">⌄</span>
          </button>
        </div>
      </div>
      {feedback && !expanded && <p className="qa-guide-feedback qa-guide-feedback-compact" role="status">{feedback}</p>}
      {expanded && <div id="qa-guide-content" className="qa-guide-content">
        <div className="qa-guide-grid">
          <article><span>FINALIDADE</span><p>{item.purpose}</p></article>
          <article><span>BENEFÍCIO OPERACIONAL</span><p>{item.benefit}</p></article>
          <article><span>CRITÉRIOS DE VERIFICAÇÃO</span><ul>{item.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}</ul></article>
        </div>
        <div className="qa-guide-evaluation">
          <div className="qa-guide-evaluation-title">
            <div><strong>Resultado da verificação</strong><p>Registre o cenário testado, o resultado observado e o impacto percebido na operação.</p></div>
            <span>{loading ? "Carregando…" : `${sectionEntries.length} registro(s) nesta área`}</span>
          </div>
          <div className="qa-guide-form">
            <label>Resultado da avaliação
              <select value={assessment} onChange={(event) => setAssessment(event.target.value)}>
                <option>Não avaliado</option>{ASSESSMENTS.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label className="qa-guide-observation">Cenário testado
              <textarea value={scenarioSummary} onChange={(event) => setScenarioSummary(event.target.value)} placeholder="O que você tentou fazer?" rows={2} />
            </label>
            <label className="qa-guide-observation">Resultado observado
              <textarea value={observation} onChange={(event) => setObservation(event.target.value)} placeholder="O que aconteceu? Inclua divergências ou dificuldades." rows={3} />
            </label>
            <label className="qa-guide-observation">Impacto na operação
              <textarea value={operationalImpact} onChange={(event) => setOperationalImpact(event.target.value)} placeholder="Como isso afeta a rotina da empresa ou poderia melhorá-la?" rows={2} />
            </label>
          </div>
          <div className="qa-guide-actions">
            <span>{organizationName} · QA · Finanças · Guia v0.2 · Registro centralizado</span>
            <div>
              <button type="button" className="secondary-button" onClick={exportEvaluations} disabled={!entries.length}>Exportar avaliações</button>
              <button type="button" className="primary-button" onClick={saveEvaluation} disabled={saving || assessment === "Não avaliado" || (!scenarioSummary.trim() && !observation.trim() && !operationalImpact.trim())}>
                {saving ? "Salvando…" : "Registrar avaliação"}
              </button>
            </div>
          </div>
          {feedback && <p className="qa-guide-feedback" role="status">{feedback}</p>}
          {sectionEntries.length > 0 && <div className="qa-guide-history" aria-label="Histórico de avaliações">
            <strong>Histórico registrado</strong>
            {sectionEntries.map((entry) => <article key={entry.id}>
              <div className="qa-history-meta">
                <b>{entry.assessment}</b>
                <time dateTime={entry.created_at}>{formatDateTimePtBr(entry.created_at)}</time>
                <span className="qa-history-id" title={entry.id}>ID {entry.id.slice(0, 8)}…</span>
                <button type="button" onClick={() => void navigator.clipboard.writeText(entry.id)} aria-label="Copiar identificador da avaliação">Copiar ID</button>
              </div>
              {entry.scenario_summary && <p><span>Cenário:</span> {entry.scenario_summary}</p>}
              {entry.observation && <p><span>Resultado:</span> {entry.observation}</p>}
              {entry.operational_impact && <p><span>Impacto:</span> {entry.operational_impact}</p>}
            </article>)}
          </div>}
          <p className="qa-guide-disclaimer">Os registros são vinculados ao avaliador e ao ambiente QA. A avaliação não altera lançamentos, saldos ou títulos e não representa homologação técnica.</p>
        </div>
      </div>}
    </section>
  );
}
