import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/api/org-guard";
import { decodeImportText } from "@/lib/finance";
import { previewPayablesCsv, type PayableCsvPreview } from "@/lib/finance/payables-import";
import { previewPayablesXlsx } from "@/lib/finance/payables-xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    return NextResponse.json({ error: "unsupported_file_type", message: "Envie um arquivo CSV ou XLSX de contas a pagar em aberto." }, { status: 415 });
  }
  if (file.size < 1) return NextResponse.json({ error: "empty_file" }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "file_too_large" }, { status: 413 });

  const capabilityGuard = await requireOrgContext(request, organizationId, ["owner", "admin", "operator"], "finance");
  if (!capabilityGuard.ok) return capabilityGuard.response;

  const bytes = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(bytes).digest("hex");
  const requestedSheetName = String(form.get("sheetName") ?? "") || undefined;
  let preview: PayableCsvPreview;
  let sheetMetadata: { sheetName?: string; availableSheets?: string[] } = {};

  try {
    if (extension === "xlsx") {
      const workbookPreview = previewPayablesXlsx(bytes, requestedSheetName);
      preview = workbookPreview;
      sheetMetadata = { sheetName: workbookPreview.sheetName, availableSheets: workbookPreview.availableSheets };
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

  return NextResponse.json({
    previewId: fileHash,
    fileName: file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120),
    fileSha256: fileHash,
    parserVersion: PARSER_VERSION,
    ...sheetMetadata,
    parsedCount: preview.parsedCount,
    acceptedCount: preview.rows.length,
    rejectedCount: preview.errors.filter((issue) => issue.code !== "duplicate_in_file").length,
    duplicateCount: preview.duplicateCount,
    rows: preview.rows,
    errors: preview.errors.slice(0, 100),
    truncatedErrors: preview.errors.length > 100
  }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
}
