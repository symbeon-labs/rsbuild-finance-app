import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const BUCKET = "rsbuild-data-intake";
const BATCH_SIZE = 100;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  // Keep a 15-minute completion grace after signed intent expiry.
  const cleanupBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: intents, error: listError } = await admin
    .from("organization_document_upload_intents")
    .select("organization_id, storage_path")
    .is("completed_at", null)
    .lt("expires_at", cleanupBefore)
    .order("expires_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (listError) {
    console.error(JSON.stringify({ event: "data_intake_cleanup_list_failed", code: listError.code }));
    return NextResponse.json({ error: "cleanup_unavailable" }, { status: 502 });
  }

  let removed = 0;
  let retained = 0;
  let failed = 0;

  for (const intent of intents ?? []) {
    const { data: registered, error: documentCheckError } = await admin
      .from("organization_documents")
      .select("id")
      .eq("organization_id", intent.organization_id)
      .eq("storage_path", intent.storage_path)
      .maybeSingle();

    if (documentCheckError) {
      failed++;
      console.error(JSON.stringify({ event: "data_intake_cleanup_document_check_failed", organizationId: intent.organization_id }));
      continue;
    }

    if (registered) {
      const { error } = await admin.from("organization_document_upload_intents")
        .update({ completed_at: now })
        .eq("organization_id", intent.organization_id)
        .eq("storage_path", intent.storage_path);
      if (error) failed++;
      else retained++;
      continue;
    }

    const { error: removeError } = await admin.storage.from(BUCKET).remove([intent.storage_path]);
    if (removeError) {
      failed++;
      console.error(JSON.stringify({ event: "data_intake_cleanup_storage_failed", organizationId: intent.organization_id, code: removeError.name }));
      continue;
    }

    const { error: deleteIntentError } = await admin.from("organization_document_upload_intents")
      .delete()
      .eq("organization_id", intent.organization_id)
      .eq("storage_path", intent.storage_path)
      .is("completed_at", null);
    if (deleteIntentError) {
      failed++;
      console.error(JSON.stringify({ event: "data_intake_cleanup_intent_delete_failed", organizationId: intent.organization_id, code: deleteIntentError.code }));
      continue;
    }
    removed++;
  }

  return NextResponse.json({ scanned: intents?.length ?? 0, removed, retained, failed }, {
    status: failed > 0 ? 207 : 200,
    headers: { "Cache-Control": "no-store" }
  });
}
