/**
 * RSBUILD OS · Omie API Client (server-only)
 *
 * Cliente minimalista e seguro para a API REST Omie.
 * As credenciais (app_key / app_secret) NUNCA chegam ao browser:
 *   - Variáveis de ambiente são resolvidas por org no servidor.
 *   - Nenhuma rota client-side chama este módulo diretamente.
 *
 * Endpoints suportados:
 *   - Financas.ContaReceber.ListarResumo  — lista títulos a receber em aberto
 *   - Financas.ContaReceber.ConsultarTitulo — detalhe de um título
 *
 * Referência: https://developer.omie.com.br/service-list/
 */

const OMIE_API_URL = "https://app.omie.com.br/api/v1/";

export interface OmieCredentials {
  appKey: string;
  appSecret: string;
}

/** Título a receber retornado pelo Omie (campos relevantes para conciliação) */
export interface OmieTitleSummary {
  /** Código interno Omie do título */
  nCodTitulo: number;
  /** Código de integração (ID externo) */
  cCodIntTitulo: string;
  /** Número do documento (NF-e, Pedido etc.) */
  cNumDoc: string;
  /** Razão Social do cliente */
  cNomCliente: string;
  /** Data de vencimento DD/MM/AAAA */
  dDtVenc: string;
  /** Valor original do título em R$ */
  nValorTitulo: number;
  /** Saldo a receber (após parciais) */
  nValorSaldo: number;
  /** Status: "ABERTO" | "RECEBIDO" | "CANCELADO" */
  cStatus: string;
  /** Conta corrente prevista */
  cCodCC?: string;
  /** Categoria contábil */
  cCodCateg?: string;
}

export interface OmieListTitlesParams {
  /** Página (1-based) */
  nPagina?: number;
  /** Registros por página (máx. 500) */
  nRegPorPagina?: number;
  /** Filtro de status: "ABERTO" | "RECEBIDO" | "CANCELADO" */
  cStatus?: "ABERTO" | "RECEBIDO" | "CANCELADO";
  /** Data de vencimento inicial DD/MM/AAAA */
  dDtVencIni?: string;
  /** Data de vencimento final DD/MM/AAAA */
  dDtVencFim?: string;
}

export interface OmieListTitlesResponse {
  titles: OmieTitleSummary[];
  totalPages: number;
  totalRecords: number;
  currentPage: number;
}

/** Resultado tipado de chamada à API Omie */
export interface OmieApiError {
  faultstring: string;
  faultcode: string;
}

function isOmieError(payload: unknown): payload is OmieApiError {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "faultstring" in payload
  );
}

/**
 * Faz POST para a API Omie com autenticação server-side.
 * Lança OmieClientError em caso de falha HTTP ou erro da API.
 */
async function callOmie<T>(
  credentials: OmieCredentials,
  service: string,
  call: string,
  params: Record<string, unknown>[]
): Promise<T> {
  const url = `${OMIE_API_URL}${service}/`;
  const body = JSON.stringify({
    app_key: credentials.appKey,
    app_secret: credentials.appSecret,
    call,
    param: params,
  });

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      // next.js: não cacheia chamadas de API Omie
      cache: "no-store",
    });
  } catch (err) {
    throw new OmieClientError(
      `Falha de rede ao conectar com a API Omie (${call}): ${err instanceof Error ? err.message : String(err)}`,
      "NETWORK_ERROR"
    );
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    throw new OmieClientError(
      `Resposta inválida da API Omie (${call}): JSON malformado (HTTP ${res.status})`,
      "INVALID_RESPONSE"
    );
  }

  if (isOmieError(payload)) {
    throw new OmieClientError(
      `Omie API erro: ${payload.faultstring} (${payload.faultcode})`,
      payload.faultcode
    );
  }

  if (!res.ok) {
    throw new OmieClientError(
      `Omie API retornou HTTP ${res.status} em ${call}`,
      `HTTP_${res.status}`
    );
  }

  return payload as T;
}

export class OmieClientError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "OmieClientError";
    this.code = code;
  }
}

/**
 * Lista títulos a receber no Omie com paginação automática (até 2000 registros).
 * Sempre filtra por status=ABERTO por padrão para evitar retrabalho.
 */
export async function listReceivableTitles(
  credentials: OmieCredentials,
  params: OmieListTitlesParams = {}
): Promise<OmieListTitlesResponse> {
  const page = params.nPagina ?? 1;
  const perPage = Math.min(params.nRegPorPagina ?? 500, 500);

  const filter: Record<string, unknown> = {
    nPagina: page,
    nRegPorPagina: perPage,
    cStatus: params.cStatus ?? "ABERTO",
  };
  if (params.dDtVencIni) filter["dDtVencIni"] = params.dDtVencIni;
  if (params.dDtVencFim) filter["dDtVencFim"] = params.dDtVencFim;

  const raw = await callOmie<{
    nTotPaginas: number;
    nTotRegistros: number;
    nPagina: number;
    conta_receber_cadastro?: RawOmieTitle[];
  }>(credentials, "financas/contareceber", "ListarResumo", [filter]);

  const rawList = raw.conta_receber_cadastro ?? [];

  const titles: OmieTitleSummary[] = rawList.map((r) => ({
    nCodTitulo: r.cabecTitulo?.nCodTitulo ?? 0,
    cCodIntTitulo: r.cabecTitulo?.cCodIntTitulo ?? "",
    cNumDoc: r.cabecTitulo?.cNumDoc ?? "",
    cNomCliente: r.cabecTitulo?.cNomCliente ?? "",
    dDtVenc: r.cabecTitulo?.dDtVenc ?? "",
    nValorTitulo: r.cabecTitulo?.nValorTitulo ?? 0,
    nValorSaldo: r.cabecTitulo?.nValorSaldo ?? r.cabecTitulo?.nValorTitulo ?? 0,
    cStatus: r.cabecTitulo?.cStatus ?? "ABERTO",
    cCodCC: r.cabecTitulo?.cCodCC,
    cCodCateg: r.cabecTitulo?.cCodCateg,
  }));

  return {
    titles,
    totalPages: raw.nTotPaginas ?? 1,
    totalRecords: raw.nTotRegistros ?? titles.length,
    currentPage: raw.nPagina ?? page,
  };
}

/** Busca todas as páginas até o limite definido (default: 4 páginas = 2000 títulos) */
export async function listAllReceivableTitles(
  credentials: OmieCredentials,
  params: Omit<OmieListTitlesParams, "nPagina"> = {},
  maxPages = 4
): Promise<OmieTitleSummary[]> {
  const all: OmieTitleSummary[] = [];
  let page = 1;

  while (page <= maxPages) {
    const res = await listReceivableTitles(credentials, { ...params, nPagina: page, nRegPorPagina: 500 });
    all.push(...res.titles);
    if (page >= res.totalPages) break;
    page++;
  }

  return all;
}

/**
 * Converte data Omie "DD/MM/AAAA" → ISO "YYYY-MM-DD".
 * Retorna null se o formato for inválido.
 */
export function omieToIsoDate(dDt: string): string | null {
  const m = dDt.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/**
 * Converte data ISO "YYYY-MM-DD" → formato Omie "DD/MM/AAAA".
 */
export function isoToOmieDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// --- Tipos internos para mapeamento da resposta bruta da API ---

interface RawOmieTitle {
  cabecTitulo?: {
    nCodTitulo?: number;
    cCodIntTitulo?: string;
    cNumDoc?: string;
    cNomCliente?: string;
    dDtVenc?: string;
    nValorTitulo?: number;
    nValorSaldo?: number;
    cStatus?: string;
    cCodCC?: string;
    cCodCateg?: string;
  };
}
