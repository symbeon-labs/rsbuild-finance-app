import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decodeImportText, identifyBank, parseCsv, parseOfx } from "@/lib/finance";
import { resolveImportSourceIdentity } from "@/lib/bank-identification";
import { majorToMinor, normalizeImportCounts } from "@/lib/finance-persistence";
import { MAX_IMPORT_FILE_BYTES, validateImportFile } from "@/lib/import-validation";
import { recordAuditEvent } from "@/lib/api/audit";
import { requireOrgContext } from "@/lib/api/org-guard";

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
  const capabilityGuard = await requireOrgContext(request, organizationId, ["owner", "admin", "operator", "viewer"], "finance");
  if (!capabilityGuard.ok) return capabilityGuard.response;

  const { data, error } = await userClient.from("financial_records")
    .select("id, organization_id, account_id, data_source_id, import_batch_id, source_record_id, transaction_date, description, amount_minor, direction, category, status, created_by, created_at, financial_accounts(institution,name,external_reference,bank_code,branch_id), data_sources(provider,display_name,configuration), import_batches(metadata)")
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
    const account = Array.isArray(row.financial_accounts) ? row.financial_accounts[0] : row.financial_accounts;
    const dataSource = Array.isArray(row.data_sources) ? row.data_sources[0] : row.data_sources;
    const importBatch = Array.isArray(row.import_batches) ? row.import_batches[0] : row.import_batches;
    const sourceConfiguration = dataSource?.configuration && typeof dataSource.configuration === "object"
      ? dataSource.configuration as Record<string, unknown>
      : {};
    const batchMetadata = importBatch?.metadata && typeof importBatch.metadata === "object"
      ? importBatch.metadata as Record<string, unknown>
      : {};
    const batchBankIdentity = batchMetadata.bank_identity && typeof batchMetadata.bank_identity === "object"
      ? batchMetadata.bank_identity as Record<string, unknown>
      : {};
    const batchInstitutionName = typeof batchBankIdentity.institutionName === "string"
      ? batchBankIdentity.institutionName
      : undefined;
    const batchInstitutionCode = typeof batchBankIdentity.institutionCode === "string"
      ? batchBankIdentity.institutionCode
      : undefined;
    // Import-batch identity is authoritative when older records have only a generic
    // data-source label and no linked financial account.
    const rawBankName = account?.institution || account?.name ||
      batchInstitutionName ||
      (typeof sourceConfiguration.institution_name === "string" ? sourceConfiguration.institution_name : undefined) ||
      dataSource?.provider || dataSource?.display_name;
    const rawBankCode = account?.bank_code || batchInstitutionCode ||
      (typeof sourceConfiguration.institution_code === "string" ? sourceConfiguration.institution_code : undefined);
    const resolvedBank = identifyBank(rawBankCode, rawBankName);
    const bankName = resolvedBank.name !== "Instituição Bancária" ? resolvedBank.name : rawBankName;
    const bankCode = rawBankCode || (resolvedBank.code !== "0000" ? resolvedBank.code : undefined);
    return {
      id: row.id, date: row.transaction_date, description: row.description,
      amount: amountMinor / 100, direction: row.direction,
      category: row.category || "Não classificado",
      source: bankName || "Importação financeira",
      bankName: bankName ?? undefined,
      bankCode: bankCode ?? undefined,
      branchId: account?.branch_id ??
        (typeof sourceConfiguration.branch_id === "string" ? sourceConfiguration.branch_id : undefined),
      status: row.status === "conciliado" ? "conciliado" : "pendente", sourceRecordId: row.source_record_id ?? undefined,
      importBatchId: row.import_batch_id ?? undefined,
      accountId: row.account_id ?? undefined, dataSourceId: row.data_source_id ?? undefined,
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
  const capabilityGuard = await requireOrgContext(request, organizationId, ["owner", "admin", "operator"], "finance");
  if (!capabilityGuard.ok) return capabilityGuard.response;


  const bytes = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(bytes).digest("hex");
  let sourceText: string;
  try { sourceText = decodeImportText(bytes); }
  catch (error) {
    return NextResponse.json({
      error: "source_encoding_invalid",
      message: error instanceof Error ? error.message : "Codificação do arquivo não reconhecida."
    }, { status: 422 });
  }

  const parsed = file.name.toLowerCase().endsWith(".ofx") ? parseOfx(sourceText, file.name) : parseCsv(sourceText);
  if (parsed.errors.length || !parsed.records.length || parsed.records.length > MAX_RECORDS) {
    return NextResponse.json({
      error: "source_parse_failed",
      rejectedCount: parsed.errors.length,
      details: parsed.errors.slice(0, 20)
    }, { status: 422 });
  }

  const sourceIdentity = resolveImportSourceIdentity(parsed.metadata, file.name);
  const bankIdentity = parsed.metadata ? sourceIdentity : null;
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
      raw_payload: { source_record_id: row.sourceRecordId ?? null, source_row_index: index, parser_version: "main-finance-parser/2", bank_identity: bankIdentity, import_origin: { source_type: file.name.toLowerCase().endsWith(".ofx") ? "ofx" : "csv", provider: sourceIdentity.institutionName, identification_status: sourceIdentity.identificationStatus } }
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

  const requestedAccountId = String(form.get("accountId") ?? "").trim() || null;
  if (requestedAccountId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedAccountId)) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: "invalid_account_id" }, { status: 400 });
  }

  const { data, error } = await admin.rpc("commit_financial_import_trusted", {
    p_actor_id: user.id,
    p_organization_id: organizationId,
    p_original_filename: safeName,
    p_file_sha256: fileHash,
    p_file_size_bytes: file.size,
    p_storage_path: storagePath,
    p_records: normalized,
    p_bank_identity: sourceIdentity,
    p_account_id: requestedAccountId
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

  const result = data?.[0] ?? null;
  const counts = normalizeImportCounts(result);



  await recordAuditEvent({
    organizationId,
    actorId: user.id,
    actorEmail: user.email ?? null,
    eventType: "import.committed",
    entityType: "financial_record",
    metadata: { fileName: safeName, fileHash, parsedCount: normalized.length, ...counts }
  });
  return NextResponse.json({
    result,
    ...counts,
    parserVersion: "main-finance-parser/2",
    parsedCount: normalized.length
  }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
