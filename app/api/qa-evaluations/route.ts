import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/api/org-guard";
import { resolveOrganizationEnvironment } from "@/lib/platform-authorization";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const QA_WORKSPACES = new Set(["mundo_sabor_qa", "hub_acai_qa"]);
const FEATURES = new Set(["visao-geral", "movimentacoes", "importacoes", "conciliacao", "baixas", "relatorios"]);
const ASSESSMENTS = new Set([
  "Atendeu ao esperado", "Atendeu parcialmente", "Não atendeu",
  "Não foi possível verificar", "Não se aplica"
]);
const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

async function getAuthorizedSession(request: Request, organizationId: string, write = false) {
  if (!UUID.test(organizationId)) return { error: "invalid_organization" as const };

  const access = await requireOrgContext(
    request,
    organizationId,
    write ? ["owner", "admin", "operator"] : ["owner", "admin", "operator", "viewer"],
    "finance"
  );
  if (!access.ok) return { response: access.response };

  const { data: organization, error } = await access.ctx.supabase
    .from("organizations")
    .select("id,slug,status")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) return { error: "organization_unavailable" as const };
  if (!organization || organization.status !== "active"
      || !QA_WORKSPACES.has(organization.slug)
      || resolveOrganizationEnvironment(organization.slug) !== "qa") {
    return { error: "forbidden" as const };
  }

  return {
    supabase: access.ctx.supabase,
    userId: access.ctx.userId,
    organization,
    error: null as null
  };
}

function accessError(error: string) {
  const status = error === "invalid_organization" ? 400
    : error === "unauthenticated" ? 401
    : error === "capability_entitlement_unavailable" || error === "organization_unavailable" ? 503
    : 403;
  return NextResponse.json({ error }, { status });
}

export async function GET(request: Request) {
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
  const access = await getAuthorizedSession(request, organizationId);
  if ("response" in access && access.response) return access.response;
  if (access.error) return accessError(access.error);

  const { data, error } = await access.supabase.from("qa_evaluations")
    .select("id,organization_id,workspace_slug,environment,module_key,feature_key,assessment,scenario_summary,observation,operational_impact,evidence_refs,rubric_version,created_by,created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false }).limit(200);

  if (error) return NextResponse.json({ error: "evaluation_read_failed" }, { status: 502 });
  return NextResponse.json({ evaluations: data ?? [] }, {
    headers: { "Cache-Control": "private, no-store" }
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const organizationId = clean(body.organizationId, 36);
  const featureKey = clean(body.featureKey, 40);
  const assessment = clean(body.assessment, 60);
  const scenarioSummary = clean(body.scenarioSummary, 1000);
  const observation = clean(body.observation, 4000);
  const operationalImpact = clean(body.operationalImpact, 2000);
  const evidenceRefs = Array.isArray(body.evidenceRefs)
    ? body.evidenceRefs.filter((value): value is string => typeof value === "string" && /^[a-zA-Z0-9:_-]{1,120}$/.test(value)).slice(0, 20)
    : [];

  if (!UUID.test(organizationId) || !FEATURES.has(featureKey) || !ASSESSMENTS.has(assessment)
      || (!scenarioSummary && !observation && !operationalImpact)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const access = await getAuthorizedSession(request, organizationId, true);
  if ("response" in access && access.response) return access.response;
  if (access.error) return accessError(access.error);

  const { data, error } = await access.supabase.from("qa_evaluations").insert({
    organization_id: organizationId,
    workspace_slug: access.organization.slug,
    environment: "qa",
    module_key: "finance",
    feature_key: featureKey,
    assessment,
    scenario_summary: scenarioSummary,
    observation,
    operational_impact: operationalImpact,
    evidence_refs: evidenceRefs,
    rubric_version: "finance-guide-v0.2",
    created_by: access.userId
  }).select("id,organization_id,workspace_slug,feature_key,assessment,created_at").single();

  if (error) return NextResponse.json({ error: "evaluation_save_failed" }, { status: 502 });
  return NextResponse.json({ evaluation: data }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
