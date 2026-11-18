const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

/**
 * Formata datas de calendário sem convertê-las para UTC.
 * Timestamps são exibidos no fuso operacional de São Paulo.
 */
export function formatDatePtBr(value: string | null | undefined): string {
  if (!value) return "—";

  const dateOnly = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (
      parsed.getUTCFullYear() !== Number(year) ||
      parsed.getUTCMonth() !== Number(month) - 1 ||
      parsed.getUTCDate() !== Number(day)
    ) return value;
    return `${day}/${month}/${year}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: SAO_PAULO_TIME_ZONE,
  }).format(date);
}

export function formatDateTimePtBr(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: SAO_PAULO_TIME_ZONE,
  }).format(date);
}

/** Data atual no fuso operacional, em ISO para nomes de arquivos e integrações. */
export function todayIsoDateSaoPaulo(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: SAO_PAULO_TIME_ZONE,
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
