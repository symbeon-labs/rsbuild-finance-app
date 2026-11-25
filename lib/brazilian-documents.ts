const CPF_LENGTH = 11;
const CNPJ_LENGTH = 14;

function digitsOrCnpjLetters(value: string): string {
  return value.toUpperCase().replace(/[.\-/\s]/g, "");
}

function calculateDigit(base: string, weights: number[]): number {
  const sum = [...base].reduce((total, char, index) => {
    const value = char >= "0" && char <= "9" ? char.charCodeAt(0) - 48 : char.charCodeAt(0) - 48;
    return total + value * weights[index];
  }, 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function normalizeDocument(value: string): string {
  return digitsOrCnpjLetters(value).replace(/[^0-9A-Z]/g, "");
}

export function isValidCpf(value: string): boolean {
  const cpf = normalizeDocument(value);
  if (!/^\d{11}$/.test(cpf) || /^([0-9])\1{10}$/.test(cpf)) return false;
  const first = calculateDigit(cpf.slice(0, 9), [10,9,8,7,6,5,4,3,2]);
  const second = calculateDigit(cpf.slice(0, 9) + first, [11,10,9,8,7,6,5,4,3,2]);
  return cpf.endsWith(`${first}${second}`);
}

export function isValidCnpj(value: string): boolean {
  const cnpj = normalizeDocument(value);
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj) || /^([0-9A-Z])\1{13}$/.test(cnpj)) return false;
  const first = calculateDigit(cnpj.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2]);
  const second = calculateDigit(cnpj.slice(0, 12) + first, [6,5,4,3,2,9,8,7,6,5,4,3,2]);
  return cnpj.endsWith(`${first}${second}`);
}

export function isValidBrazilianDocument(value: string): boolean {
  const normalized = normalizeDocument(value);
  return normalized.length === CPF_LENGTH
    ? isValidCpf(normalized)
    : normalized.length === CNPJ_LENGTH && isValidCnpj(normalized);
}

export function formatDocument(value: string): string {
  const normalized = normalizeDocument(value);
  if (/^\d{11}$/.test(normalized)) return normalized.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (/^[0-9A-Z]{12}[0-9]{2}$/.test(normalized)) return normalized.replace(/(\w{2})(\w{3})(\w{3})(\w{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return value;
}
