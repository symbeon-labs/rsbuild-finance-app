import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type SandboxAccess = {
  allowed: boolean;
  isSandboxAdmin: boolean;
  organizationIds: string[];
};

/**
 * Sandbox access is granted to RSBUILD owners/admins, or to RSBUILD operators
 * who also hold an explicit membership in at least one sandbox organization.
 * The latter are restricted to their own sandbox organizations.
 */
async function getSandboxAccess(
  supabase: SupabaseServerClient,
  userId: string
): Promise<SandboxAccess> {
  const { data: rsbuildMembership, error: rsbuildError } = await supabase
    .from("organization_memberships")
    .select("role, organizations!inner(slug)")
    .eq("user_id", userId)
    .eq("organizations.slug", "rsbuild")
    .maybeSingle();

  if (rsbuildError || !rsbuildMembership) {
    return { allowed: false, isSandboxAdmin: false, organizationIds: [] };
  }

  const isSandboxAdmin = ["owner", "admin"].includes(rsbuildMembership.role);
  const isOperator = rsbuildMembership.role === "operator";
  if (!isSandboxAdmin && !isOperator) {
    return { allowed: false, isSandboxAdmin: false, organizationIds: [] };
  }

  if (isSandboxAdmin) {
    const { data: organizations, error: organizationsError } = await supabase
      .from("sandbox_organizations")
      .select("id");
    if (organizationsError) {
      return { allowed: false, isSandboxAdmin: true, organizationIds: [] };
    }
    return {
      allowed: true,
      isSandboxAdmin: true,
      organizationIds: (organizations ?? []).map((organization) => organization.id)
    };
  }

  const { data: sandboxMemberships, error: sandboxMembershipError } = await supabase
    .from("sandbox_organization_memberships")
    .select("organization_id")
    .eq("user_id", userId);

  if (sandboxMembershipError || !sandboxMemberships?.length) {
    return { allowed: false, isSandboxAdmin: false, organizationIds: [] };
  }

  return {
    allowed: true,
    isSandboxAdmin: false,
    organizationIds: sandboxMemberships.map((membership) => membership.organization_id)
  };
}

/** Reads only synthetic data belonging to sandboxes the user is authorized to access. */
export async function GET(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    if (!consumeRateLimit(`${user.id}:/api/sandbox`)) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const access = await getSandboxAccess(supabase, user.id);
    if (!access.allowed) {
      return NextResponse.json({ error: "sandbox_forbidden" }, { status: 403 });
    }

    // Esta primeira fase homologa exclusivamente Mundo do Sabor.
    const { data: mundoOrg, error: mundoOrgError } = await supabase
      .from("sandbox_organizations")
      .select("id,slug")
      .eq("slug", "mundo-sabor-sandbox")
      .maybeSingle();
    if (mundoOrgError || !mundoOrg || !access.organizationIds.includes(mundoOrg.id)) {
      return NextResponse.json({ error: "mundo_sabor_sandbox_forbidden" }, { status: 403 });
    }

    const [orgsRes, membersRes, accountsRes, recordsRes, titlesRes, proofsRes, auditRes, casesRes] = await Promise.all([
      supabase.from("sandbox_organizations").select("*").eq("id", mundoOrg.id),
      supabase.from("sandbox_organization_memberships").select("*").eq("organization_id", mundoOrg.id).limit(1000),
      supabase.from("sandbox_financial_accounts").select("*").eq("organization_id", mundoOrg.id).limit(1000),
      supabase.from("sandbox_financial_records").select("*").eq("organization_id", mundoOrg.id).order("transaction_date", { ascending: false }).limit(1000),
      supabase.from("sandbox_receivable_titles").select("*").eq("organization_id", mundoOrg.id).order("due_date").limit(1000),
      supabase.from("sandbox_delivery_proofs").select("*").eq("organization_id", mundoOrg.id).order("delivery_date", { ascending: false }).limit(1000),
      supabase.from("sandbox_audit_events").select("*").eq("organization_id", mundoOrg.id).order("created_at", { ascending: false }).limit(1000),
      supabase.from("sandbox_validation_cases").select("*").eq("project_key", "mundo-do-sabor").eq("enabled", true).order("sprint_number").order("sort_order")
    ]);
    const caseCodes = (casesRes.data ?? []).map((item) => item.case_code);
    const runsRes = caseCodes.length
      ? access.isSandboxAdmin
        ? await supabase.from("sandbox_validation_runs").select("*").in("case_code", caseCodes).order("executed_at", { ascending: false }).limit(200)
        : await supabase.from("sandbox_validation_runs").select("*").in("case_code", caseCodes).eq("actor_id", user.id).order("executed_at", { ascending: false }).limit(200)
      : { data: [], error: null };

    const firstError = [orgsRes, membersRes, accountsRes, recordsRes, titlesRes, proofsRes, auditRes, casesRes, runsRes]
      .find((result) => result.error);

    if (firstError?.error) {
      console.error("Sandbox query failed:", firstError.error);
      return NextResponse.json({ error: "sandbox_query_failed" }, { status: 502 });
    }

    return NextResponse.json({
      organizations: orgsRes.data ?? [],
      memberships: membersRes.data ?? [],
      financialAccounts: accountsRes.data ?? [],
      financialRecords: recordsRes.data ?? [],
      receivableTitles: titlesRes.data ?? [],
      deliveryProofs: proofsRes.data ?? [],
      auditEvents: auditRes.data ?? [],
      validationCases: casesRes.data ?? [],
      validationRuns: runsRes.data ?? [],
      isSandbox: true
    }, {
      status: 200,
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (err) {
    console.error("Critical error in /api/sandbox:", err);
    return NextResponse.json({ error: "sandbox_error" }, { status: 500 });
  }
}

/** Records a manual homologation decision and its evidence; never accepts client/customer data. */
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    if (!consumeRateLimit(`${user.id}:/api/sandbox:post`)) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const access = await getSandboxAccess(supabase, user.id);
    if (!access.allowed) {
      return NextResponse.json({ error: "sandbox_forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const caseCode = typeof body.caseCode === "string" ? body.caseCode : "";
    const status = body.status;
    const summary = typeof body.summary === "string" ? body.summary.trim() : "";
    const observed = typeof body.observed === "string" ? body.observed.trim() : "";
    const evidenceRef = typeof body.evidenceRef === "string" ? body.evidenceRef.trim() : "";

    if (body.mode !== "manual") {
      return NextResponse.json({ error: "manual_homologation_only" }, { status: 400 });
    }
    if (!/^(A1\\.[4-7]|A2\\.[1-5]|A2\\.W02)-/.test(caseCode)) {
      return NextResponse.json({ error: "invalid_validation_case" }, { status: 400 });
    }
    if (!["passed", "failed", "blocked"].includes(status) || summary.length < 5 || summary.length > 1000 || observed.length > 2000 || evidenceRef.length > 500) {
      return NextResponse.json({ error: "invalid_manual_validation_payload" }, { status: 400 });
    }

    const { data: mundoOrg, error: mundoOrgError } = await supabase
      .from("sandbox_organizations")
      .select("id")
      .eq("slug", "mundo-sabor-sandbox")
      .maybeSingle();
    if (mundoOrgError || !mundoOrg || !access.organizationIds.includes(mundoOrg.id)) {
      return NextResponse.json({ error: "mundo_sabor_sandbox_forbidden" }, { status: 403 });
    }

    const { data: validationCase, error: caseError } = await supabase
      .from("sandbox_validation_cases")
      .select("case_code")
      .eq("case_code", caseCode)
      .eq("project_key", "mundo-do-sabor")
      .eq("enabled", true)
      .maybeSingle();
    if (caseError || !validationCase) {
      return NextResponse.json({ error: "validation_case_not_found" }, { status: 404 });
    }

    const { data, error } = await supabase.rpc("sandbox_record_validation_run", {
      p_case_code: caseCode,
      p_status: status,
      p_summary: summary,
      p_result: {
        mode: "manual",
        target_environment: "mundo-sabor-sandbox",
        observed,
        evidenceRef,
        homologation_version: "mundo-sabor-manual-v1"
      }
    });

    if (error) {
      console.error("Manual homologation persistence failed:", error);
      return NextResponse.json({ error: "validation_persistence_failed" }, { status: 502 });
    }

    return NextResponse.json({ success: true, status, caseCode, run: data }, {
      status: 200,
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (err) {
    console.error("Sandbox validation failed:", err);
    return NextResponse.json({ error: "sandbox_validation_error" }, { status: 500 });
  }
}
