"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MemberRole, ROLE_HIERARCHY, isDeveloperEmail } from "@/lib/permissions";
import {
  OrganizationId,
  ORGANIZATION_PRESETS,
  INITIAL_SAMPLE_RECORDS,
  INITIAL_SAMPLE_OMIE_RECORDS,
  INITIAL_SAMPLE_TITLES,
  INITIAL_SAMPLE_PROOFS,
  INITIAL_SAMPLE_HA_ORDERS
} from "@/app/types/workspace";
import { FinancialRecord, OmieRecord } from "@/lib/finance";
import { ReceivableTitle } from "@/lib/reconciliation";
import { DeliveryProof } from "@/lib/delivery";
import { ParsedWhatsAppOrder } from "@/lib/orders";

interface DevZonePanelProps {
  currentOrgId: string;
  currentOrgSlug: OrganizationId;
  realUserEmail: string;
  realRole: string;
  simulatedRole: MemberRole | null;
  onSimulateRole: (role: MemberRole | null) => void;
  // Handlers de injeção de dados
  recordsCount: number;
  titlesCount: number;
  proofsCount: number;
  ordersCount: number;
  onInjectBankRecords: (records: FinancialRecord[]) => void;
  onInjectOmieRecords: (records: OmieRecord[]) => void;
  onInjectTitles: (titles: ReceivableTitle[]) => void;
  onInjectProofs: (proofs: DeliveryProof[]) => void;
  onInjectOrders: (orders: ParsedWhatsAppOrder[]) => void;
  onResetAllData: () => void;
}

const DEV_AUTH_KEY = "rsbuild_dev_authenticated";
const DEV_PIN = "rsdev2026";

const TENANT_UUIDS: Record<OrganizationId, string> = {
  rsbuild: "0269fe05-0990-41a8-a28c-2919691eaf0f",
  hub_acai: "ff3cdab7-3b25-4ea7-aabf-5ae4f9cd9a76",
  mundo_sabor: "c5356414-adce-4fdc-941b-15cfe26b991e"
};

// Whitelist de e-mails de engenharia autorizados automaticamente
function isDevWhitelisted(email: string): boolean {
  return isDeveloperEmail(email);
}

export function DevZonePanel({
  currentOrgId,
  currentOrgSlug,
  realUserEmail,
  realRole,
  simulatedRole,
  onSimulateRole,
  recordsCount,
  titlesCount,
  proofsCount,
  ordersCount,
  onInjectBankRecords,
  onInjectOmieRecords,
  onInjectTitles,
  onInjectProofs,
  onInjectOrders,
  onResetAllData
}: DevZonePanelProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [pinPromptOpen, setPinPromptOpen] = useState(false);
  const [inputPin, setInputPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Verifica autorização (whitelist ou PIN na sessão)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(DEV_AUTH_KEY);
      if (stored === "true" || isDevWhitelisted(realUserEmail)) {
        setIsAuthorized(true);
      }
    } catch {
      // Ignora erro em ambientes restritos
    }
  }, [realUserEmail]);

  // Listener para o atalho de teclado Ctrl + Shift + D
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        if (isAuthorized) {
          setIsOpen((prev) => !prev);
        } else {
          setPinPromptOpen(true);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAuthorized]);

  function handleUnlockWithPin(e: React.FormEvent) {
    e.preventDefault();
    if (inputPin.trim() === DEV_PIN) {
      setIsAuthorized(true);
      try {
        sessionStorage.setItem(DEV_AUTH_KEY, "true");
      } catch {}
      setPinPromptOpen(false);
      setIsOpen(true);
      setInputPin("");
      setPinError(false);
    } else {
      setPinError(true);
    }
  }

  function showNotice(msg: string) {
    setFeedbackNotice(msg);
    setTimeout(() => setFeedbackNotice(null), 3500);
  }

  // Ações de injeção de teste
  function handleInjectFullBankData() {
    onInjectBankRecords(INITIAL_SAMPLE_RECORDS);
    onInjectOmieRecords(INITIAL_SAMPLE_OMIE_RECORDS);
    showNotice("Extrato Itaú/BNB com 6 movimentações (conciliáveis e divergentes) injetado!");
  }

  function handleInjectTitlesData() {
    onInjectTitles(INITIAL_SAMPLE_TITLES);
    showNotice("5 Títulos a receber (NF-4580 a NF-4584) injetados para teste de baixas!");
  }

  function handleInjectLogisticsData() {
    onInjectProofs(INITIAL_SAMPLE_PROOFS);
    onInjectOrders(INITIAL_SAMPLE_HA_ORDERS);
    showNotice("Canhotos com risco de protesto e pedidos de WhatsApp carregados!");
  }

  function handleSwitchTenant(presetId: OrganizationId) {
    const uuid = TENANT_UUIDS[presetId];
    if (!uuid) return;
    router.push(`/?organizationId=${encodeURIComponent(uuid)}&tab=visao-geral`);
    setIsOpen(false);
  }

  return (
    <>
      {/* Banner Superior quando Simulação de Perfil estiver Ativa */}
      {simulatedRole && (
        <aside
          aria-label="Aviso de Modo Engenharia"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 99999,
            background: "linear-gradient(90deg, #7c2d12 0%, #b45309 100%)",
            color: "#ffffff",
            padding: "6px 16px",
            fontSize: "12px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "14px" }}>🛠️</span>
            <span>
              <strong>MODO ENGENHARIA (ZONA DEV):</strong> Simulando alçada como{" "}
              <span
                style={{
                  background: "rgba(0,0,0,0.3)",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  textTransform: "uppercase"
                }}
              >
                {ROLE_HIERARCHY[simulatedRole]?.label || simulatedRole}
              </span>
              {" "}— Todas as travas e permissões da interface refletem este papel.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onSimulateRole(null)}
            style={{
              background: "#ffffff",
              color: "#7c2d12",
              border: "none",
              borderRadius: "4px",
              padding: "3px 10px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            Restaurar Perfil Real ({realRole})
          </button>
        </aside>
      )}

      {/* Gatilho Flutuante da Zona Dev (Exibido apenas para usuários autorizados) */}
      {isAuthorized && (
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          title="Abrir Zona Dev — Cockpit de Engenharia e Simulação de Alçadas"
          style={{
            position: "fixed",
            bottom: "16px",
            right: "16px",
            zIndex: 9999,
            background: "#18181b",
            color: "#f59e0b",
            border: "1px solid #78350f",
            borderRadius: "20px",
            padding: "8px 14px",
            fontSize: "11px",
            fontFamily: "monospace",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}
        >
          <span style={{ fontSize: "13px" }}>🛠️</span>
          <span>ZONA DEV</span>
          {simulatedRole && (
            <span
              style={{
                background: "#f59e0b",
                color: "#18181b",
                padding: "1px 6px",
                borderRadius: "10px",
                fontSize: "9px"
              }}
            >
              SIMULANDO
            </span>
          )}
        </button>
      )}

      {/* Modal de Desbloqueio por PIN (Quando ativado via atalho sem whitelist prévia) */}
      {pinPromptOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100000,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            padding: "16px"
          }}
          onClick={() => setPinPromptOpen(false)}
        >
          <div
            style={{
              background: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: "12px",
              padding: "24px",
              width: "min(100%, 360px)",
              color: "#f4f4f5"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <span style={{ fontSize: "18px" }}>🔒</span>
              <h3 style={{ margin: 0, fontSize: "15px" }}>Acesso à Zona Dev</h3>
            </div>
            <p style={{ fontSize: "12px", color: "#a1a1aa", marginTop: "4px" }}>
              Área de engenharia acima dos acessos operacionais e da diretoria. Digite o PIN de autorização técnica:
            </p>
            <form onSubmit={handleUnlockWithPin} style={{ marginTop: "16px" }}>
              <input
                type="password"
                autoFocus
                placeholder="PIN de Engenharia"
                value={inputPin}
                onChange={(e) => {
                  setInputPin(e.target.value);
                  setPinError(false);
                }}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "#27272a",
                  border: pinError ? "1px solid #ef4444" : "1px solid #52525b",
                  borderRadius: "6px",
                  color: "#ffffff",
                  fontSize: "14px",
                  boxSizing: "border-box"
                }}
              />
              {pinError && (
                <div style={{ color: "#ef4444", fontSize: "11px", marginTop: "6px" }}>
                  PIN incorreto. Acesso restrito a engenheiros.
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
                <button
                  type="button"
                  onClick={() => setPinPromptOpen(false)}
                  style={{
                    background: "transparent",
                    color: "#a1a1aa",
                    border: "1px solid #3f3f46",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    fontSize: "12px",
                    cursor: "pointer"
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    background: "#f59e0b",
                    color: "#18181b",
                    border: "none",
                    borderRadius: "6px",
                    padding: "6px 14px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  Desbloquear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drawer Lateral da Zona Dev */}
      {isOpen && (
        <aside
          aria-label="Cockpit de Engenharia"
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: "min(100vw, 420px)",
            background: "#09090b",
            borderLeft: "1px solid #27272a",
            zIndex: 100000,
            boxShadow: "-8px 0 24px rgba(0,0,0,0.6)",
            display: "flex",
            flexDirection: "column",
            color: "#f4f4f5",
            fontFamily: "var(--font-sans, system-ui, sans-serif)",
            overflow: "hidden"
          }}
        >
          {/* Header do Drawer */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid #27272a",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#18181b"
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "16px" }}>🛠️</span>
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "1px", color: "#f59e0b" }}>
                  ENGENHARIA · ZONA DEV
                </span>
              </div>
              <h3 style={{ margin: "2px 0 0 0", fontSize: "15px", color: "#ffffff" }}>
                Cockpit de Simulação e Controle
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "#a1a1aa",
                fontSize: "18px",
                cursor: "pointer"
              }}
            >
              ✕
            </button>
          </div>

          {/* Feedback temporário */}
          {feedbackNotice && (
            <div
              style={{
                background: "#065f46",
                color: "#a7f3d0",
                padding: "8px 16px",
                fontSize: "12px",
                fontWeight: 600,
                borderBottom: "1px solid #047857"
              }}
            >
              {feedbackNotice}
            </div>
          )}

          {/* Conteúdo Rolável */}
          <div style={{ padding: "20px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "22px" }}>
            
            {/* Bloco 1: Simulador de Papéis (Role Impersonator) */}
            <section style={{ background: "#18181b", padding: "14px", borderRadius: "8px", border: "1px solid #27272a" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#e4e4e7" }}>
                  SIMULAR ALÇADA (VER COMO...)
                </span>
                {simulatedRole && (
                  <button
                    type="button"
                    onClick={() => onSimulateRole(null)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#f59e0b",
                      fontSize: "11px",
                      cursor: "pointer",
                      textDecoration: "underline"
                    }}
                  >
                    Restaurar Real
                  </button>
                )}
              </div>
              <p style={{ fontSize: "11px", color: "#a1a1aa", margin: "0 0 12px 0" }}>
                Alterne instantaneamente o papel para testar o que Flávio (Diretoria) ou Vitor (Operação) conseguem fazer.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                {(["owner", "admin", "operator", "viewer"] as MemberRole[]).map((r) => {
                  const meta = ROLE_HIERARCHY[r];
                  const isActive = (simulatedRole || realRole) === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => onSimulateRole(r)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: isActive ? "1px solid #f59e0b" : "1px solid #3f3f46",
                        background: isActive ? "rgba(245, 158, 11, 0.15)" : "#27272a",
                        color: isActive ? "#f59e0b" : "#e4e4e7",
                        fontSize: "11px",
                        fontWeight: 600,
                        textAlign: "left",
                        cursor: "pointer"
                      }}
                    >
                      <div>{meta.badge}</div>
                      <div style={{ fontSize: "10px", color: "#a1a1aa", marginTop: "2px" }}>
                        {r === "operator" ? "Sem baixas no ERP" : r === "admin" ? "Aprova baixas" : r === "owner" ? "Acesso total" : "Somente leitura"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Bloco 2: Seletor Rápido de Tenants do Supabase */}
            <section style={{ background: "#18181b", padding: "14px", borderRadius: "8px", border: "1px solid #27272a" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#e4e4e7" }}>
                ALTERNÂNCIA DE TENANTS (SUPABASE)
              </span>
              <p style={{ fontSize: "11px", color: "#a1a1aa", margin: "4px 0 12px 0" }}>
                Muda a organização autenticada mantendo os UUIDs reais do banco.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {ORGANIZATION_PRESETS.map((p) => {
                  const isCurrent = currentOrgSlug === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSwitchTenant(p.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        borderRadius: "6px",
                        border: isCurrent ? "1px solid #10b981" : "1px solid #3f3f46",
                        background: isCurrent ? "rgba(16, 185, 129, 0.12)" : "#27272a",
                        color: "#ffffff",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        textAlign: "left"
                      }}
                    >
                      <div>
                        <div>{p.name}</div>
                        <div style={{ fontSize: "10px", color: "#a1a1aa", fontFamily: "monospace" }}>
                          slug: {p.id} · {TENANT_UUIDS[p.id]?.slice(0, 8)}…
                        </div>
                      </div>
                      {isCurrent && <span style={{ color: "#10b981", fontSize: "11px" }}>● ATIVO</span>}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Bloco 3: Injeção de Massa de Dados para Testes */}
            <section style={{ background: "#18181b", padding: "14px", borderRadius: "8px", border: "1px solid #27272a" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#e4e4e7" }}>
                INJETOR DE CARGA E FIXTURES
              </span>
              <p style={{ fontSize: "11px", color: "#a1a1aa", margin: "4px 0 12px 0" }}>
                Carrega cenários práticos sem precisar caçar arquivos no disco.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <button
                  type="button"
                  onClick={handleInjectFullBankData}
                  style={{
                    background: "#27272a",
                    border: "1px solid #3f3f46",
                    color: "#e4e4e7",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    fontSize: "12px",
                    fontWeight: 600,
                    textAlign: "left",
                    cursor: "pointer"
                  }}
                >
                  🏦 Injetar Extrato Bancário Completo (Itaú/BNB)
                  <div style={{ fontSize: "10px", color: "#a1a1aa" }}>
                    6 lançamentos (inclui match exato e divergência de valor para teste)
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleInjectTitlesData}
                  style={{
                    background: "#27272a",
                    border: "1px solid #3f3f46",
                    color: "#e4e4e7",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    fontSize: "12px",
                    fontWeight: 600,
                    textAlign: "left",
                    cursor: "pointer"
                  }}
                >
                  📑 Injetar Títulos do Contas a Receber (Omie)
                  <div style={{ fontSize: "10px", color: "#a1a1aa" }}>
                    5 títulos para testar lote de baixas e liquidação
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleInjectLogisticsData}
                  style={{
                    background: "#27272a",
                    border: "1px solid #3f3f46",
                    color: "#e4e4e7",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    fontSize: "12px",
                    fontWeight: 600,
                    textAlign: "left",
                    cursor: "pointer"
                  }}
                >
                  📦 Injetar Pedidos WhatsApp & Canhotos
                  <div style={{ fontSize: "10px", color: "#a1a1aa" }}>
                    Notas com risco de protesto e esteira de açaí/sorvetes
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onResetAllData();
                    showNotice("Todos os dados da sessão foram reiniciados.");
                  }}
                  style={{
                    background: "rgba(239, 68, 68, 0.12)",
                    border: "1px solid #7f1d1d",
                    color: "#ef4444",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    fontSize: "12px",
                    fontWeight: 600,
                    textAlign: "left",
                    cursor: "pointer"
                  }}
                >
                  🔄 Reset Total da Sessão
                  <div style={{ fontSize: "10px", color: "#fca5a5" }}>
                    Limpa localStorage e restaura estado original
                  </div>
                </button>
              </div>
            </section>

            {/* Bloco 4: Telemetria Técnica e Diagnóstico */}
            <section style={{ background: "#18181b", padding: "14px", borderRadius: "8px", border: "1px solid #27272a" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#e4e4e7" }}>
                TELEMETRIA TÉCNICA EM TEMPO REAL
              </span>
              <div style={{ marginTop: "8px", fontSize: "11px", fontFamily: "monospace", display: "grid", gap: "6px", color: "#a1a1aa" }}>
                <div><strong>Org UUID:</strong> <span style={{ color: "#ffffff" }}>{currentOrgId}</span></div>
                <div><strong>Slug Canônico:</strong> <span style={{ color: "#ffffff" }}>{currentOrgSlug}</span></div>
                <div><strong>Sessão Real:</strong> <span style={{ color: "#ffffff" }}>{realUserEmail}</span> ({realRole})</div>
                <div><strong>Papel Efetivo:</strong> <span style={{ color: simulatedRole ? "#f59e0b" : "#ffffff" }}>{simulatedRole || realRole}</span></div>
                <div><strong>Registros Bancários:</strong> <span style={{ color: "#ffffff" }}>{recordsCount}</span></div>
                <div><strong>Títulos a Receber:</strong> <span style={{ color: "#ffffff" }}>{titlesCount}</span></div>
                <div><strong>Canhotos Registrados:</strong> <span style={{ color: "#ffffff" }}>{proofsCount}</span></div>
                <div><strong>Pedidos WhatsApp:</strong> <span style={{ color: "#ffffff" }}>{ordersCount}</span></div>
              </div>
            </section>

          </div>

          {/* Rodapé Fixo */}
          <div
            style={{
              padding: "12px 20px",
              borderTop: "1px solid #27272a",
              background: "#18181b",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "11px",
              color: "#71717a"
            }}
          >
            <span>RSBUILD OS · v2.0.0 (Engenharia)</span>
            <span>Atalho: <code>Ctrl + Shift + D</code></span>
          </div>
        </aside>
      )}
    </>
  );
}
