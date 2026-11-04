import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MAX_IMPORT_FILE_BYTES, validateImportFile } from "@/lib/import-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IncomingRecord = {
  date: string;
  description: string;
  amount: number;
  direction: "entrada" | "saída";
  category?: string;
  sourceRecordId?: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const form = await request.formData();
  const organizationId = String(form.get("organizationId") ?? "");
  const file = form.get("file");
  const recordsRaw = String(form.get("records") ?? "");

  if (!/^[0-9a-f-]{36}$/i.test(organizationId) || !(file instanceof File)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const fileError = validateImportFile(file);
  if (fileError) {
    const status = file.size > MAX_IMPORT_FILE_BYTES ? 413 : 415;
    return NextResponse.json({ error: fileError }, { status });
  }

  let incoming: IncomingRecord[];
  try {
    incoming = JSON.parse(recordsRaw);
  } catch {
    return NextResponse.json({ error: "invalid_records_json" }, { status: 400 });
  }
  if (!Array.isArray(incoming) || incoming.length < 1 || incoming.length > 5000) {
    return NextResponse.json({ error: "invalid_record_count" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(bytes).digest("hex");
  const normalized = [];
  for (const [rowIndex, row] of incoming.entries()) {
    if (!row || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
        typeof row.description !== "string" || !row.description.trim() ||
        !Number.isFinite(row.amount) || row.amount < 0 ||
        !["entrada", "saída"].includes(row.direction)) {
      return NextResponse.json({ error: "invalid_record" }, { status: 422 });
    }
    const amountMinor = Math.round(row.amount * 100);
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
      return NextResponse.json({ error: "invalid_amount" }, { status: 422 });
    }
    // Conservative idempotency: the same file row is stable across retries,
    // while two legitimate identical transactions on different rows remain distinct.
    const keySource = `${fileHash}|${rowIndex}`;
    normalized.push({
      transaction_date: row.date,
      description: row.description.trim().slice(0, 500),
      amount_minor: String(amountMinor),
      direction: row.direction,
      category: (row.category ?? "Não classificado").slice(0, 120),
      deduplication_key: createHash("sha256").update(keySource).digest("hex"),
      raw_payload: { source_record_id: row.sourceRecordId ?? null },
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
    await supabase.storage.from("rsbuild-source-artifacts").remove([storagePath]);
    return NextResponse.json({ error: "import_commit_failed" }, { status: 422 });
  }

  return NextResponse.json({ result: data?.[0] ?? null }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
