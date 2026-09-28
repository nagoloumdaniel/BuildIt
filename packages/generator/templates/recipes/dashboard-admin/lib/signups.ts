const DAY = 24 * 60 * 60 * 1000;

export interface DailyCount {
  /** Jour UTC, au format AAAA-MM-JJ. */
  readonly date: string;
  readonly count: number;
}

function isoDay(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

/**
 * Inscriptions par jour sur les `days` derniers jours, jours vides compris :
 * un graphique qui saute les jours sans inscription ment sur le rythme.
 */
export function signupsByDay(dates: readonly Date[], now: Date, days = 30): DailyCount[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const counts = new Map<string, number>();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    counts.set(isoDay(today - offset * DAY), 0);
  }
  for (const date of dates) {
    const key = isoDay(date.getTime());
    const count = counts.get(key);
    if (count !== undefined) {
      counts.set(key, count + 1);
    }
  }
  return [...counts].map(([date, count]) => ({ date, count }));
}
