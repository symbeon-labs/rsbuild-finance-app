import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TEAM_ROLES = ["owner", "admin", "operator"];
const STATUSES = ["new", "in_review", "qualified", "disqualified", "converted"];

async function getContext() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };

  const { data: organization } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "rsbuild")
    .maybeSingle();
  if (!organization) return { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organization.id)
    .eq("user_id", user.id)
    .maybeSingle();

  const role = membership?.role ?? "";
  if (!TEAM_ROLES.includes(role)) {
    return { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { supabase, user, role, organizationId: organization.id };
}

/** Authenticated RSBUILD inbox read model. */
export async function GET() {
  const context = await getContext();
  if ("response" in context) return context.response;
  const { supabase, user, role, organizationId } = context;

  const admin = createAdminClient();
  const [requestsResult, readsResult, assignmentsResult, notesResult, membersResult] = await Promise.all([
    supabase.from("diagnostic_requests").select([
      "id", "company_name", "segment", "contact_name", "contact_role",
      "contact_email", "contact_phone", "units_count", "systems_used",
      "erp_used", "areas_involved", "needs", "priority_process",
      "problem_frequency", "problem_impact", "current_process",
      "expected_result", "intention", "status", "created_at"
    ].join(",")).order("created_at", { ascending: false }).limit(100),
    supabase.from("diagnostic_request_reads").select("request_id, read_at").eq("user_id", user.id),
    supabase.from("diagnostic_request_assignments").select("request_id, assigned_to, assigned_by, updated_at"),
    supabase.from("diagnostic_request_notes").select("id, request_id, author_id, body, created_at").order("created_at", { ascending: true }).limit(500),
    admin.from("organization_memberships").select("user_id, role, custom_title").eq("organization_id", organizationId)
  ]);

  const failed = [requestsResult, readsResult, assignmentsResult, notesResult, membersResult].find((result) => result.error);
  if (failed?.error) {
    console.error(JSON.stringify({ event: "diagnostic_inbox_read_failed", code: failed.error.code }));
    return NextResponse.json({ error: "inbox_unavailable" }, { status: 502 });
  }

  // Resolve member labels server-side; the service key never leaves this route.
  const members = await Promise.all((membersResult.data ?? [])
    .filter((member) => TEAM_ROLES.includes(member.role))
    .map(async (member) => {
      const { data } = await admin.auth.admin.getUserById(member.user_id);
      return {
        id: member.user_id,
        label: data.user?.user_metadata?.full_name
          || data.user?.user_metadata?.name
          || data.user?.email
          || member.user_id,
        role: member.role,
        title: member.custom_title ?? ""
      };
    }));

  return NextResponse.json({
    requests: requestsResult.data ?? [],
    reads: readsResult.data ?? [],
    assignments: assignmentsResult.data ?? [],
    notes: notesResult.data ?? [],
    members,
    currentUserId: user.id,
    permissions: { canChangeStatus: role === "owner" || role === "admin" }
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

/** Mark read, assign a teammate, or append an internal note. */
export async function POST(request: Request) {
  const context = await getContext();
  if ("response" in context) return context.response;
  const { supabase, user } = context;

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const requestId = typeof body.requestId === "string" ? body.requestId : "";
  if (!requestId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  if (body.action === "read") {
    const { error } = await supabase.from("diagnostic_request_reads").upsert({
      request_id: requestId, user_id: user.id, read_at: new Date().toISOString()
    }, { onConflict: "request_id,user_id" });
    if (error) return NextResponse.json({ error: "read_receipt_failed" }, { status: 502 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "assign") {
    const assignedTo = typeof body.assignedTo === "string" ? body.assignedTo : "";
    if (!assignedTo) return NextResponse.json({ error: "invalid_assignee" }, { status: 400 });
    const { error } = await supabase.from("diagnostic_request_assignments").upsert({
      request_id: requestId, assigned_to: assignedTo, assigned_by: user.id,
      updated_at: new Date().toISOString()
    }, { onConflict: "request_id" });
    if (error) return NextResponse.json({ error: "assignment_failed" }, { status: 403 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "note") {
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (!note || note.length > 4000) return NextResponse.json({ error: "invalid_note" }, { status: 400 });
    const { error } = await supabase.from("diagnostic_request_notes").insert({
      request_id: requestId, author_id: user.id, body: note
    });
    if (error) return NextResponse.json({ error: "note_create_failed" }, { status: 403 });
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  return NextResponse.json({ error: "unsupported_action" }, { status: 400 });
}

/** Status transitions remain limited to RSBUILD owners and admins by the existing RLS policy. */
export async function PATCH(request: Request) {
  const context = await getContext();
  if ("response" in context) return context.response;
  const { supabase, role } = context;
  if (role !== "owner" && role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const requestId = typeof body.requestId === "string" ? body.requestId : "";
  const status = typeof body.status === "string" ? body.status : "";
  if (!requestId || !STATUSES.includes(status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  const { error } = await supabase.from("diagnostic_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) return NextResponse.json({ error: "status_update_failed" }, { status: 403 });
  return NextResponse.json({ ok: true });
}
