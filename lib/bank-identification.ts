import type { BankMetadata } from "@/lib/finance";

export type BankIdentity = {
  /** Original identifier from the source file; never discard leading zeroes. */
  institutionCode: string | null;
  /** Canonical display name when known, otherwise an explicit unresolved label. */
  institutionName: string;
  identificationStatus: "identified" | "unrecognized" | "missing";
  accountNumber: string | null;
  branchId: string | null;
  accountType: string | null;
  currency: string;
  displayAccountName: string;
};

/**
 * Catálogo canônico abrangente de instituições financeiras (COMPE / BACEN / Febraban).
 * Mapeia códigos normalizados (sem zeros à esquerda) para o nome oficial da instituição.
 * Cobre bancos comerciais, estaduais, múltiplos, bancos de investimento, cooperativas de crédito e fintechs PJ.
 */
export const BANK_REGISTRY: Record<string, string> = {
  // Bancos Tradicionais e Públicos
  "1": "Banco do Brasil",
  "3": "Banco da Amazônia (BASA)",
  "4": "Banco do Nordeste (BNB)",
  "21": "Banestes",
  "25": "Banco Alfa",
  "33": "Santander",
  "37": "Banpará",
  "41": "Banrisul",
  "47": "Banco do Estado de Sergipe (Banese)",
  "70": "Banco de Brasília (BRB)",
  "104": "Caixa Econômica Federal",
  "237": "Bradesco",
  "341": "Itaú Unibanco",
  "389": "Banco Mercantil do Brasil",
  "399": "HSBC / Kirton Bank",
  "422": "Banco Safra",
  "477": "Citibank N.A.",
  "655": "Banco Votorantim (BV)",
  "745": "Citibank Brasil",

  // Fintechs, Bancos Digitais, Adquirentes e Contas PJ
  "77": "Banco Inter",
  "102": "XP Investimentos",
  "121": "Agibank",
  "125": "Banco Genial",
  "197": "Stone Pagamentos",
  "208": "BTG Pactual",
  "212": "Banco Original",
  "218": "Banco BS2",
  "246": "Banco ABC Brasil",
  "260": "Nubank",
  "280": "Will Bank",
  "290": "PagBank / PagSeguro",
  "301": "BPP Instituição de Pagamento",
  "318": "Banco BMG",
  "323": "Mercado Pago",
  "329": "QI Sociedade de Crédito Direto",
  "332": "Acesso Soluções de Pagamento",
  "335": "Banco Digio",
  "336": "C6 Bank",
  "348": "Banco XP",
  "364": "Efí (Gerencianet)",
  "380": "PicPay",
  "403": "Cora SCD",
  "413": "Banco BV",
  "450": "Fitbank Pagamentos",
  "461": "Asaas Gestão Financeira",
  "505": "Credit Suisse Brasil",
  "509": "Celcoin",
  "536": "Neon Pagamentos",
  "623": "Banco Pan",
  "633": "Banco Rendimento",
  "637": "Banco Sofisa",
  "643": "Banco Pine",
  "652": "Itaú Unibanco Holding",
  "653": "Banco Voiter",
  "654": "Banco Digimais",
  "707": "Banco Daycoval",
  "735": "Neon",
  "739": "Banco Cetelem",
  "746": "Banco Modal",
  "747": "Rabobank",

  // Cooperativas de Crédito (Agro, distribuição e comércio)
  "85": "Viacredi (Ailos)",
  "97": "Credisis",
  "99": "Uniprime Central",
  "133": "Cresol Confederação",
  "136": "Unicred do Brasil",
  "748": "Sicredi",
  "756": "Sicoob (Bancoob)"
};

/** Mapeamento de palavras-chave textuais (<ORG>, <FID> ou nome de arquivo) para códigos BACEN e nomes canônicos */
export const KNOWN_ORG_KEYWORDS: Array<{ pattern: RegExp; code: string; name: string }> = [
  { pattern: /ITAU|ITAÚ/i, code: "0341", name: "Itaú Unibanco" },
  { pattern: /SAFRA/i, code: "0422", name: "Banco Safra" },
  { pattern: /OMIE[\s._-]*CASH|OMIECASH/i, code: "0000", name: "Omie.CASH" },
  { pattern: /NUBANK|NU\s*PAGAMENTOS/i, code: "0260", name: "Nubank" },
  { pattern: /\bINTER\b|BANCO\s+INTER|INTERMEDIUM/i, code: "0077", name: "Banco Inter" },
  { pattern: /SICOOB|BANCOOB/i, code: "0756", name: "Sicoob (Bancoob)" },
  { pattern: /SICREDI/i, code: "0748", name: "Sicredi" },
  { pattern: /\bCORA\b/i, code: "0403", name: "Cora SCD" },
  { pattern: /BRADESCO/i, code: "0237", name: "Bradesco" },
  { pattern: /SANTANDER/i, code: "0033", name: "Santander" },
  { pattern: /BANCO\s+DO\s+BRASIL|\bBB\b/i, code: "0001", name: "Banco do Brasil" },
  { pattern: /CAIXA\s+ECONOMICA|CAIXA\s+ECONÔMICA|\bCEF\b|\bCAIXA\b/i, code: "0104", name: "Caixa Econômica Federal" },
  { pattern: /\bC6\b|C6\s*BANK/i, code: "0336", name: "C6 Bank" },
  { pattern: /\bBTG\b/i, code: "0208", name: "BTG Pactual" },
  { pattern: /PAGSEGURO|PAGBANK/i, code: "0290", name: "PagBank / PagSeguro" },
  { pattern: /MERCADO\s*PAGO/i, code: "0323", name: "Mercado Pago" },
  { pattern: /ASAAS/i, code: "0461", name: "Asaas Gestão Financeira" },
  { pattern: /\bSTONE\b/i, code: "0197", name: "Stone Pagamentos" },
  { pattern: /\bXP\b|XP\s*INVEST/i, code: "0102", name: "XP Investimentos" },
  { pattern: /NORDESTE|\bBNB\b/i, code: "0004", name: "Banco do Nordeste (BNB)" },
  { pattern: /BANRISUL/i, code: "0041", name: "Banrisul" },
  { pattern: /\bBRB\b|BRASILIA|BRASÍLIA/i, code: "0070", name: "Banco de Brasília (BRB)" },
  { pattern: /UNICRED/i, code: "0136", name: "Unicred do Brasil" },
  { pattern: /CRESOL/i, code: "0133", name: "Cresol Confederação" },
  { pattern: /VIACREDI|AILOS/i, code: "0085", name: "Viacredi (Ailos)" },
  { pattern: /GERENCIANET|\bEFI\b|\bEFÍ\b/i, code: "0364", name: "Efí (Gerencianet)" },
  { pattern: /\bNEON\b/i, code: "0536", name: "Neon Pagamentos" },
  { pattern: /PICPAY/i, code: "0380", name: "PicPay" },
  { pattern: /ORIGINAL/i, code: "0212", name: "Banco Original" },
  { pattern: /\bBS2\b/i, code: "0218", name: "Banco BS2" },
  { pattern: /DAYCOVAL/i, code: "0707", name: "Banco Daycoval" },
  { pattern: /SOFISA/i, code: "0637", name: "Banco Sofisa" },
  { pattern: /RENDIMENTO/i, code: "0633", name: "Banco Rendimento" },
  { pattern: /BANCO\s*PAN|\bPAN\b/i, code: "0623", name: "Banco Pan" },
  { pattern: /\bBMG\b/i, code: "0318", name: "Banco BMG" },
  { pattern: /AGIBANK/i, code: "0121", name: "Agibank" },
  { pattern: /GENIAL/i, code: "0125", name: "Banco Genial" },
  { pattern: /ABC\s*BRASIL/i, code: "0246", name: "Banco ABC Brasil" },
  { pattern: /VOTORANTIM|\bBV\b/i, code: "0655", name: "Banco Votorantim (BV)" },
  { pattern: /CITIBANK/i, code: "0745", name: "Citibank Brasil" },
  { pattern: /FITBANK/i, code: "0450", name: "Fitbank Pagamentos" },
  { pattern: /CELCOIN/i, code: "0509", name: "Celcoin" },
  { pattern: /BANESTES/i, code: "0021", name: "Banestes" },
  { pattern: /BANESE/i, code: "0047", name: "Banco do Estado de Sergipe (Banese)" }
];

function normalizeInstitutionCode(value: string | null): string | null {
  if (!value) return null;
  // Normalize for lookup only; retain the original value in the returned identity.
  return value.replace(/^0+(?=\d)/, "");
}

const GENERIC_BANK_LABELS = new Set([
  "instituicao bancaria",
  "instituicao nao identificada",
  "importacao financeira",
  "importacao ofx",
  "importacao csv",
  "banco",
  "ofx",
  "csv"
]);

function isGenericBankLabel(name?: string | null): boolean {
  if (!name) return true;
  const clean = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  return !clean || GENERIC_BANK_LABELS.has(clean);
}

/** Resolve a bank without rejecting unknown identifiers or fabricating institution names. */
export function resolveBankIdentity(metadata: BankMetadata): BankIdentity {
  const rawCode = metadata.bankId?.trim() || null;
  const normalizedCode = normalizeInstitutionCode(rawCode);
  const registeredName = normalizedCode ? BANK_REGISTRY[normalizedCode] : undefined;

  // Fallback por nome caso código numérico não esteja presente ou não esteja no catálogo
  const keywordMatch = !registeredName && metadata.bankName
    ? KNOWN_ORG_KEYWORDS.find((k) => k.pattern.test(metadata.bankName!))
    : undefined;

  const customExplicitName = !registeredName && !keywordMatch && !isGenericBankLabel(metadata.bankName)
    ? metadata.bankName!.trim()
    : undefined;

  const institutionName = registeredName
    ?? keywordMatch?.name
    ?? customExplicitName
    ?? (rawCode ? `Instituição não catalogada (código ${rawCode})` : "Instituição não identificada");
  const resolvedCode = rawCode || (keywordMatch && keywordMatch.code !== "0000" ? keywordMatch.code : null);
  const accountNumber = metadata.accountId?.trim() || null;

  return {
    institutionCode: resolvedCode,
    institutionName,
    identificationStatus: (registeredName || keywordMatch || customExplicitName) ? "identified" : resolvedCode ? "unrecognized" : "missing",
    accountNumber,
    branchId: metadata.branchId?.trim() || null,
    accountType: metadata.accountType?.trim().toUpperCase() || null,
    currency: "BRL",
    displayAccountName: accountNumber ? `${institutionName} · Conta ${accountNumber}` : institutionName
  };
}

/** Always produce a persistable origin identity; never infer an unknown bank. */
export function resolveImportSourceIdentity(metadata: BankMetadata | undefined, filename: string): BankIdentity {
  if (metadata) return resolveBankIdentity(metadata);
  const isOfx = filename.toLowerCase().endsWith(".ofx");
  const institutionName = isOfx ? "OFX — instituição não identificada" : "Importação CSV";
  return {
    institutionCode: null,
    institutionName,
    identificationStatus: "missing",
    accountNumber: null,
    branchId: null,
    accountType: null,
    currency: "BRL",
    displayAccountName: institutionName
  };
}
