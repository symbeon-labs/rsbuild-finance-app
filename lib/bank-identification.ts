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
  "33": "Santander",
  "41": "Banrisul",
  "47": "Banco do Estado de Sergipe (Banese)",
  "70": "Banco de Brasília (BRB)",
  "104": "Caixa Econômica Federal",
  "237": "Bradesco",
  "341": "Itaú Unibanco",
  "389": "Banco Mercantil do Brasil",
  "422": "Banco Safra",
  "655": "Banco Votorantim (BV)",
  "745": "Citibank Brasil",

  // Fintechs, Bancos Digitais e Contas PJ
  "77": "Banco Inter",
  "102": "XP Investimentos",
  "197": "Stone Pagamentos",
  "208": "BTG Pactual",
  "212": "Banco Original",
  "218": "Banco BS2",
  "260": "Nubank",
  "280": "Will Bank",
  "290": "PagBank / PagSeguro",
  "318": "Banco BMG",
  "323": "Mercado Pago",
  "332": "Acesso Soluções de Pagamento",
  "335": "Banco Digio",
  "336": "C6 Bank",
  "380": "PicPay",
  "403": "Cora SCD",
  "461": "Asaas Gestão Financeira",
  "505": "Credit Suisse Brasil",
  "623": "Banco Pan",
  "633": "Banco Rendimento",
  "637": "Banco Sofisa",
  "652": "Itaú Unibanco Holding",
  "654": "Banco Digimais",
  "707": "Banco Daycoval",
  "739": "Banco Cetelem",

  // Cooperativas de Crédito (Essenciais para agro, distribuição e comércio)
  "85": "Viacredi (Ailos)",
  "97": "Credisis",
  "133": "Cresol Confederação",
  "136": "Unicred do Brasil",
  "748": "Sicredi",
  "756": "Sicoob (Bancoob)"
};

/** Mapeamento de palavras-chave textuais de tags <ORG> ou <FID> do OFX para códigos BACEN */
export const KNOWN_ORG_KEYWORDS: Array<{ pattern: RegExp; code: string; name: string }> = [
  { pattern: /ITAU|ITAÚ/i, code: "0341", name: "Itaú Unibanco" },
  { pattern: /SAFRA/i, code: "0422", name: "Banco Safra" },
  { pattern: /NUBANK|NU PAGAMENTOS/i, code: "0260", name: "Nubank" },
  { pattern: /INTER/i, code: "0077", name: "Banco Inter" },
  { pattern: /SICOOB|BANCOOB/i, code: "0756", name: "Sicoob (Bancoob)" },
  { pattern: /SICREDI/i, code: "0748", name: "Sicredi" },
  { pattern: /CORA/i, code: "0403", name: "Cora SCD" },
  { pattern: /BRADESCO/i, code: "0237", name: "Bradesco" },
  { pattern: /SANTANDER/i, code: "0033", name: "Santander" },
  { pattern: /BRASIL|BANCO DO BRASIL|^BB/i, code: "0001", name: "Banco do Brasil" },
  { pattern: /CAIXA|CEF/i, code: "0104", name: "Caixa Econômica Federal" },
  { pattern: /C6/i, code: "0336", name: "C6 Bank" },
  { pattern: /BTG/i, code: "0208", name: "BTG Pactual" },
  { pattern: /PAGSEGURO|PAGBANK/i, code: "0290", name: "PagBank / PagSeguro" },
  { pattern: /MERCADO PAGO/i, code: "0323", name: "Mercado Pago" },
  { pattern: /ASAAS/i, code: "0461", name: "Asaas Gestão Financeira" },
  { pattern: /STONE/i, code: "0197", name: "Stone Pagamentos" },
  { pattern: /XP/i, code: "0102", name: "XP Investimentos" },
  { pattern: /NORDESTE|BNB/i, code: "0004", name: "Banco do Nordeste (BNB)" },
  { pattern: /BANRISUL/i, code: "0041", name: "Banrisul" },
  { pattern: /BRB/i, code: "0070", name: "Banco de Brasília (BRB)" },
  { pattern: /UNICRED/i, code: "0136", name: "Unicred do Brasil" },
  { pattern: /CRESOL/i, code: "0133", name: "Cresol Confederação" },
  { pattern: /VIACREDI/i, code: "0085", name: "Viacredi (Ailos)" }
];

function normalizeInstitutionCode(value: string | null): string | null {
  if (!value) return null;
  // Normalize for lookup only; retain the original value in the returned identity.
  return value.replace(/^0+(?=\d)/, "");
}

/** Resolve a bank without rejecting unknown identifiers or fabricating institution names. */
export function resolveBankIdentity(metadata: BankMetadata): BankIdentity {
  const rawCode = metadata.bankId?.trim() || null;
  const normalizedCode = normalizeInstitutionCode(rawCode);
  const registeredName = normalizedCode ? BANK_REGISTRY[normalizedCode] : undefined;
  
  // Fallback por nome caso código numérico não esteja presente mas haja bankName
  let fallbackName: string | undefined;
  if (!registeredName && metadata.bankName) {
    const matched = KNOWN_ORG_KEYWORDS.find((k) => k.pattern.test(metadata.bankName!));
    if (matched) fallbackName = matched.name;
  }

  const institutionName = registeredName
    ?? fallbackName
    ?? (rawCode ? `Instituição não catalogada (código ${rawCode})` : "Instituição não identificada");
  const accountNumber = metadata.accountId?.trim() || null;

  return {
    institutionCode: rawCode,
    institutionName,
    identificationStatus: (registeredName || fallbackName) ? "identified" : rawCode ? "unrecognized" : "missing",
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
