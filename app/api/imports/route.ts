import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseCsv, parseOfx } from "@/lib/finance";
import { MAX_IMPORT_FILE_BYTES, validateImportFile } from "@/lib/import-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PARSER_VERSION = "rsbuild-import/1.1.0";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let form: FormData;
  try { form = await request.formData(); } catch {
    return NextResponse.json({ error: "invalid_multipart" }, { status: 400 });
  }
  const organizationId = String(form.get("organizationId") ?? "");
  const file = form.get("file");
  if (!/^[0-9a-f-]{36}$/i.test(organizationId) || !(file instanceof File)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const fileError = validateImportFile(file);
  if (fileError) {
    const status = file.size > MAX_IMPORT_FILE_BYTES ? 413 : 415;
    return NextResponse.json({ error: fileError }, { status });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(bytes).digest("hex");
  let sourceText: string;
  try { sourceText = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch {
    return NextResponse.json({ error: "source_encoding_invalid" }, { status: 422 });
  }
  const parsed = file.name.toLowerCase().endsWith(".ofx")
    ? parseOfx(sourceText)
    : parseCsv(sourceText);

  // The server is authoritative: client-supplied parsed rows are never persisted.
  // A partially parsed statement is rejected as a whole to avoid silent omissions.
  if (parsed.errors.length || !parsed.records.length || parsed.records.length > 5000) {
    return NextResponse.json({
      error: "source_parse_failed",
      parserVersion: PARSER_VERSION,
      rejectedCount: parsed.errors.length,
      details: parsed.errors.slice(0, 25),
    }, { status: 422 });
  }

  const normalized = [];
  for (const [rowIndex, row] of parsed.records.entries()) {
    if (!Number.isSafeInteger(row.amountMinor) || row.amountMinor < 0 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !row.description.trim()) {
      return NextResponse.json({ error: "server_parser_invalid_record" }, { status: 422 });
    }
    const keySource = `${fileHash}|${rowIndex}`;
    normalized.push({
      transaction_date: row.date,
      description: row.description.trim().slice(0, 500),
      amount_minor: String(row.amountMinor),
      direction: row.direction,
      category: row.category.slice(0, 120) || "Não classificado",
      deduplication_key: createHash("sha256").update(keySource).digest("hex"),
      raw_payload: {
        source_record_id: row.sourceRecordId ?? null,
        parser_version: PARSER_VERSION,
        source_row_index: rowIndex,
      },
    });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "statement.csv";
  const storagePath = `${organizationId}/imports/${randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("rsbuild-source-artifacts")
    .upload(storagePath, new Blob([bytes], { type: file.type || "application/octet-stream" }), {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) return NextResponse.json({ error: "artifact_upload_failed" }, { status: 403 });

  const { data, error } = await supabase.rpc("commit_financial_import", {
    p_organization_id: organizationId,
    p_original_filename: safeName,
    p_file_sha256: fileHash,
    p_file_size_bytes: file.size,
    p_storage_path: storagePath,
    p_records: normalized,
  });

  if (error) {
    const { error: cleanupError } = await supabase.storage.from("rsbuild-source-artifacts").remove([storagePath]);
    if (cleanupError) {
      console.error(JSON.stringify({
        event: "rsbuild_import_artifact_cleanup_failed",
        organizationId,
        storagePath,
        fileHash,
        errorCode: cleanupError.name ?? "storage_cleanup_error",
      }));
    }
    return NextResponse.json({
      error: "import_commit_failed",
      cleanupPending: Boolean(cleanupError),
    }, { status: 422 });
  }

  return NextResponse.json({
    result: data?.[0] ?? null,
    parserVersion: PARSER_VERSION,
    parsedCount: normalized.length,
  }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
