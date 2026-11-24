/**
 * GET /api/omie/titles?organizationId=&status=ABERTO&dDtVencIni=DD/MM/AAAA&dDtVencFim=DD/MM/AAAA
 *
 * Consulta títulos a receber diretamente na API Omie (Financas.ContaReceber.ListarResumo).
 * As credenciais são resolvidas server-side a partir das variáveis de ambiente da organização.
 *
 * Requer: role operator|admin|owner + módulo finance ativo.
 * Nunca expõe app_key/app_secret ao cliente.
 */
import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/api/org-guard";
import {
  listAllReceivableTitles,
  OmieClientError,
  OmieCredentials,
  OmieListTitlesParams,
} from "@/lib/omie-client";

export const dynamic = "force-dynamic";

/** Resolve as credenciais Omie da organização via variáveis de ambiente. */
function resolveOmieCredentials(organizationId: string): OmieCredentials | null {
  // Suporte a credencial global (single-tenant QA) ou por org (produção)
  const appKey =
    process.env[`OMIE_APP_KEY_${organizationId.toUpperCase().replace(/-/g, "_")}`] ??
    process.env["OMIE_APP_KEY"];
  const appSecret =
    process.env[`OMIE_APP_SECRET_${organizationId.toUpperCase().replace(/-/g, "_")}`] ??
    process.env["OMIE_APP_SECRET"];

  if (!appKey || !appSecret) return null;
  return { appKey, appSecret };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId") ?? "";

  const guard = await requireOrgContext(request, organizationId, ["owner", "admin", "operator"], "finance");
  if (!guard.ok) return guard.response;

  const credentials = resolveOmieCredentials(organizationId);
  if (!credentials) {
    return NextResponse.json(
      {
        error: "omie_credentials_not_configured",
        detail: "As credenciais Omie (OMIE_APP_KEY / OMIE_APP_SECRET) não estão configuradas para esta organização.",
      },
      { status: 503 }
    );
  }

  const params: OmieListTitlesParams = {
    cStatus: (url.searchParams.get("status") as "ABERTO" | "RECEBIDO" | "CANCELADO") ?? "ABERTO",
  };
  if (url.searchParams.has("dDtVencIni")) params.dDtVencIni = url.searchParams.get("dDtVencIni")!;
  if (url.searchParams.has("dDtVencFim")) params.dDtVencFim = url.searchParams.get("dDtVencFim")!;

  try {
    const titles = await listAllReceivableTitles(credentials, params);
    return NextResponse.json(
      { titles, count: titles.length },
      { status: 200, headers: { "Cache-Control": "private, max-age=60" } }
    );
  } catch (err) {
    if (err instanceof OmieClientError) {
      const statusCode = err.code.startsWith("HTTP_") ? parseInt(err.code.slice(5)) : 502;
      return NextResponse.json(
        { error: "omie_api_error", detail: err.message, code: err.code },
        { status: statusCode >= 400 && statusCode < 600 ? statusCode : 502 }
      );
    }
    console.error(JSON.stringify({ event: "rsbuild_omie_titles_failed", organizationId, err: String(err) }));
    return NextResponse.json({ error: "omie_titles_unavailable" }, { status: 502 });
  }
}
