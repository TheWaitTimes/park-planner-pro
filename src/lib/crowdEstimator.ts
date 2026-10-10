import history from "@/data/crowdHistory.json";
import { capWait } from "@/lib/parkModel";

export type Period = "morning" | "afternoon" | "evening";
type RideStats = Partial<Record<Period, [number, number, number]>> & { avg: number };
interface ParkHistory {
  days: number;
  from: string;
  to: string;
  dow: Record<string, number>;
  month: Record<string, number>;
  rides: Record<string, RideStats>;
}
export const CROWD_HISTORY = history as unknown as Record<string, ParkHistory>;
export const ESTIMATOR_PARKS = Object.keys(CROWD_HISTORY);

/** Seasonal fallback for months the recorded history doesn't cover yet (1.0 = typical day). */
export const SEASONAL_FALLBACK: Record<number, number> = {
  1: 0.9, 2: 0.95, 3: 1.15, 4: 1.1, 5: 1.0, 6: 1.05, 7: 1.05, 8: 0.85, 9: 0.75, 10: 0.9, 11: 1.0, 12: 1.15,
};

/** Known peak periods that push crowds above the normal month/day pattern. */
export function holidayFactor(d: Date): { factor: number; label?: string } {
  const m = d.getMonth() + 1, day = d.getDate();
  if ((m === 12 && day >= 24) || (m === 1 && day <= 1)) return { factor: 1.3, label: "Christmas / New Year's week" };
  if (m === 7 && day >= 3 && day <= 5) return { factor: 1.15, label: "Fourth of July" };
  if (m === 11) {
    const first = new Date(d.getFullYear(), 10, 1).getDay();
    const thanksgiving = 1 + ((4 - first + 7) % 7) + 21;
    if (day >= thanksgiving - 3 && day <= thanksgiving + 2) return { factor: 1.2, label: "Thanksgiving week" };
  }
  if ((m === 3 && day >= 10) || (m === 4 && day <= 15)) return { factor: 1.1, label: "Spring break season" };
  return { factor: 1 };
}

export interface CrowdEstimate {
  index: number; // 1.0 = typical recorded day
  score: number; // 1-10
  label: "Light" | "Moderate" | "Busy" | "Very busy";
  monthSource: "history" | "seasonal";
  holiday?: string;
}

/** Turn a relative crowd index into a 1-10 score: 0.6× or less = 1, 1.4× or more = 10. */
export function scoreFromIndex(index: number): number {
  return Math.min(10, Math.max(1, Math.round(1 + ((index - 0.6) / 0.8) * 9)));
}

export function labelForScore(score: number): CrowdEstimate["label"] {
  if (score <= 3) return "Light";
  if (score <= 6) return "Moderate";
  if (score <= 8) return "Busy";
  return "Very busy";
}

export function estimateCrowd(park: string, date: Date): CrowdEstimate {
  const h = CROWD_HISTORY[park];
  const m = date.getMonth() + 1;
  const dowJs = date.getDay(); // 0 = Sunday
  const dowPy = (dowJs + 6) % 7; // history uses 0 = Monday
  const observed = h?.month[String(m)];
  const monthF = observed ?? SEASONAL_FALLBACK[m];
  const dowF = h?.dow[String(dowPy)] ?? 1;
  const hol = holidayFactor(date);
  const index = monthF * dowF * hol.factor;
  const score = scoreFromIndex(index);
  return { index, score, label: labelForScore(score), monthSource: observed ? "history" : "seasonal", holiday: hol.label };
}

export interface RideRange { name: string; low: number; typical: number; high: number }

export function rideRanges(park: string, period: Period, index: number): RideRange[] {
  const rides = CROWD_HISTORY[park]?.rides ?? {};
  return Object.entries(rides)
    .filter(([, s]) => s[period])
    .map(([name, s]) => {
      const [lo, med, hi] = s[period]!;
      return { name, low: capWait(lo * index), typical: capWait(med * index), high: capWait(hi * index) };
    })
    .sort((a, b) => b.typical - a.typical);
}
