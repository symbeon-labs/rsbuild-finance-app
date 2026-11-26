import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrgContext } from "@/lib/api/org-guard";
import {
  DATA_INTAKE_TYPES,
  MAX_DATA_INTAKE_FILE_BYTES,
  getDataIntakeMediaType,
  type DataIntakeDocumentType
} from "@/lib/data-intake-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const BUCKET = "rsbuild-data-intake";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_payload" }, { status: 400 }); }

  const organizationId = String(body.organizationId ?? "");
  const fileName = String(body.fileName ?? "").trim();
  const fileSize = Number(body.fileSize);
  const documentType = String(body.documentType ?? "other");
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 1000) : "";

  if (!UUID.test(organizationId) || !fileName || fileName.length > 255 || !Number.isSafeInteger(fileSize) || fileSize < 1) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  if (fileSize > MAX_DATA_INTAKE_FILE_BYTES) {
    return NextResponse.json({ error: "file_too_large", message: "O arquivo excede o limite de 20 MiB." }, { status: 413 });
  }
  if (!DATA_INTAKE_TYPES.includes(documentType as DataIntakeDocumentType)) {
    return NextResponse.json({ error: "invalid_document_type" }, { status: 400 });
  }
  const mediaType = getDataIntakeMediaType(fileName);
  if (!mediaType) return NextResponse.json({ error: "unsupported_file_type" }, { status: 415 });

  const guard = await requireOrgContext(request, organizationId, ["owner", "admin", "operator"], "finance");
  if (!guard.ok) return guard.response;

  const safeName = fileName.normalize("NFKC").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "document";
  const storagePath = `${organizationId}/documents/${randomUUID()}/${safeName}`;
  const admin = createAdminClient();
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const { error: intentError } = await admin.from("organization_document_upload_intents").insert({
    organization_id: organizationId,
    storage_path: storagePath,
    created_by: guard.ctx.userId,
    expected_file_size: fileSize,
    expected_media_type: mediaType,
    expected_filename: fileName,
    expected_document_type: documentType,
    expected_description: description || null,
    expires_at: expiresAt
  });
  if (intentError) {
    console.error(JSON.stringify({ event: "data_intake_intent_record_failed", organizationId, code: intentError.code }));
    return NextResponse.json({ error: "upload_intent_unavailable" }, { status: 502 });
  }

  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(storagePath, { upsert: false });
  if (error || !data?.token) {
    await admin.from("organization_document_upload_intents").delete().eq("storage_path", storagePath).eq("organization_id", organizationId);
    console.error(JSON.stringify({ event: "data_intake_signed_token_failed", organizationId, code: error?.name }));
    return NextResponse.json({ error: "upload_intent_unavailable" }, { status: 502 });
  }

  return NextResponse.json({
    path: storagePath,
    token: data.token,
    mediaType,
    documentType,
    description,
    expiresAt
  }, {
    status: 201,
    headers: { "Cache-Control": "private, no-store" }
  });
}
