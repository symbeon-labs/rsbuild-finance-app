import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrgContext } from "@/lib/api/org-guard";
import { decodeImportText } from "@/lib/finance";
import { previewPayablesCsv } from "@/lib/finance/payables-import";
import { previewPayablesXlsx } from "@/lib/finance/payables-xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "rsbuild-source-artifacts";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 5000;
const PARSER_VERSION = "payables-csv-xlsx/2";

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

  const extension = file.name.toLowerCase().split(".").pop();
  if (extension !== "csv" && extension !== "xlsx") {
    return NextResponse.json({ error: "unsupported_file_type" }, { status: 415 });
  }
  if (file.size < 1) return NextResponse.json({ error: "empty_file" }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "file_too_large" }, { status: 413 });

  const capabilityGuard = await requireOrgContext(request, organizationId, ["owner", "admin", "operator"], "finance");
  if (!capabilityGuard.ok) return capabilityGuard.response;

  const bytes = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(bytes).digest("hex");
  const requestedSheetName = String(form.get("sheetName") ?? "") || undefined;
  let preview;
  let sheetName: string | null = null;

  try {
    if (extension === "xlsx") {
      const workbookPreview = previewPayablesXlsx(bytes, requestedSheetName);
      preview = workbookPreview;
      sheetName = workbookPreview.sheetName;
    } else {
      if (requestedSheetName) return NextResponse.json({ error: "sheet_not_applicable" }, { status: 400 });
      preview = previewPayablesCsv(decodeImportText(bytes));
    }
  } catch (error) {
    return NextResponse.json({
      error: extension === "csv" ? "source_encoding_or_parse_invalid" : "workbook_parse_failed",
      message: error instanceof Error ? error.message : "Não foi possível ler o arquivo."
    }, { status: 422 });
  }

  if (preview.parsedCount > MAX_ROWS) {
    return NextResponse.json({ error: "too_many_rows", maxRows: MAX_ROWS, parsedCount: preview.parsedCount }, { status: 413 });
  }
  if (preview.rows.length === 0 || preview.errors.some((issue) => issue.code === "invalid_columns")) {
    return NextResponse.json({
      error: "no_valid_payable_rows",
      parsedCount: preview.parsedCount,
      rejectedCount: preview.errors.filter((issue) => issue.code !== "duplicate_in_file").length,
      duplicateCount: preview.duplicateCount,
      details: preview.errors.slice(0, 100)
    }, { status: 422 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || `payables.${extension}`;
  const mediaType = extension === "xlsx"
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "text/csv";
  const storagePath = `${organizationId}/payables/imports/${randomUUID()}-${safeName}`;
  const admin = createAdminClient();

  const { error: uploadError } = await admin.storage.from(BUCKET).upload(
    storagePath,
    new Blob([bytes], { type: mediaType }),
    { contentType: mediaType, upsert: false }
  );
  if (uploadError) {
    console.error(JSON.stringify({ event: "rsbuild_payables_artifact_upload_failed", organizationId, code: uploadError.name || "storage_error" }));
    return NextResponse.json({ error: "artifact_upload_failed" }, { status: 502 });
  }

  const records = preview.rows.map((row) => ({
    supplier_name: row.supplierName,
    supplier_document: row.supplierDocument ?? null,
    document_number: row.documentNumber,
    issue_date: row.issueDate ?? null,
    due_date: row.dueDate,
    amount_minor: String(row.amountMinor),
    category: row.category ?? null,
    cost_center: row.costCenter ?? null,
    bank_account: row.bankAccount ?? null,
    payment_method: row.paymentMethod ?? null,
    recurrence_reference: row.recurrenceReference ?? null,
    source_sheet_name: sheetName,
    source_row_number: row.rowNumber,
    deduplication_key: row.deduplicationKey
  }));

  const { data, error: commitError } = await admin.rpc("commit_payable_import_trusted", {
    p_actor_id: user.id,
    p_organization_id: organizationId,
    p_original_filename: safeName,
    p_file_sha256: fileHash,
    p_file_size_bytes: file.size,
    p_storage_path: storagePath,
    p_media_type: mediaType,
    p_sheet_name: sheetName,
    p_parser_version: PARSER_VERSION,
    p_parsed_count: preview.parsedCount,
    p_rejected_count: preview.errors.filter((issue) => issue.code !== "duplicate_in_file").length,
    p_in_file_duplicate_count: preview.duplicateCount,
    p_records: records
  });

  if (commitError) {
    const { error: cleanupError } = await admin.storage.from(BUCKET).remove([storagePath]);
    if (cleanupError) console.error(JSON.stringify({
      event: "rsbuild_payables_artifact_cleanup_failed",
      organizationId,
      storagePath,
      fileHash,
      code: cleanupError.name || "storage_cleanup_error"
    }));
    console.error(JSON.stringify({ event: "rsbuild_payables_commit_failed", organizationId, code: commitError.code || "rpc_error" }));
    return NextResponse.json({ error: "payables_import_commit_failed", cleanupPending: Boolean(cleanupError) }, { status: 422 });
  }

  const result = Array.isArray(data) ? data[0] : data;
  const insertedCount = Number(result?.inserted_count ?? 0);
  const duplicateCount = Number(result?.duplicate_count ?? 0);
  const rejectedCount = Number(result?.rejected_count ?? 0);
  return NextResponse.json({
    batchId: result?.batch_id ?? null,
    fileSha256: fileHash,
    parserVersion: PARSER_VERSION,
    parsedCount: preview.parsedCount,
    insertedCount,
    duplicateCount,
    rejectedCount,
    sheetName
  }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
