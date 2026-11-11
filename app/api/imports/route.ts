import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCsv, parseOfx } from "@/lib/finance";
import { majorToMinor } from "@/lib/finance-persistence";
import { MAX_IMPORT_FILE_BYTES, validateImportFile } from "@/lib/import-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const BUCKET = "rsbuild-source-artifacts";
const MAX_RECORDS = 5000;

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  const userClient = await createClient();
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization" }, { status: 400 });
  }
  const { data: membership, error: membershipError } = await userClient
    .from("organization_memberships").select("role")
    .eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
  if (membershipError || !membership) return NextResponse.json({ error: "organization_access_denied" }, { status: 403 });
  const { data, error } = await userClient.from("financial_records")
    .select("id, organization_id, import_batch_id, source_record_id, transaction_date, description, amount_minor, direction, category, status, created_by, created_at")
    .eq("organization_id", organizationId)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false }).limit(MAX_RECORDS);
  if (error) {
    console.error(JSON.stringify({ event: "rsbuild_financial_records_read_failed", organizationId, code: error.code }));
    return NextResponse.json({ error: "financial_records_unavailable" }, { status: 502 });
  }
  const records = (data ?? []).map((row) => {
    const amountMinor = Number(row.amount_minor);
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) throw new Error("Invalid persisted financial amount.");
    return {
      id: row.id, date: row.transaction_date, description: row.description,
      amount: amountMinor / 100, direction: row.direction,
      category: row.category || "Não classificado", source: "Importação financeira",
      status: row.status, sourceRecordId: row.source_record_id ?? undefined,
      importBatchId: row.import_batch_id ?? undefined,
      createdAt: row.created_at ?? undefined, createdBy: row.created_by ?? undefined
    };
  });
  return NextResponse.json({ records, count: records.length, truncated: records.length === MAX_RECORDS }, {
    status: 200, headers: { "Cache-Control": "private, no-store" }
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  }

  const userClient = await createClient();
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let form: FormData;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ error: "invalid_multipart" }, { status: 400 }); }

  const organizationId = String(form.get("organizationId") ?? "");
  const file = form.get("file");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizationId) || !(file instanceof File)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const fileError = validateImportFile(file);
  if (fileError) return NextResponse.json({ error: fileError }, { status: file.size > MAX_IMPORT_FILE_BYTES ? 413 : 415 });

  // Tenant authorization is evaluated with the user's session, never with the service key.
  const { data: membership, error: membershipError } = await userClient
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError || !membership || !["owner", "admin", "operator"].includes(membership.role)) {
    return NextResponse.json({ error: "organization_access_denied" }, { status: 403 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(bytes).digest("hex");
  let sourceText: string;
  try { sourceText = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return NextResponse.json({ error: "source_encoding_invalid" }, { status: 422 }); }

  const parsed = file.name.toLowerCase().endsWith(".ofx") ? parseOfx(sourceText) : parseCsv(sourceText);
  if (parsed.errors.length || !parsed.records.length || parsed.records.length > MAX_RECORDS) {
    return NextResponse.json({
      error: "source_parse_failed",
      rejectedCount: parsed.errors.length,
      details: parsed.errors.slice(0, 20)
    }, { status: 422 });
  }

  const normalized = [];
  for (const [index, row] of parsed.records.entries()) {
    let amountMinor: number;
    try { amountMinor = majorToMinor(row.amount); }
    catch { return NextResponse.json({ error: "server_parser_invalid_record" }, { status: 422 }); }
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !row.description.trim()) {
      return NextResponse.json({ error: "server_parser_invalid_record" }, { status: 422 });
    }
    const identity = row.sourceRecordId
      ? `ofx:${row.sourceRecordId}`
      : `csv:${fileHash}:${index}:${row.date}|${row.description.trim().toLocaleLowerCase("pt-BR")}|${amountMinor}|${row.direction}`;
    const deduplicationKey = createHash("sha256").update(identity).digest("hex");
    normalized.push({
      transaction_date: row.date,
      description: row.description.trim().slice(0, 500),
      amount_minor: String(amountMinor),
      direction: row.direction,
      category: (row.category || "Não classificado").slice(0, 120),
      currency: "BRL",
      deduplication_key: deduplicationKey,
      raw_payload: { source_record_id: row.sourceRecordId ?? null, source_row_index: index, parser_version: "main-finance-parser/1" }
    });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "statement.csv";
  const storagePath = `${organizationId}/imports/${randomUUID()}-${safeName}`;
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, new Blob([bytes], { type: file.type || "application/octet-stream" }), {
    contentType: file.type || "application/octet-stream",
    upsert: false
  });
  if (uploadError) return NextResponse.json({ error: "artifact_upload_failed" }, { status: 502 });

  const { data, error } = await admin.rpc("commit_financial_import_trusted", {
    p_actor_id: user.id,
    p_organization_id: organizationId,
    p_original_filename: safeName,
    p_file_sha256: fileHash,
    p_file_size_bytes: file.size,
    p_storage_path: storagePath,
    p_records: normalized
  });

  if (error) {
    const { error: cleanupError } = await admin.storage.from(BUCKET).remove([storagePath]);
    if (cleanupError) console.error(JSON.stringify({
      event: "rsbuild_import_artifact_cleanup_failed",
      organizationId,
      storagePath,
      fileHash,
      errorCode: cleanupError.name || "storage_cleanup_error"
    }));
    return NextResponse.json({ error: "import_commit_failed", cleanupPending: Boolean(cleanupError) }, { status: 422 });
  }

  return NextResponse.json({
    result: data?.[0] ?? null,
    parserVersion: "main-finance-parser/1",
    parsedCount: normalized.length
  }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
