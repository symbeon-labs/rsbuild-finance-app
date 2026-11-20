import type { BankMetadata } from "@/lib/finance";

export type BankIdentity = {
  institutionCode: string | null;
  institutionName: string;
  identificationStatus: "identified" | "unrecognized" | "missing";
  accountNumber: string | null;
  branchId: string | null;
  accountType: string | null;
  currency: string;
  displayAccountName: string;
};

const BANK_REGISTRY: Record<string, string> = {
  "1": "Banco do Brasil", "4": "Banco do Nordeste", "33": "Santander",
  "77": "Banco Inter", "102": "XP Investimentos", "104": "Caixa Econômica Federal",
  "237": "Bradesco", "260": "Nubank", "336": "C6 Bank", "341": "Itaú Unibanco"
};

/** Resolve a bank without rejecting unknown identifiers or fabricating institution names. */
export function resolveBankIdentity(metadata: BankMetadata): BankIdentity {
  const rawCode = metadata.bankId?.trim() || null;
  const normalizedCode = rawCode?.replace(/^0+/, "") || null;
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
