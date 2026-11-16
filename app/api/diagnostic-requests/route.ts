import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

const MAX_LEN = 4000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_NEEDS = new Set([
  "Finanças & Caixa",
  "Reconciliação & Baixas",
  "Logística & Expedição",
  "Auditoria & Governança",
  "Outro"
]);
const VALID_INTENTIONS = new Set([
  "Conhecer a plataforma",
  "Avaliar uma integração",
  "Estruturar um projeto-piloto",
  "Resolver um problema operacional específico",
  "Avaliar aplicação em múltiplas empresas"
]);

function clean(value: unknown, max = MAX_LEN): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * POST /api/diagnostic-requests — formulário público da página institucional.
 * Sem autenticação por design (topo de funil); proteção por rate limit
 * por IP, validação estrita de payload e gravação somente via service role.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
  if (!consumeRateLimit(`diag:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const companyName = clean(body.companyName, 200);
  const contactName = clean(body.contactName, 200);
  const contactEmail = clean(body.contactEmail, 254).toLowerCase();
  const intention = clean(body.intention, 100);

  if (!companyName || !contactName || !EMAIL.test(contactEmail) || !VALID_INTENTIONS.has(intention)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const needs = Array.isArray(body.needs)
    ? body.needs.map((n) => clean(n, 60)).filter((n) => VALID_NEEDS.has(n)).slice(0, 6)
    : [];

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("diagnostic_requests").insert({
      company_name: companyName,
      segment: clean(body.segment, 120),
      contact_name: contactName,
      contact_role: clean(body.contactRole, 120),
      contact_email: contactEmail,
      contact_phone: clean(body.contactPhone, 40),
      units_count: clean(body.unitsCount, 60),
      systems_used: clean(body.systemsUsed, 500),
      erp_used: clean(body.erpUsed, 200),
      areas_involved: clean(body.areasInvolved, 500),
      needs,
      priority_process: clean(body.priorityProcess),
      problem_frequency: clean(body.problemFrequency, 200),
      problem_impact: clean(body.problemImpact, 500),
      current_process: clean(body.currentProcess),
      expected_result: clean(body.expectedResult),
      intention
    });
    if (error) {
      console.error(JSON.stringify({ event: "diagnostic_request_insert_failed", code: error.code }));
      return NextResponse.json({ error: "diagnostic_unavailable" }, { status: 502 });
    }
  } catch (err) {
    console.error(JSON.stringify({
      event: "diagnostic_request_exception",
      error: err instanceof Error ? err.message : "unknown"
    }));
    return NextResponse.json({ error: "diagnostic_unavailable" }, { status: 502 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
