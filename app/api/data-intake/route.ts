import { createHash, randomUUID } from "node:crypto";
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

export async function GET(request: Request) {
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
  const guard = await requireOrgContext(request, organizationId, ["owner", "admin", "operator", "viewer"], "finance");
  if (!guard.ok) return guard.response;

  const { data, error } = await guard.ctx.supabase
    .from("organization_documents")
    .select("id, document_type, status, original_filename, media_type, file_size_bytes, file_sha256, description, uploaded_by, uploaded_at")
    .eq("organization_id", organizationId)
    .order("uploaded_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error(JSON.stringify({ event: "data_intake_list_failed", organizationId, code: error.code }));
    return NextResponse.json({ error: "documents_unavailable" }, { status: 502 });
  }
  return NextResponse.json({ documents: data ?? [] }, {
    status: 200,
    headers: { "Cache-Control": "private, no-store" }
  });
}

export async function POST(request: Request) {
  let form: FormData;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ error: "invalid_multipart" }, { status: 400 }); }

  const orgId = String(form.get("organizationId") ?? "");
  const file = form.get("file");
  const documentType = String(form.get("documentType") ?? "other");
  const description = String(form.get("description") ?? "").trim().slice(0, 1000);

  if (!UUID.test(orgId) || !(file instanceof File)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  if (!DATA_INTAKE_TYPES.includes(documentType as DataIntakeDocumentType)) {
    return NextResponse.json({ error: "invalid_document_type" }, { status: 400 });
  }

  const guard = await requireOrgContext(request, orgId, ["owner", "admin", "operator"], "finance");
  if (!guard.ok) return guard.response;

  if (file.size > MAX_DATA_INTAKE_FILE_BYTES) {
    return NextResponse.json({ error: "file_too_large", message: "O arquivo excede o limite de 20 MiB." }, { status: 413 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const validationError = validateDataIntakeFile(file, bytes);
  if (validationError) return NextResponse.json({ error: "unsupported_or_invalid_file", message: validationError }, { status: 415 });

  const mediaType = getDataIntakeMediaType(file.name);
  if (!mediaType) return NextResponse.json({ error: "unsupported_file_type" }, { status: 415 });
  const fileSha256 = createHash("sha256").update(bytes).digest("hex");
  const admin = createAdminClient();

  const { data: duplicate, error: duplicateError } = await admin
    .from("organization_documents")
    .select("id, original_filename, uploaded_at")
    .eq("organization_id", orgId)
    .eq("file_sha256", fileSha256)
    .maybeSingle();
  if (duplicateError) {
    console.error(JSON.stringify({ event: "data_intake_duplicate_check_failed", organizationId: orgId, code: duplicateError.code }));
    return NextResponse.json({ error: "document_check_failed" }, { status: 502 });
  }
  if (duplicate) {
    return NextResponse.json({ error: "duplicate_document", existingDocument: duplicate }, { status: 409 });
  }

  const safeName = file.name.normalize("NFKC").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "document";
  const storagePath = `${orgId}/documents/${randomUUID()}/${safeName}`;
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, new Blob([bytes], { type: mediaType }), {
    contentType: mediaType,
    upsert: false
  });
  if (uploadError) {
    console.error(JSON.stringify({ event: "data_intake_storage_upload_failed", organizationId: orgId, code: uploadError.name }));
    return NextResponse.json({ error: "document_upload_failed" }, { status: 502 });
  }

  const { data: document, error: insertError } = await admin
    .from("organization_documents")
    .insert({
      organization_id: orgId,
      document_type: documentType,
      original_filename: file.name.slice(0, 255),
      storage_bucket: BUCKET,
      storage_path: storagePath,
      media_type: mediaType,
      file_size_bytes: file.size,
      file_sha256: fileSha256,
      description: description || null,
      uploaded_by: guard.ctx.userId
    })
    .select("id, document_type, status, original_filename, media_type, file_size_bytes, file_sha256, description, uploaded_by, uploaded_at")
    .single();

  if (insertError || !document) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    if (insertError?.code === "23505") {
      return NextResponse.json({ error: "duplicate_document" }, { status: 409 });
    }
    console.error(JSON.stringify({ event: "data_intake_metadata_insert_failed", organizationId: orgId, code: insertError?.code }));
    return NextResponse.json({ error: "document_registration_failed" }, { status: 502 });
  }

  const { error: eventError } = await admin.from("organization_document_events").insert({
    document_id: document.id,
    organization_id: orgId,
    actor_id: guard.ctx.userId,
    event_type: "uploaded",
    metadata: { document_type: documentType, media_type: mediaType, file_size_bytes: file.size }
  });
  if (eventError) {
    await admin.from("organization_documents").delete().eq("id", document.id).eq("organization_id", orgId);
    await admin.storage.from(BUCKET).remove([storagePath]);
    console.error(JSON.stringify({ event: "data_intake_event_insert_failed", organizationId: orgId, code: eventError.code }));
    return NextResponse.json({ error: "document_audit_failed" }, { status: 502 });
  }

  await recordAuditEvent({
    organizationId: orgId,
    actorId: guard.ctx.userId,
    actorEmail: guard.ctx.userEmail,
    eventType: "document.uploaded",
    entityType: "organization_document",
    entityId: document.id,
    metadata: { documentType, mediaType, fileSizeBytes: file.size, sha256: fileSha256 }
  });

  return NextResponse.json({ document }, {
    status: 201,
    headers: { "Cache-Control": "private, no-store" }
  });
}
