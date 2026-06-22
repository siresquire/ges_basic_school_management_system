export function ghs(amount: number): string {
  return `GH₵ ${amount.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function fmtDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Long date with weekday for report cards, e.g. "Friday, June 12, 2026". */
export function fmtDateLong(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Today as a yyyy-mm-dd string (for date inputs). */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Parse a yyyy-mm-dd string to a Date at UTC midnight (how attendance dates are stored). */
export function dateFromISO(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

export function fullName(p: { firstName: string; lastName: string; otherNames?: string | null }) {
  return [p.firstName, p.otherNames, p.lastName].filter(Boolean).join(" ");
}

/** Surname-first format for students: LASTNAME FIRSTNAME OTHERNAME */
export function studentName(p: { firstName: string; lastName: string; otherNames?: string | null }) {
  return [p.lastName, p.firstName, p.otherNames].filter(Boolean).join(" ");
}
