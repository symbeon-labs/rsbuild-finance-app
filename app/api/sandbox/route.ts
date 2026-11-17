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

  const { data: sandboxMemberships, error: sandboxMembershipError } = await supabase
    .from("sandbox_organization_memberships")
    .select("organization_id")
    .eq("user_id", userId);

  if (sandboxMembershipError || !sandboxMemberships?.length) {
    return { allowed: false, isSandboxAdmin, organizationIds: [] };
  }

  return {
    allowed: true,
    isSandboxAdmin,
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

    const organizationFilter = access.organizationIds;
    // Public security_invoker views preserve the underlying sandbox RLS policies.
    // Every organization-scoped query is constrained to the caller's memberships.
    const [orgsRes, membersRes, accountsRes, recordsRes, titlesRes, proofsRes, auditRes, casesRes, runsRes] = await Promise.all([
      supabase.from("sandbox_organizations").select("*").in("id", organizationFilter).order("display_name"),
      supabase.from("sandbox_organization_memberships").select("*").in("organization_id", organizationFilter).limit(1000),
      supabase.from("sandbox_financial_accounts").select("*").in("organization_id", organizationFilter).limit(1000),
      supabase.from("sandbox_financial_records").select("*").in("organization_id", organizationFilter).order("transaction_date", { ascending: false }).limit(1000),
      supabase.from("sandbox_receivable_titles").select("*").in("organization_id", organizationFilter).order("due_date").limit(1000),
      supabase.from("sandbox_delivery_proofs").select("*").in("organization_id", organizationFilter).order("delivery_date", { ascending: false }).limit(1000),
      supabase.from("sandbox_audit_events").select("*").in("organization_id", organizationFilter).order("created_at", { ascending: false }).limit(1000),
      supabase.from("sandbox_validation_cases").select("*").eq("enabled", true).order("sprint_number").order("sort_order"),
      access.isSandboxAdmin
        ? supabase.from("sandbox_validation_runs").select("*").order("executed_at", { ascending: false }).limit(100)
        : supabase.from("sandbox_validation_runs").select("*").eq("actor_id", user.id).order("executed_at", { ascending: false }).limit(100)
    ]);

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

/** Executes only deterministic fixtures; never accepts client/customer data. */
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
    if (!/^(A1\\.[4-7]|A2\\.[1-5]|A2\\.W02)-/.test(caseCode)) {
      return NextResponse.json({ error: "invalid_validation_case" }, { status: 400 });
    }

    const { runFinancialValidation } = await import("@/lib/sandbox/financial-validation");
    const outcome = runFinancialValidation(caseCode);
    const { data, error } = await supabase.rpc("sandbox_record_validation_run", {
      p_case_code: caseCode,
      p_status: outcome.status,
      p_summary: outcome.summary,
      p_result: { checks: outcome.checks, engine: "rsbuild-financial-validation-v1" }
    });

    if (error) {
      console.error("Sandbox validation persistence failed:", error);
      return NextResponse.json({ error: "validation_persistence_failed" }, { status: 502 });
    }

    return NextResponse.json({ outcome, run: data }, {
      status: 200,
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (err) {
    console.error("Sandbox validation failed:", err);
    return NextResponse.json({ error: "sandbox_validation_error" }, { status: 500 });
  }
}
