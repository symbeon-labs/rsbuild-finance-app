/**
 * Persistence boundary for financial amounts.
 * The workspace works in major currency units (BRL); the database stores integer centavos.
 */
export function majorToMinor(amount: number): number {
  if (!Number.isFinite(amount)) throw new RangeError("Valor monetário inválido.");
  const minor = Math.round((amount + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(minor)) throw new RangeError("Valor excede a precisão segura em centavos.");
  return minor;
}

export function minorToMajor(amountMinor: number): number {
  if (!Number.isSafeInteger(amountMinor)) throw new RangeError("Centavos devem ser um inteiro seguro.");
  return amountMinor / 100;
}
