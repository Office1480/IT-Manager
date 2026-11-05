/**
 * Règles de congés — droit du travail israélien (paramétrable par organisation).
 *
 * Congés annuels (חוק חופשה שנתית, barème en vigueur depuis 2017) :
 * jours ouvrés selon l'ancienneté, pour une semaine de 5 jours ou de 6 jours.
 * Maladie (חוק דמי מחלה) : 1,5 jour / mois, cumul plafonné à 90 jours.
 * Paiement maladie : J1 0 %, J2–3 50 %, J4+ 100 %.
 */
const ANNUAL_5_DAYS = [12, 12, 12, 12, 12, 14, 15, 16, 17, 18, 19, 20];
const ANNUAL_6_DAYS = [14, 14, 14, 14, 14, 16, 18, 19, 20, 21, 22, 23, 24];

export function annualEntitlement(seniorityYear: number, workDaysPerWeek: number) {
  const table = workDaysPerWeek >= 6 ? ANNUAL_6_DAYS : ANNUAL_5_DAYS;
  return table[Math.min(Math.max(seniorityYear, 1), table.length) - 1];
}

export const SICK_ACCRUAL_PER_MONTH = 1.5;
export const SICK_MAX = 90;

export const sickPayRate = (dayIndex: number) => (dayIndex === 1 ? 0 : dayIndex <= 3 ? 0.5 : 1);

const iso = (d: Date) => d.toISOString().slice(0, 10);
export const utcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/**
 * Nombre de jours ouvrés décomptés entre deux dates incluses.
 * Exclut les jours non travaillés et les fêtes ; une veille de fête compte 0,5.
 */
export function countLeaveDays(
  start: Date,
  end: Date,
  opts: { workDays: number[]; holidays: { date: Date; kind: "HOLIDAY" | "EVE" }[]; startHalf?: boolean; endHalf?: boolean },
) {
  const hol = new Map(opts.holidays.map((h) => [iso(h.date), h.kind]));
  let total = 0;
  const d = utcDay(start);
  const last = utcDay(end);
  while (d <= last) {
    const working = opts.workDays.includes(d.getUTCDay());
    const kind = hol.get(iso(d));
    if (working && kind !== "HOLIDAY") {
      let v = kind === "EVE" ? 0.5 : 1;
      if (opts.startHalf && iso(d) === iso(start)) v = Math.min(v, 0.5);
      if (opts.endHalf && iso(d) === iso(end)) v = Math.min(v, 0.5);
      total += v;
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return total;
}

/** Mois complets travaillés entre deux dates. */
export function fullMonthsBetween(from: Date, to: Date) {
  let m = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) m -= 1;
  return Math.max(0, m);
}

/**
 * Congés annuels acquis depuis l'embauche : acquisition mensuelle au prorata
 * du barème de l'année d'ancienneté en cours et du temps de travail.
 */
export function accruedAnnual(start: Date, asOf: Date, workPercentage: number, workDaysPerWeek: number, overridePerMonth?: number | null) {
  const months = fullMonthsBetween(start, asOf);
  let total = 0;
  for (let m = 0; m < months; m++) {
    const year = Math.floor(m / 12) + 1;
    total += overridePerMonth ?? annualEntitlement(year, workDaysPerWeek) / 12;
  }
  return round1((total * workPercentage) / 100);
}

export function accruedSick(start: Date, asOf: Date, workPercentage: number) {
  return round1(Math.min(SICK_MAX, (fullMonthsBetween(start, asOf) * SICK_ACCRUAL_PER_MONTH * workPercentage) / 100));
}

export const round1 = (n: number) => Math.round(n * 10) / 10;
