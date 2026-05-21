export function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function normalizeCpf(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length === 11 ? digits : "";
}

export function normalizePhone(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

export function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function parseExcelDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpoch + value * 24 * 60 * 60 * 1000);
    return date.toISOString().slice(0, 10);
  }

  const text = String(value ?? "").trim();

  if (!text) {
    return null;
  }

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const brMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);

  if (brMatch) {
    const day = brMatch[1].padStart(2, "0");
    const month = brMatch[2].padStart(2, "0");
    const year =
      brMatch[3].length === 2 ? `20${brMatch[3]}` : brMatch[3].padStart(4, "0");

    return `${year}-${month}-${day}`;
  }

  return null;
}

const weekdayAliases: Record<string, string> = {
  SEG: "segunda",
  SEGUNDA: "segunda",
  TER: "terca",
  TERCA: "terca",
  TERÇA: "terca",
  QUA: "quarta",
  QUARTA: "quarta",
  QUI: "quinta",
  QUINTA: "quinta",
  SEX: "sexta",
  SEXTA: "sexta",
  SAB: "sabado",
  SABADO: "sabado",
  SÁBADO: "sabado",
  DOM: "domingo",
  DOMINGO: "domingo",
};

export function normalizeClassSchedule(value: unknown): {
  weekdays: string[];
  startTime: string | null;
  normalized: string;
} {
  const normalized = normalizeText(value)
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replace(/\s*-\s*/g, " - ");
  const weekdays = Array.from(
    new Set(
      normalized
        .split(/[\s/-]+/)
        .map((part) => weekdayAliases[part])
        .filter(Boolean),
    ),
  );
  const timeMatch = normalized.match(/(\d{1,2})\s*H\s*(\d{2})?/);
  const startTime = timeMatch
    ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2] ?? "00"}`
    : null;

  return {
    weekdays,
    startTime,
    normalized,
  };
}
