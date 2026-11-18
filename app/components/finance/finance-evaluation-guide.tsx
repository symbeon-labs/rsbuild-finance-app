"use client";

import { useEffect, useMemo, useState } from "react";
import type { NavSection } from "@/app/types/workspace";

type GuideItem = {
  title: string;
  purpose: string;
  benefit: string;
  evidence: string[];
};

type Evaluation = {
  id: string;
  organization: string;
  environment: "QA";
  module: "Finanças";
  feature: string;
  section: string;
  assessment: string;
  observation: string;
  version: "finance-guide-v0.1";
  createdAt: string;
};

const GUIDE: Partial<Record<NavSection, GuideItem>> = {
  "visao-geral": {
    title: "Visão geral financeira",
    purpose: "Reunir em um único painel as entradas, saídas, resultado do período e situação dos registros financeiros carregados.",
    benefit: "Facilita uma leitura inicial da movimentação e ajuda a identificar rapidamente períodos ou bases que precisam de conferência.",
    evidence: ["Totais de entradas e saídas coerentes com os registros apresentados", "Quantidade de movimentações e pendências de revisão", "Fontes identificadas e registros recentes"],
  },
  movimentacoes: {
    title: "Movimentações financeiras",
    purpose: "Consultar os lançamentos importados, pesquisar por descrição, categoria ou origem e revisar os registros disponíveis.",
    benefit: "Reduz o tempo gasto procurando lançamentos e oferece uma visão organizada das movimentações para conferência.",
    evidence: ["Registros apresentados com data, valor, natureza e origem", "Busca retornando os lançamentos esperados", "Exportação disponível quando houver registros"],
  },
  importacoes: {
    title: "Importação de extratos",
    purpose: "Receber arquivos bancários CSV ou OFX, apresentar uma prévia e permitir a revisão antes da confirmação.",
    benefit: "Organiza a entrada de dados financeiros e reduz erros ao permitir conferir o conteúdo antes de gravá-lo no ambiente.",
    evidence: ["Arquivo e instituição identificados quando disponíveis", "Campos reconhecidos e registros apresentados na prévia", "Erros destacados e confirmação bloqueada quando há inconsistências", "Importação só persistida após confirmação explícita"],
  },
  conciliacao: {
    title: "Conciliação bancária",
    purpose: "Comparar movimentações bancárias com lançamentos do ERP, destacando correspondências, itens pendentes e possíveis divergências.",
    benefit: "Ajuda a localizar diferenças entre fontes financeiras e direciona a revisão para os casos que exigem atenção.",
    evidence: ["Totais por conta e situação das correspondências", "Itens conciliados e não conciliados identificáveis", "Decisões manuais acompanhadas de justificativa", "Divergências submetidas à alçada adequada"],
  },
  baixas: {
    title: "Baixas e conciliação de títulos",
    purpose: "Relacionar títulos a receber com entradas bancárias e organizar os itens prontos, divergentes ou ainda não identificados.",
    benefit: "Apoia a conferência de recebimentos e prepara informações para uma eventual baixa no ERP, com revisão antes de qualquer ação.",
    evidence: ["Títulos relacionados a registros bancários", "Diferenças de valor e status sugerido visíveis", "Restrições de autorização respeitadas", "Exportação identificada como arquivo para conferência, sem baixa automática no ERP"],
  },
  relatorios: {
    title: "Relatórios DRE",
    purpose: "Área destinada à consolidação de demonstrativos de resultado e indicadores contábeis.",
    benefit: "Deverá apoiar a leitura do desempenho financeiro em uma visão gerencial consolidada.",
    evidence: ["A área informa que está em desenvolvimento", "Não apresentar demonstrativos como se já estivessem disponíveis", "Registrar quais indicadores e recortes seriam relevantes para a operação"],
  },
};

const STORAGE_KEY = "rsbuild_qa_finance_evaluations_v1";

export function FinanceEvaluationGuide({
  section,
  organizationName,
}: {
  section: NavSection;
  organizationName: string;
}) {
  const item = GUIDE[section];
  const [assessment, setAssessment] = useState("Ainda não avaliado");
  const [observation, setObservation] = useState("");
  const [entries, setEntries] = useState<Evaluation[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setEntries(parsed);
      }
    } catch {
      setFeedback("Não foi possível recuperar as avaliações salvas neste navegador.");
    }
  }, []);

  const sectionEntries = useMemo(
    () => entries.filter((entry) => entry.section === section),
    [entries, section],
  );

  if (!item) return null;
  const guideTitle = item.title;

  function saveEvaluation() {
    const entry: Evaluation = {
      id: `qa-finance-${Date.now()}`,
      organization: organizationName,
      environment: "QA",
      module: "Finanças",
      feature: guideTitle,
      section,
      assessment,
      observation: observation.trim(),
      version: "finance-guide-v0.1",
      createdAt: new Date().toISOString(),
    };
    const next = [...entries, entry];
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setEntries(next);
      setObservation("");
      setFeedback("Avaliação salva neste navegador.");
    } catch {
      setFeedback("Não foi possível salvar. Verifique o espaço disponível no navegador.");
    }
  }

  function exportEvaluations() {
    const payload = entries.filter((entry) => entry.organization === organizationName);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "avaliacoes-financeiras-mundo-do-sabor-qa.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="qa-evaluation-guide" aria-labelledby="qa-guide-title">
      <div className="qa-guide-header">
        <div>
          <div className="qa-guide-kicker">GUIA DE AVALIAÇÃO · AMBIENTE QA</div>
          <h2 id="qa-guide-title">{item.title}</h2>
          <p>Orientação para avaliação operacional desta funcionalidade.</p>
        </div>
        <button type="button" className="qa-guide-toggle" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
          {expanded ? "Recolher guia" : "Abrir guia"}
        </button>
      </div>

      {expanded && (
        <>
          <div className="qa-guide-grid">
            <article>
              <span>O QUE FAZ</span>
              <p>{item.purpose}</p>
            </article>
            <article>
              <span>BENEFÍCIO OPERACIONAL</span>
              <p>{item.benefit}</p>
            </article>
            <article>
              <span>O QUE OBSERVAR</span>
              <ul>{item.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}</ul>
            </article>
          </div>

          <div className="qa-guide-evaluation">
            <div className="qa-guide-evaluation-title">
              <div>
                <strong>Registrar avaliação</strong>
                <p>Informe como a funcionalidade se comportou durante a análise.</p>
              </div>
              <span>{sectionEntries.length} registro(s) nesta área</span>
            </div>
            <div className="qa-guide-form">
              <label>
                Resultado da avaliação
                <select value={assessment} onChange={(event) => setAssessment(event.target.value)}>
                  <option>Ainda não avaliado</option>
                  <option>Funcionou como esperado</option>
                  <option>Precisa de ajuste</option>
                  <option>Não compreendi a finalidade</option>
                  <option>Não foi possível testar</option>
                </select>
              </label>
              <label className="qa-guide-observation">
                Observações do avaliador
                <textarea value={observation} onChange={(event) => setObservation(event.target.value)} placeholder="Descreva o que observou, uma dificuldade ou uma sugestão operacional." rows={3} />
              </label>
            </div>
            <div className="qa-guide-actions">
              <span>Ambiente: Mundo do Sabor QA · Versão do guia: v0.1 · Salvamento local neste navegador</span>
              <div>
                <button type="button" className="secondary-button" onClick={exportEvaluations} disabled={!entries.length}>Exportar avaliações</button>
                <button type="button" className="primary-button" onClick={saveEvaluation} disabled={assessment === "Ainda não avaliado" && !observation.trim()}>Salvar avaliação</button>
              </div>
            </div>
            {feedback && <p className="qa-guide-feedback" role="status">{feedback}</p>}
            <p className="qa-guide-disclaimer">As avaliações são registros de observação do ambiente de testes. Não alteram lançamentos, saldos, títulos ou dados financeiros.</p>
          </div>
        </>
      )}
    </section>
  );
}
