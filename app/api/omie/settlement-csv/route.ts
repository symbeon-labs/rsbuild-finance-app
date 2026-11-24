/**
 * POST /api/omie/settlement-csv
 *
 * Recebe os matches confirmados pelo usuário na UI de conciliação
 * e devolve o CSV de baixa em lote pronto para importação no Omie.
 *
 * IMPORTANTE: Este endpoint NUNCA envia dados ao Omie diretamente.
 * É uma etapa intermediária segura: gera o arquivo que o operador
 * revisa e importa manualmente pelo portal Omie (ou futura integração).
 *
 * Body: { organizationId, matches: ConfirmedMatch[] }
 * Response: CSV attachment (text/csv; charset=utf-8)
 *
 * Requer: role operator|admin|owner + módulo finance ativo.
 */
import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/api/org-guard";
import { recordAuditEvent } from "@/lib/api/audit";
import { buildSettlementItems, generateOmieBatchSettlementCsv } from "@/lib/reconciliation";
import type { ReconciliationMatch } from "@/lib/reconciliation";

export const dynamic = "force-dynamic";

interface ConfirmedMatch {
  title: ReconciliationMatch["title"];
  statementRecord: ReconciliationMatch["statementRecord"];
  confidence: ReconciliationMatch["confidence"];
  amountDifference: number;
  suggestedStatus: ReconciliationMatch["suggestedStatus"];
  notes: string[];
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId") ?? "";

  let body: { organizationId?: string; matches?: ConfirmedMatch[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const orgId = body.organizationId ?? organizationId;
  const guard = await requireOrgContext(request, orgId, ["owner", "admin", "operator"], "finance");
  if (!guard.ok) return guard.response;
  const { userId, userEmail } = guard.ctx;

  const matches = body.matches;
  if (!Array.isArray(matches) || matches.length === 0) {
    return NextResponse.json(
      { error: "no_matches", detail: "Nenhum match confirmado fornecido para gerar o CSV de baixa." },
      { status: 400 }
    );
  }

  // Validação mínima: apenas matches com registro bancário vinculado
  const validMatches = matches.filter((m) => m.statementRecord && m.suggestedStatus !== "nao_identificado");
  if (validMatches.length === 0) {
    return NextResponse.json(
      { error: "no_valid_matches", detail: "Nenhum dos matches fornecidos possui registro bancário vinculado." },
      { status: 422 }
    );
  }

  const settlements = buildSettlementItems(validMatches as ReconciliationMatch[]);
  const csv = generateOmieBatchSettlementCsv(settlements);

  // Trilha de auditoria: quem gerou o CSV, quantos títulos, quando
  await recordAuditEvent({
    organizationId: orgId,
    actorId: userId,
    actorEmail: userEmail,
    eventType: "omie.settlement_csv_generated",
    entityType: "settlement_batch",
    entityId: `batch-${Date.now()}`,
    metadata: {
      totalMatches: matches.length,
      validMatches: validMatches.length,
      totalAmount: settlements.reduce((s, i) => s + i.amountPaid, 0),
    },
  });

  const filename = `baixa_omie_${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(
    // BOM UTF-8 para compatibilidade com Excel brasileiro
    "\uFEFF" + csv,
    {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    }
  );
}
