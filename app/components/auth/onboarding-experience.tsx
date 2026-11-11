"use client";

import Image from "next/image";
import { useState } from "react";
import { completeOnboarding, skipOnboarding, signOut } from "@/app/auth/actions";

interface OrganizationItem {
  id: string;
  display_name: string;
  slug: string;
}

interface OnboardingExperienceProps {
  userEmail: string;
  organizations: OrganizationItem[];
  defaultFullName?: string;
  defaultRoleTitle?: string;
  defaultTheme?: "sand" | "dark";
}

const PRESET_ROLES = [
  { label: "Diretoria & Sócios", icon: "🏛️" },
  { label: "Controladoria & Finanças", icon: "📊" },
  { label: "Operação & Faturamento", icon: "⚡" },
  { label: "Expedição & Logística", icon: "📦" },
  { label: "Auditoria Contábil", icon: "🔍" }
];

const MODULE_OPTIONS = [
  {
    id: "finance",
    title: "Finanças & Caixa",
    subtitle: "Extratos bancários normalizados e visão consolidada",
    icon: "💰"
  },
  {
    id: "reconciliation",
    title: "Reconciliação ERP",
    subtitle: "Cruzamento com títulos do Omie e baixas em lote",
    icon: "🔄"
  },
  {
    id: "logistics",
    title: "Logística & Pedidos",
    subtitle: "Blindagem de canhotos e esteira de pedidos WhatsApp",
    icon: "🚚"
  },
  {
    id: "audit",
    title: "Torre de Controle",
    subtitle: "Painel executivo, trilha pericial e governança",
    icon: "🗼"
  }
];

export function OnboardingExperience({
  userEmail,
  organizations,
  defaultFullName = "",
  defaultRoleTitle = "",
  defaultTheme = "sand"
}: OnboardingExperienceProps) {
  // Inferência inteligente do nome se estiver vazio (ex: joao.silva@ -> João Silva)
  const inferredName = defaultFullName || userEmail.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const [fullName, setFullName] = useState(inferredName);
  const [roleTitle, setRoleTitle] = useState(defaultRoleTitle || "Diretoria & Sócios");
  const [selectedOrgId, setSelectedOrgId] = useState(organizations[0]?.id || "");
  const [preferredModule, setPreferredModule] = useState("finance");
  const [preferredTheme, setPreferredTheme] = useState<"sand" | "dark">(defaultTheme);

  const isSingleOrg = organizations.length === 1;
  const currentOrg = organizations.find((org) => org.id === selectedOrgId) || organizations[0];

  return (
    <main className="onboarding-page">
      <div className="onboarding-ambient-glow" aria-hidden="true" />

      <div className="onboarding-container">
        {/* Header Institucional */}
        <header className="onboarding-header">
          <div className="onboarding-logo-wrap">
            <Image
              src="/brand/rsbuild-logo-dark.svg"
              alt="RSBUILD OS"
              width={200}
              height={64}
              priority
              className="onboarding-logo"
            />
          </div>
          <span className="onboarding-overline">PRIMEIRO ACESSO · PERSONALIZAÇÃO DO ESPAÇO</span>
          <h1>Bem-vindo ao RSBUILD OS</h1>
          <p>
            Configure seu perfil operacional para calibrar a experiência corporativa ao seu dia a dia.
            Seus dados ficam vinculados com segurança à sua credencial.
          </p>
        </header>

        {/* Formulário de Onboarding */}
        <form action={completeOnboarding} className="onboarding-form">
          <input type="hidden" name="organizationId" value={selectedOrgId} />
          <input type="hidden" name="preferredModule" value={preferredModule} />
          <input type="hidden" name="preferredTheme" value={preferredTheme} />

          {/* SEÇÃO 1: Identidade do Usuário */}
          <section className="onboarding-section">
            <div className="onboarding-section-title">
              <span className="onboarding-step-num">1</span>
              <div>
                <h2>Seu Perfil Operacional</h2>
                <p>Como você prefere ser identificado no workspace e nas trilhas de auditoria</p>
              </div>
            </div>

            <div className="onboarding-grid-fields">
              <label className="onboarding-field">
                <span>Nome completo ou preferido</span>
                <input
                  type="text"
                  name="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Flávio Costa"
                  required
                  maxLength={120}
                />
              </label>

              <label className="onboarding-field">
                <span>E-mail autenticado (corporativo)</span>
                <input
                  type="email"
                  value={userEmail}
                  disabled
                  className="onboarding-input-disabled"
                />
              </label>
            </div>

            <div className="onboarding-role-picker">
              <label>Sua função principal na operação:</label>
              <div className="onboarding-pills-wrap">
                {PRESET_ROLES.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className={`onboarding-pill ${roleTitle === preset.label ? "active" : ""}`}
                    onClick={() => setRoleTitle(preset.label)}
                  >
                    <span>{preset.icon}</span>
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
              <input
                type="text"
                name="roleTitle"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="Ou digite seu cargo específico..."
                className="onboarding-input-custom-role"
              />
            </div>
          </section>

          {/* SEÇÃO 2: Espaço de Trabalho (Isolamento Multi-Tenant) */}
          <section className="onboarding-section">
            <div className="onboarding-section-title">
              <span className="onboarding-step-num">2</span>
              <div>
                <h2>Espaço de Trabalho Corporativo</h2>
                <p>Organização vinculada à sua conta de acesso seguro</p>
              </div>
            </div>

            {isSingleOrg ? (
              /* Caso 1 única organização vinculada: Confirmação sem expor outros tenants */
              <div className="onboarding-org-card verified">
                <div className="onboarding-org-icon">🏢</div>
                <div className="onboarding-org-info">
                  <span className="onboarding-org-badge">AMBIENTE AUDITADO & HOMOLOGADO</span>
                  <h3>{currentOrg.display_name}</h3>
                  <p>
                    Seu acesso está configurado exclusivamente para este espaço de trabalho corporativo,
                    com segregação lógica e conformidade com a LGPD e governança financeira.
                  </p>
                </div>
                <div className="onboarding-check-badge">✓ Vinculado</div>
              </div>
            ) : (
              /* Caso múltiplas organizações: Seleção exclusiva entre os tenants permitidos */
              <div className="onboarding-multi-org-list">
                <p style={{ fontSize: "13px", color: "var(--muted, #7a6e65)", marginBottom: "12px" }}>
                  Sua conta possui acesso autorizado às seguintes organizações. Selecione seu ambiente inicial:
                </p>
                <div className="onboarding-org-cards-grid">
                  {organizations.map((org) => (
                    <button
                      key={org.id}
                      type="button"
                      className={`onboarding-org-select-card ${selectedOrgId === org.id ? "selected" : ""}`}
                      onClick={() => setSelectedOrgId(org.id)}
                    >
                      <div className="onboarding-card-radio" />
                      <div>
                        <strong>{org.display_name}</strong>
                        <span>Identificador: {org.slug}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* SEÇÃO 3: Foco Operacional (Módulo Inicial) */}
          <section className="onboarding-section">
            <div className="onboarding-section-title">
              <span className="onboarding-step-num">3</span>
              <div>
                <h2>Foco Operacional</h2>
                <p>Escolha a área em que você mais trabalha para definir sua visão inicial</p>
              </div>
            </div>

            <div className="onboarding-modules-grid">
              {MODULE_OPTIONS.map((mod) => (
                <button
                  key={mod.id}
                  type="button"
                  className={`onboarding-module-card ${preferredModule === mod.id ? "active" : ""}`}
                  onClick={() => setPreferredModule(mod.id)}
                >
                  <div className="onboarding-mod-icon">{mod.icon}</div>
                  <div className="onboarding-mod-text">
                    <strong>{mod.title}</strong>
                    <p>{mod.subtitle}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* SEÇÃO 4: Aparência e Tema Visual */}
          <section className="onboarding-section">
            <div className="onboarding-section-title">
              <span className="onboarding-step-num">4</span>
              <div>
                <h2>Aparência Visual</h2>
                <p>Selecione a paleta visual que melhor se adapta à sua iluminação e rotina</p>
              </div>
            </div>

            <div className="onboarding-themes-wrap">
              <button
                type="button"
                className={`onboarding-theme-btn ${preferredTheme === "sand" ? "active" : ""}`}
                onClick={() => setPreferredTheme("sand")}
              >
                <div className="onboarding-theme-swatch sand" />
                <div>
                  <strong>Arenito Corporativo</strong>
                  <span>Paleta clara institucional RSBUILD</span>
                </div>
              </button>

              <button
                type="button"
                className={`onboarding-theme-btn ${preferredTheme === "dark" ? "active" : ""}`}
                onClick={() => setPreferredTheme("dark")}
              >
                <div className="onboarding-theme-swatch dark" />
                <div>
                  <strong>Modo Dark Executivo</strong>
                  <span>Alto contraste para operações contínuas</span>
                </div>
              </button>
            </div>
          </section>

          {/* AÇÕES DE CONCLUSÃO */}
          <div className="onboarding-actions">
            <button type="submit" className="onboarding-submit-btn">
              <span>Concluir Personalização e Acessar Workspace</span>
              <span className="onboarding-arrow">→</span>
            </button>
          </div>
        </form>

        {/* Links Secundários / Pular ou Sair */}
        <div className="onboarding-footer-links">
          <form action={skipOnboarding} className="onboarding-skip-form">
            <input type="hidden" name="organizationId" value={selectedOrgId} />
            <button type="submit" className="onboarding-skip-btn">
              Pular personalização e entrar com padrões do sistema →
            </button>
          </form>

          <form action={signOut} className="onboarding-signout-form">
            <button type="submit" className="onboarding-signout-btn">
              Sair desta conta ({userEmail})
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

