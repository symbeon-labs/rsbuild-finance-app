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
 * Seed registry for common Brazilian COMPE/BACEN bank codes.
 * Unknown codes remain first-class identities and can be resolved later from
 * an institution registry without losing the source identifier.
 */
const BANK_REGISTRY: Record<string, string> = {
  "1": "Banco do Brasil",
  "4": "Banco do Nordeste",
  "33": "Santander",
  "77": "Banco Inter",
  "102": "XP Investimentos",
  "104": "Caixa Econômica Federal",
  "237": "Bradesco",
  "260": "Nubank",
  "336": "C6 Bank",
  "341": "Itaú Unibanco",
  "422": "Banco Safra"
};

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
  const institutionName = registeredName
    ?? (rawCode ? `Instituição não catalogada (código ${rawCode})` : "Instituição não identificada");
  const accountNumber = metadata.accountId?.trim() || null;

  return {
    institutionCode: rawCode,
    institutionName,
    identificationStatus: registeredName ? "identified" : rawCode ? "unrecognized" : "missing",
    accountNumber,
    branchId: metadata.branchId?.trim() || null,
    accountType: metadata.accountType?.trim().toUpperCase() || null,
    currency: "BRL",
    displayAccountName: accountNumber ? `${institutionName} · Conta ${accountNumber}` : institutionName
  };
}
