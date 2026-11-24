/**
 * RSBUILD OS · Motor do Painel de Controladoria e Auditoria Financeira
 *
 * Classifica eventos de auditoria e divergências operacionais nas categorias
 * exigidas pela gestão (Raquel, seção 01):
 *   - Descontos e abatimentos concedidos
 *   - Alterações de valor, vencimento ou dados bancários
 *   - Baixas manuais, cancelamentos e estornos
 *   - Operações fora de alçada / bloqueios de segurança
 *   - Divergências entre extrato bancário e ERP
 */
import type { ReconciliationMatch } from "./reconciliation";

export type ControllershipCategory =
  | "desconto_abatimento"
  | "alteracao_valor_vencimento"
  | "baixa_manual_estorno"
  | "fora_de_alcada"
  | "divergencia_conciliacao";

export interface ControllershipAuditInput {
  id: number | string;
  actorEmail: string | null;
  eventType: string;
  entityType: string;
  entityId: string | null;
  occurredAt: string;
  metadata: Record<string, unknown>;
}

export interface ControllershipAlertItem {
  id: string;
  category: ControllershipCategory;
  categoryLabel: string;
  title: string;
  actorLabel: string;
  occurredAt: string | null;
  justification: string | null;
  financialImpact: number | null;
  severity: "high" | "medium" | "info";
}

export interface ControllershipSummary {
  totalAlerts: number;
  countsByCategory: Record<ControllershipCategory, number>;
  totalDiscountsGranted: number;
  items: ControllershipAlertItem[];
}

export const CONTROLLERSHIP_CATEGORY_LABELS: Record<ControllershipCategory, string> = {
  desconto_abatimento: "Descontos & Abatimentos",
  alteracao_valor_vencimento: "Alterações de Valor / Vencimento",
  baixa_manual_estorno: "Baixas Manuais & Estornos",
  fora_de_alcada: "Fora de Alçada / Bloqueios",
  divergencia_conciliacao: "Divergências Banco × ERP"
};

function asFiniteNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function asOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function buildControllershipSummary(params: {
  auditEvents: ControllershipAuditInput[];
  matches: ReconciliationMatch[];
}): ControllershipSummary {
  const countsByCategory: Record<ControllershipCategory, number> = {
    desconto_abatimento: 0,
    alteracao_valor_vencimento: 0,
    baixa_manual_estorno: 0,
    fora_de_alcada: 0,
    divergencia_conciliacao: 0
  };

  const items: ControllershipAlertItem[] = [];
  let totalDiscountsGranted = 0;

  for (const ev of params.auditEvents) {
    const meta = ev.metadata ?? {};
    const actorLabel = ev.actorEmail || "Sistema / Não identificado";
    const justification =
      asOptionalString(meta.justification) ??
      asOptionalString(meta.reason) ??
      asOptionalString(meta.observacao);

    if (ev.eventType === "access.denied") {
      countsByCategory.fora_de_alcada += 1;
      items.push({
        id: `audit-${ev.id}`,
        category: "fora_de_alcada",
        categoryLabel: CONTROLLERSHIP_CATEGORY_LABELS.fora_de_alcada,
        title: `Tentativa bloqueada em ${ev.entityType || "operação restrita"}`,
        actorLabel,
        occurredAt: ev.occurredAt,
        justification: asOptionalString(meta.action) ?? asOptionalString(meta.requiredRole) ?? justification,
        financialImpact: null,
        severity: "high"
      });
      continue;
    }

    if (
      ev.eventType === "reconciliation.decision" ||
      ev.eventType === "reconciliation_decision.created" ||
      ev.eventType === "settlements.created" ||
      ev.eventType === "settlement.updated"
    ) {
      const decisionType = asOptionalString(meta.decisionType) ?? asOptionalString(meta.action);
      const isManualOrReversal =
        decisionType === "manual_match" ||
        decisionType === "unmatch" ||
        decisionType === "reject" ||
        ev.eventType === "settlement.updated" ||
        ev.eventType === "settlements.created";

      if (isManualOrReversal) {
        countsByCategory.baixa_manual_estorno += 1;
        const impact = asFiniteNumber(meta.amountPaid ?? meta.amount ?? meta.totalAmount);
        items.push({
          id: `audit-${ev.id}`,
          category: "baixa_manual_estorno",
          categoryLabel: CONTROLLERSHIP_CATEGORY_LABELS.baixa_manual_estorno,
          title:
            decisionType === "unmatch"
              ? "Desvinculação / estorno de conciliação"
              : ev.eventType === "settlements.created"
              ? "Baixa financeira registrada"
              : "Conciliação manual executada",
          actorLabel,
          occurredAt: ev.occurredAt,
          justification,
          financialImpact: impact,
          severity: decisionType === "unmatch" ? "high" : "medium"
        });
      }
      continue;
    }

    if (
      ev.eventType === "title.status_changed" ||
      ev.eventType === "receivable_title.updated" ||
      ev.eventType === "financial_record.updated"
    ) {
      countsByCategory.alteracao_valor_vencimento += 1;
      const oldVal = asFiniteNumber(meta.previousAmount ?? meta.oldValue);
      const newVal = asFiniteNumber(meta.newAmount ?? meta.newValue);
      const impact = oldVal !== null && newVal !== null ? Math.round((newVal - oldVal) * 100) / 100 : null;
      items.push({
        id: `audit-${ev.id}`,
        category: "alteracao_valor_vencimento",
        categoryLabel: CONTROLLERSHIP_CATEGORY_LABELS.alteracao_valor_vencimento,
        title: `Alteração em ${ev.entityType === "financial_record" ? "lançamento financeiro" : "título"}`,
        actorLabel,
        occurredAt: ev.occurredAt,
        justification,
        financialImpact: impact,
        severity: "medium"
      });
    }
  }

  // Inspeciona divergências e descontos detectados no motor de conciliação
  for (const m of params.matches) {
    if (!m.statementRecord) continue;

    if (m.amountDifference < -0.01) {
      const discount = Math.round(Math.abs(m.amountDifference) * 100) / 100;
      countsByCategory.desconto_abatimento += 1;
      totalDiscountsGranted += discount;
      items.push({
        id: `disc-${m.title.id}`,
        category: "desconto_abatimento",
        categoryLabel: CONTROLLERSHIP_CATEGORY_LABELS.desconto_abatimento,
        title: `Desconto/abatimento no título ${m.title.documentNumber} (${m.title.customerName})`,
        actorLabel: m.statementRecord.matchAuthor || "Pendente de revisão",
        occurredAt: m.statementRecord.matchDate || m.statementRecord.date,
        justification: m.notes.join(" · ") || null,
        financialImpact: -discount,
        severity: "medium"
      });
    } else if (m.suggestedStatus === "divergente") {
      countsByCategory.divergencia_conciliacao += 1;
      items.push({
        id: `div-${m.title.id}`,
        category: "divergencia_conciliacao",
        categoryLabel: CONTROLLERSHIP_CATEGORY_LABELS.divergencia_conciliacao,
        title: `Divergência de valor no título ${m.title.documentNumber} (${m.title.customerName})`,
        actorLabel: "Motor de Conciliação",
        occurredAt: m.statementRecord.date,
        justification: m.notes.join(" · ") || null,
        financialImpact: m.amountDifference,
        severity: "high"
      });
    }
  }

  return {
    totalAlerts: items.length,
    countsByCategory,
    totalDiscountsGranted: Math.round(totalDiscountsGranted * 100) / 100,
    items: items.slice(0, 25)
  };
}
