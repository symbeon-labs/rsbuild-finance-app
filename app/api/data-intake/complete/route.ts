import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAuditEvent } from "@/lib/api/audit";
import { requireOrgContext } from "@/lib/api/org-guard";
import {
  DATA_INTAKE_TYPES,
  MAX_DATA_INTAKE_FILE_BYTES,
  getDataIntakeMediaType,
  validateDataIntakeFile,
  type DataIntakeDocumentType
} from "@/lib/data-intake-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const BUCKET = "rsbuild-data-intake";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeStorageName(fileName: string): string {
  return fileName.normalize("NFKC").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "document";
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_payload" }, { status: 400 }); }

  const organizationId = String(body.organizationId ?? "");
  const fileName = String(body.fileName ?? "").trim();
  const storagePath = String(body.path ?? "");
  const documentType = String(body.documentType ?? "other");
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 1000) : "";

  if (!UUID.test(organizationId) || !fileName || fileName.length > 255 || !UUID.test(storagePath.split("/")[2] ?? "")) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  if (!DATA_INTAKE_TYPES.includes(documentType as DataIntakeDocumentType)) {
    return NextResponse.json({ error: "invalid_document_type" }, { status: 400 });
  }
  const mediaType = getDataIntakeMediaType(fileName);
  if (!mediaType) return NextResponse.json({ error: "unsupported_file_type" }, { status: 415 });

  const expectedPath = `${organizationId}/documents/${storagePath.split("/")[2]}/${safeStorageName(fileName)}`;
  if (storagePath !== expectedPath) return NextResponse.json({ error: "invalid_storage_path" }, { status: 400 });

  const guard = await requireOrgContext(request, organizationId, ["owner", "admin", "operator"], "finance");
  if (!guard.ok) return guard.response;

  const admin = createAdminClient();
  const { data: storedFile, error: downloadError } = await admin.storage.from(BUCKET).download(storagePath);
  if (downloadError || !storedFile) {
    return NextResponse.json({ error: "uploaded_object_not_found" }, { status: 404 });
  }
  if (storedFile.size > MAX_DATA_INTAKE_FILE_BYTES) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }

  const bytes = new Uint8Array(await storedFile.arrayBuffer());
  const validationError = validateDataIntakeFile({ name: fileName, size: storedFile.size, type: mediaType }, bytes);
  if (validationError) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: "unsupported_or_invalid_file", message: validationError }, { status: 415 });
  }

  const fileSha256 = createHash("sha256").update(bytes).digest("hex");
  const { data: duplicate, error: duplicateError } = await admin
    .from("organization_documents")
    .select("id, original_filename, uploaded_at")
    .eq("organization_id", organizationId)
    .eq("file_sha256", fileSha256)
    .maybeSingle();

  if (duplicateError) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    console.error(JSON.stringify({ event: "data_intake_duplicate_check_failed", organizationId, code: duplicateError.code }));
    return NextResponse.json({ error: "document_check_failed" }, { status: 502 });
  }
  if (duplicate) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: "duplicate_document", existingDocument: duplicate }, { status: 409 });
  }

  const { data: document, error: insertError } = await admin
    .from("organization_documents")
    .insert({
      organization_id: organizationId,
      document_type: documentType,
      original_filename: fileName,
      storage_bucket: BUCKET,
      storage_path: storagePath,
      media_type: mediaType,
      file_size_bytes: storedFile.size,
      file_sha256: fileSha256,
      description: description || null,
      uploaded_by: guard.ctx.userId
    })
    .select("id, document_type, status, original_filename, media_type, file_size_bytes, file_sha256, description, uploaded_by, uploaded_at")
    .single();

  if (insertError || !document) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    if (insertError?.code === "23505") return NextResponse.json({ error: "duplicate_document" }, { status: 409 });
    console.error(JSON.stringify({ event: "data_intake_metadata_insert_failed", organizationId, code: insertError?.code }));
    return NextResponse.json({ error: "document_registration_failed" }, { status: 502 });
  }

  const { error: eventError } = await admin.from("organization_document_events").insert({
    document_id: document.id,
    organization_id: organizationId,
    actor_id: guard.ctx.userId,
    event_type: "uploaded",
    metadata: { document_type: documentType, media_type: mediaType, file_size_bytes: storedFile.size }
  });
  if (eventError) {
    await admin.from("organization_documents").delete().eq("id", document.id).eq("organization_id", organizationId);
    await admin.storage.from(BUCKET).remove([storagePath]);
    console.error(JSON.stringify({ event: "data_intake_event_insert_failed", organizationId, code: eventError.code }));
    return NextResponse.json({ error: "document_audit_failed" }, { status: 502 });
  }

  await recordAuditEvent({
    organizationId,
    actorId: guard.ctx.userId,
    actorEmail: guard.ctx.userEmail,
    eventType: "document.uploaded",
    entityType: "organization_document",
    entityId: document.id,
    metadata: { documentType, mediaType, fileSizeBytes: storedFile.size, sha256: fileSha256 }
  });

  return NextResponse.json({ document }, {
    status: 201,
    headers: { "Cache-Control": "private, no-store" }
  });
}
