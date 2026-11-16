import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Observabilidade cross-tenant para o workspace RSBUILD.
 *
 * Retorna APENAS métricas agregadas por organização (contagens e somas).
 * Não expõe registros operacionais brutos — o isolamento dos tenants
 * continua intacto: quem consulta precisa ser membro RSBUILD
 * (owner/admin/operator) e a leitura usa service role server-side.
 */
export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!consumeRateLimit(`${user.id}:/api/observability/summary`)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // Gate: somente equipe RSBUILD operacional (sem viewer)
  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("role, organizations!inner(slug)")
    .eq("user_id", user.id)
    .eq("organizations.slug", "rsbuild")
    .maybeSingle();
  if (membershipError || !membership || !["owner", "admin", "operator"].includes(membership.role)) {
    return NextResponse.json({ error: "observability_forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: orgs, error: orgsError } = await admin
    .from("organizations")
    .select("id, slug, display_name")
    .neq("slug", "rsbuild");
  if (orgsError) {
    console.error(JSON.stringify({ event: "observability_orgs_failed", code: orgsError.code }));
    return NextResponse.json({ error: "observability_unavailable" }, { status: 502 });
  }

  const orgIds = (orgs ?? []).map((o: any) => o.id);
  if (!orgIds.length) {
    return NextResponse.json({ organizations: [] }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    titles, proofs, orders, settlements, records, movements,
    snapshots, memberships, invitations, auditEvents
  ] = await Promise.all([
    admin.from("receivable_titles").select("organization_id, status").in("organization_id", orgIds).limit(20000),
    admin.from("delivery_proofs").select("organization_id, status").in("organization_id", orgIds).limit(20000),
    admin.from("whatsapp_orders").select("organization_id").in("organization_id", orgIds).limit(20000),
    admin.from("settlements").select("organization_id, amount_minor, settlement_date").in("organization_id", orgIds).limit(20000),
    admin.from("financial_records").select("organization_id, status").in("organization_id", orgIds).limit(20000),
    admin.from("erp_movements").select("organization_id").in("organization_id", orgIds).limit(50000),
    admin.from("erp_snapshots").select("organization_id, record_count, created_at").in("organization_id", orgIds).order("created_at", { ascending: false }).limit(20000),
    admin.from("organization_memberships").select("organization_id").in("organization_id", orgIds).limit(20000),
    admin.from("organization_invitations").select("organization_id, status").in("organization_id", orgIds).limit(5000),
    admin.from("audit_events").select("organization_id, event_type, occurred_at").in("organization_id", orgIds).gte("occurred_at", since7d).order("occurred_at", { ascending: false }).limit(5000)
  ]);

  const firstError = [titles, proofs, orders, settlements, records, movements, snapshots, memberships, invitations, auditEvents]
    .find((r) => r.error);
  if (firstError?.error) {
    console.error(JSON.stringify({ event: "observability_query_failed", code: firstError.error.code }));
    return NextResponse.json({ error: "observability_unavailable" }, { status: 502 });
  }

  const group = <T extends Record<string, any>>(rows: T[] | null | undefined, key = "organization_id") => {
    const map = new Map<string, T[]>();
    for (const row of rows ?? []) {
      const k = String(row[key]);
      const arr = map.get(k) ?? [];
      arr.push(row);
      map.set(k, arr);
    }
    return map;
  };

  const titlesByOrg = group(titles.data as any[]);
  const proofsByOrg = group(proofs.data as any[]);
  const ordersByOrg = group(orders.data as any[]);
  const settlementsByOrg = group(settlements.data as any[]);
  const recordsByOrg = group(records.data as any[]);
  const movementsByOrg = group(movements.data as any[]);
  const snapshotsByOrg = group(snapshots.data as any[]);
  const membersByOrg = group(memberships.data as any[]);
  const invitesByOrg = group(invitations.data as any[]);
  const auditByOrg = group(auditEvents.data as any[]);

  const organizations = (orgs ?? []).map((org: any) => {
    const orgTitles = titlesByOrg.get(org.id) ?? [];
    const orgProofs = proofsByOrg.get(org.id) ?? [];
    const orgSettlements = settlementsByOrg.get(org.id) ?? [];
    const orgRecords = recordsByOrg.get(org.id) ?? [];
    const orgAudit = auditByOrg.get(org.id) ?? [];
    const orgSnapshots = snapshotsByOrg.get(org.id) ?? [];
    const latestSnapshot = orgSnapshots[0] ?? null;

    const settled30d = orgSettlements
      .filter((s: any) => s.settlement_date >= since30d.slice(0, 10))
      .reduce((sum: number, s: any) => sum + Number(s.amount_minor ?? 0), 0);

    return {
      id: org.id,
      slug: org.slug,
      displayName: org.display_name,
      titlesPending: orgTitles.filter((t: any) => t.status === "pendente").length,
      titlesTotal: orgTitles.length,
      proofsPending: orgProofs.filter((p: any) => p.status === "pendente_entrega").length,
      proofsTotal: orgProofs.length,
      ordersCount: (ordersByOrg.get(org.id) ?? []).length,
      settlementsCount: orgSettlements.length,
      settlementsAmount30d: Math.round(settled30d) / 100,
      recordsPending: orgRecords.filter((r: any) => r.status === "pendente").length,
      recordsConciliado: orgRecords.filter((r: any) => r.status === "conciliado").length,
      erpMovementsCount: (movementsByOrg.get(org.id) ?? []).length,
      erpSnapshotRecordCount: latestSnapshot?.record_count ?? 0,
      erpSnapshotAt: latestSnapshot?.created_at ?? null,
      membersCount: (membersByOrg.get(org.id) ?? []).length,
      pendingInvitations: (invitesByOrg.get(org.id) ?? []).filter((i: any) => i.status !== "failed").length,
      auditEvents7d: orgAudit.length,
      accessDenied7d: orgAudit.filter((e: any) => e.event_type === "access.denied").length,
      lastActivityAt: orgAudit[0]?.occurred_at ?? null
    };
  });

  return NextResponse.json({ organizations }, {
    status: 200, headers: { "Cache-Control": "private, no-store" }
  });
}
