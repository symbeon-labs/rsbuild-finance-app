"use client";

import { useState } from "react";

const NEEDS = [
  "Finanças & Caixa",
  "Reconciliação & Baixas",
  "Logística & Expedição",
  "Auditoria & Governança",
  "Outro"
];

const INTENTIONS = [
  "Conhecer a plataforma",
  "Avaliar uma integração",
  "Estruturar um projeto-piloto",
  "Resolver um problema operacional específico",
  "Avaliar aplicação em múltiplas empresas"
];

const STEPS = [
  { title: "Identificação", sub: "Quem é você e por qual empresa fala." },
  { title: "Estrutura operacional", sub: "O contexto da sua operação." },
  { title: "Necessidades", sub: "Quais frentes fazem sentido para o seu caso." },
  { title: "Problema prioritário", sub: "O desafio que mais pesa hoje." },
  { title: "Intenção", sub: "Como você quer dar o próximo passo." }
];

type FormState = {
  companyName: string; segment: string; contactName: string; contactRole: string;
  contactEmail: string; contactPhone: string;
  unitsCount: string; systemsUsed: string; erpUsed: string; areasInvolved: string;
  needs: string[];
  priorityProcess: string; problemFrequency: string; problemImpact: string;
  currentProcess: string; expectedResult: string; intention: string;
};

const INITIAL: FormState = {
  companyName: "", segment: "", contactName: "", contactRole: "",
  contactEmail: "", contactPhone: "",
  unitsCount: "", systemsUsed: "", erpUsed: "", areasInvolved: "",
  needs: [],
  priorityProcess: "", problemFrequency: "", problemImpact: "",
  currentProcess: "", expectedResult: "", intention: ""
};

export function DiagnosticForm() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  function toggleNeed(need: string) {
    setForm((f) => ({
      ...f,
      needs: f.needs.includes(need) ? f.needs.filter((n) => n !== need) : [...f.needs, need]
    }));
  }

  function validStep(): boolean {
    if (step === 0) return Boolean(form.companyName.trim() && form.contactName.trim() && /@[^\s@]+\.[^\s@]+$/.test(form.contactEmail));
    if (step === 4) return Boolean(form.intention);
    return true;
  }

  async function submit() {
    setStatus("sending"); setError("");
    try {
      const res = await fetch("/api/diagnostic-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "submit_failed");
      }
      setStatus("done");
    } catch {
      setStatus("idle");
      setError("Não foi possível enviar agora. Tente novamente em instantes ou escreva para suporte@rsbuild.com.br.");
    }
  }

  if (status === "done") {
    return (
      <div className="inst-form-wrap">
        <div className="inst-form-success">
          <div className="big">✓</div>
          <h3>Solicitação recebida</h3>
          <p className="step-sub" style={{ marginBottom: 0 }}>
            Obrigado. Nossa equipe vai analisar o contexto da {form.companyName} e retornar
            em breve para agendar o diagnóstico operacional.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="inst-form-wrap">
      <div className="inst-form-steps" aria-hidden="true">
        {STEPS.map((_, i) => <span key={i} className={i <= step ? "active" : ""} />)}
      </div>

      {step === 0 && (
        <>
          <h3>Identificação</h3>
          <p className="step-sub">{STEPS[0].sub}</p>
          <div className="inst-field-row">
            <div className="inst-field">
              <label>Empresa <span className="req">*</span></label>
              <input value={form.companyName} onChange={set("companyName")} maxLength={200} required />
            </div>
            <div className="inst-field">
              <label>Segmento</label>
              <input value={form.segment} onChange={set("segment")} maxLength={120} placeholder="Ex.: Distribuição, Indústria, Varejo" />
            </div>
          </div>
          <div className="inst-field-row">
            <div className="inst-field">
              <label>Nome do responsável <span className="req">*</span></label>
              <input value={form.contactName} onChange={set("contactName")} maxLength={200} required />
            </div>
            <div className="inst-field">
              <label>Cargo</label>
              <input value={form.contactRole} onChange={set("contactRole")} maxLength={120} />
            </div>
          </div>
          <div className="inst-field-row">
            <div className="inst-field">
              <label>E-mail corporativo <span className="req">*</span></label>
              <input type="email" value={form.contactEmail} onChange={set("contactEmail")} maxLength={254} required />
            </div>
            <div className="inst-field">
              <label>Telefone</label>
              <input type="tel" value={form.contactPhone} onChange={set("contactPhone")} maxLength={40} />
            </div>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <h3>Estrutura operacional</h3>
          <p className="step-sub">{STEPS[1].sub}</p>
          <div className="inst-field-row">
            <div className="inst-field">
              <label>Quantidade de unidades</label>
              <input value={form.unitsCount} onChange={set("unitsCount")} maxLength={60} placeholder="Ex.: 3 lojas, 1 CD" />
            </div>
            <div className="inst-field">
              <label>ERP utilizado</label>
              <input value={form.erpUsed} onChange={set("erpUsed")} maxLength={200} placeholder="Ex.: Omie, TOTVS, planilhas" />
            </div>
          </div>
          <div className="inst-field">
            <label>Sistemas utilizados</label>
            <input value={form.systemsUsed} onChange={set("systemsUsed")} maxLength={500} placeholder="Ex.: banco, e-commerce, WMS, mensageria" />
          </div>
          <div className="inst-field">
            <label>Principais áreas envolvidas</label>
            <input value={form.areasInvolved} onChange={set("areasInvolved")} maxLength={500} placeholder="Ex.: Financeiro, Expedição, Fiscal" />
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h3>Necessidades</h3>
          <p className="step-sub">{STEPS[2].sub} Selecione uma ou mais opções.</p>
          <div className="inst-checks">
            {NEEDS.map((need) => (
              <label key={need} className="inst-check">
                <input type="checkbox" checked={form.needs.includes(need)} onChange={() => toggleNeed(need)} />
                {need}
              </label>
            ))}
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h3>Problema prioritário</h3>
          <p className="step-sub">{STEPS[3].sub} Responda com o que souber — textos longos não são obrigatórios.</p>
          <div className="inst-field">
            <label>Qual processo apresenta maior dificuldade?</label>
            <input value={form.priorityProcess} onChange={set("priorityProcess")} maxLength={4000} placeholder="Ex.: Conciliação de recebimentos" />
          </div>
          <div className="inst-field-row">
            <div className="inst-field">
              <label>Frequência do problema</label>
              <select value={form.problemFrequency} onChange={set("problemFrequency")}>
                <option value="">Selecionar…</option>
                <option>Diário</option>
                <option>Semanal</option>
                <option>Mensal</option>
                <option>Eventual</option>
              </select>
            </div>
            <div className="inst-field">
              <label>Impacto na operação</label>
              <select value={form.problemImpact} onChange={set("problemImpact")}>
                <option value="">Selecionar…</option>
                <option>Crítico — afeta resultados</option>
                <option>Alto — gera retrabalho</option>
                <option>Médio — dificulta gestão</option>
                <option>Baixo — incômodo pontual</option>
              </select>
            </div>
          </div>
          <div className="inst-field">
            <label>Como esse processo é realizado hoje?</label>
            <textarea value={form.currentProcess} onChange={set("currentProcess")} placeholder="Descreva brevemente o fluxo atual…" />
          </div>
          <div className="inst-field">
            <label>Qual resultado você espera alcançar?</label>
            <textarea value={form.expectedResult} onChange={set("expectedResult")} placeholder="Ex.: visibilidade diária do caixa, baixa automática de títulos…" />
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <h3>Intenção</h3>
          <p className="step-sub">{STEPS[4].sub}</p>
          <div style={{ display: "grid", gap: 10 }}>
            {INTENTIONS.map((intent) => (
              <label key={intent} className="inst-check">
                <input type="radio" name="intention" checked={form.intention === intent} onChange={() => setForm((f) => ({ ...f, intention: intent }))} />
                {intent}
              </label>
            ))}
          </div>
        </>
      )}

      {error && <p className="inst-form-error" role="alert">{error}</p>}

      <div className="inst-form-actions">
        <button
          type="button"
          className="inst-cta ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || status === "sending"}
          style={{ visibility: step === 0 ? "hidden" : "visible" }}
        >← Voltar</button>
        {step < STEPS.length - 1 ? (
          <button type="button" className="inst-cta" onClick={() => setStep((s) => s + 1)} disabled={!validStep()}>
            Continuar →
          </button>
        ) : (
          <button type="button" className="inst-cta" onClick={submit} disabled={!validStep() || status === "sending"}>
            {status === "sending" ? "Enviando…" : "Solicitar diagnóstico"}
          </button>
        )}
      </div>

      <p className="inst-form-note">
        Seus dados são usados apenas para avaliar a aderência da plataforma à sua operação.
        Não solicitamos credenciais, extratos ou documentos confidenciais nesta etapa.
        Ao enviar, você concorda com o tratamento de dados pessoais conforme nossa política de privacidade.
      </p>
    </div>
  );
}
