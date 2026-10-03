import { useMemo, useState } from "react";
import { Lock, LockOpen, Ban, Sparkles, Clock, RotateCcw, Sun, Sunset, Moon } from "lucide-react";
import { PARKS, type Ride } from "@/data/parks";

type Period = "morning" | "afternoon" | "evening";
const PERIODS: { id: Period; label: string; icon: typeof Sun }[] = [
  { id: "morning", label: "Morning", icon: Sun },
  { id: "afternoon", label: "Afternoon", icon: Sunset },
  { id: "evening", label: "Night", icon: Moon },
];
const WALK_MIN = 10; // average walk between attractions
const MAX_LOCKS = 3;

const avgWait = (r: Ride, p: Period) => Math.round((r.waitTimes[p][0] + r.waitTimes[p][1]) / 2);
const cost = (r: Ride, p: Period) => avgWait(r, p) + r.onRideTime + WALK_MIN;

interface Result {
  rides: Ride[];
  used: number;
  feasible: boolean;
}

/** 0/1 knapsack: maximize number of rides, then time used, within the remaining budget. */
function solve(pool: Ride[], locked: Ride[], budget: number, p: Period): Result {
  const lockedCost = locked.reduce((s, r) => s + cost(r, p), 0);
  if (lockedCost > budget) return { rides: locked, used: lockedCost, feasible: false };
  const cap = budget - lockedCost;
  type Cell = { count: number; used: number; picks: number[] };
  let dp: Cell[] = Array.from({ length: cap + 1 }, () => ({ count: 0, used: 0, picks: [] }));
  pool.forEach((r, i) => {
    const c = cost(r, p);
    const next = dp.map((x) => x);
    for (let t = c; t <= cap; t++) {
      const prev = dp[t - c];
      const cand = { count: prev.count + 1, used: prev.used + c, picks: [...prev.picks, i] };
      const cur = next[t];
      if (cand.count > cur.count || (cand.count === cur.count && cand.used > cur.used)) next[t] = cand;
    }
    dp = next;
  });
  const best = dp[cap];
  const fill = best.picks.map((i) => pool[i]);
  return { rides: [...locked, ...fill], used: lockedCost + best.used, feasible: true };
}

export default function RideOptimizer() {
  const parks = Object.keys(PARKS);
  const [park, setPark] = useState(parks[0]);
  const [period, setPeriod] = useState<Period>("morning");
  const [hours, setHours] = useState(3);
  const [locked, setLocked] = useState<string[]>([]);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);

  const rides = useMemo(
    () => [...PARKS[park].rides].sort((a, b) => avgWait(b, period) - avgWait(a, period)),
    [park, period],
  );
  const budget = Math.round(hours * 60);
  const lockedRides = rides.filter((r) => locked.includes(r.id));
  const lockedCost = lockedRides.reduce((s, r) => s + cost(r, period), 0);

  const reset = (fn: () => void) => {
    fn();
    setResult(null);
  };
  const changePark = (p: string) => reset(() => { setPark(p); setLocked([]); setExcluded([]); });
  const toggleLock = (id: string) =>
    reset(() => {
      setExcluded((e) => e.filter((x) => x !== id));
      setLocked((l) => (l.includes(id) ? l.filter((x) => x !== id) : l.length >= MAX_LOCKS ? l : [...l, id]));
    });
  const toggleExclude = (id: string) =>
    reset(() => {
      setLocked((l) => l.filter((x) => x !== id));
      setExcluded((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));
    });

  const run = () => {
    const pool = rides.filter((r) => !locked.includes(r.id) && !excluded.includes(r.id));
    const res = solve(pool, lockedRides, budget, period);
    // order by lowest wait first for the suggested sequence, locks kept on top
    setResult(res);
  };

  const periodLabel = PERIODS.find((x) => x.id === period)!.label;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-foreground">Ride Optimizer</h2>
        <p className="font-body text-muted-foreground mt-1 max-w-2xl">
          Pick a park and time of day, lock up to {MAX_LOCKS} must-do rides, set your time budget, and the optimizer
          fills the rest with the lineup that gets you the most rides in that window.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 bg-card border border-border rounded-lg p-4 sm:p-5">
        <div>
          <label className="font-body text-xs uppercase tracking-wide text-muted-foreground">Park</label>
          <select
            value={park}
            onChange={(e) => changePark(e.target.value)}
            className="mt-1 w-full min-h-[44px] rounded-md border border-input bg-background px-3 font-body"
          >
            {parks.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <span className="font-body text-xs uppercase tracking-wide text-muted-foreground">Time of day</span>
          <div className="mt-1 grid grid-cols-3 gap-1 rounded-md border border-input p-1">
            {PERIODS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => reset(() => setPeriod(id))}
                className={`min-h-[40px] rounded font-body text-sm inline-flex items-center justify-center gap-1.5 transition-colors ${
                  period === id ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="font-body text-xs uppercase tracking-wide text-muted-foreground">
            Time in park: <span className="text-foreground font-semibold">{hours} hr</span>
          </label>
          <input
            type="range" min={1} max={6} step={0.5} value={hours}
            onChange={(e) => reset(() => setHours(Number(e.target.value)))}
            className="mt-3 w-full accent-[hsl(var(--primary))]"
          />
          <div className="flex justify-between text-xs text-muted-foreground font-body"><span>1 hr</span><span>6 hr</span></div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 font-body text-sm">
        <span className="inline-flex items-center gap-1.5"><Lock className="w-4 h-4 text-primary" /> Locked {locked.length}/{MAX_LOCKS}</span>
        <span className={lockedCost > budget ? "text-destructive" : "text-muted-foreground"}>
          Locked rides use {lockedCost} of {budget} min
        </span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => reset(() => { setLocked([]); setExcluded([]); })}
            className="min-h-[44px] px-4 rounded-md border border-border inline-flex items-center gap-2 hover:bg-muted"
          >
            <RotateCcw className="w-4 h-4" /> Clear
          </button>
          <button
            onClick={run}
            className="min-h-[44px] px-5 rounded-md bg-primary text-primary-foreground font-semibold inline-flex items-center gap-2 hover:opacity-90"
          >
            <Sparkles className="w-4 h-4" /> Optimize
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Player pool */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2 bg-muted text-xs uppercase tracking-wide text-muted-foreground font-body">
            <span>Ride</span><span className="w-14 text-right">{periodLabel} wait</span><span className="w-12 text-right">Cost</span><span className="w-[88px] text-right">Action</span>
          </div>
          <ul className="divide-y divide-border">
            {rides.map((r) => {
              const isLocked = locked.includes(r.id);
              const isEx = excluded.includes(r.id);
              const inLineup = result?.rides.some((x) => x.id === r.id);
              return (
                <li
                  key={r.id}
                  className={`grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-4 py-2.5 font-body ${
                    isLocked ? "bg-primary/5" : isEx ? "opacity-50" : inLineup ? "bg-secondary/10" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className={`font-medium text-foreground truncate ${isEx ? "line-through" : ""}`}>{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.parkArea} · {r.onRideTime} min ride</div>
                  </div>
                  <span className="w-14 text-right font-semibold tabular-nums">{avgWait(r, period)}m</span>
                  <span className="w-12 text-right text-muted-foreground tabular-nums">{cost(r, period)}m</span>
                  <div className="w-[88px] flex justify-end gap-1">
                    <button
                      onClick={() => toggleLock(r.id)}
                      disabled={!isLocked && locked.length >= MAX_LOCKS}
                      aria-label={isLocked ? `Unlock ${r.name}` : `Lock ${r.name}`}
                      className={`w-10 h-10 rounded-md border inline-flex items-center justify-center disabled:opacity-30 ${
                        isLocked ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                      }`}
                    >
                      {isLocked ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => toggleExclude(r.id)}
                      aria-label={isEx ? `Include ${r.name}` : `Exclude ${r.name}`}
                      className={`w-10 h-10 rounded-md border inline-flex items-center justify-center ${
                        isEx ? "bg-destructive text-destructive-foreground border-destructive" : "border-border hover:bg-muted"
                      }`}
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Lineup */}
        <div className="bg-card border border-border rounded-lg p-4 sm:p-5 h-fit lg:sticky lg:top-40">
          <h3 className="font-display text-lg font-semibold">Optimal lineup</h3>
          {!result ? (
            <p className="font-body text-sm text-muted-foreground mt-2">Press Optimize to build your lineup.</p>
          ) : !result.feasible ? (
            <p className="font-body text-sm text-destructive mt-2">
              Your locked rides need {result.used} min, more than your {budget} min budget. Unlock a ride or add time.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center font-body">
                <div className="rounded-md bg-muted p-2"><div className="text-xl font-semibold">{result.rides.length}</div><div className="text-[11px] text-muted-foreground">Rides</div></div>
                <div className="rounded-md bg-muted p-2"><div className="text-xl font-semibold">{result.used}</div><div className="text-[11px] text-muted-foreground">Min used</div></div>
                <div className="rounded-md bg-muted p-2"><div className="text-xl font-semibold">{budget - result.used}</div><div className="text-[11px] text-muted-foreground">Min left</div></div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, (result.used / budget) * 100)}%` }} />
              </div>
              <ol className="mt-4 space-y-2">
                {result.rides.map((r, i) => (
                  <li key={r.id} className="flex items-center gap-3 font-body text-sm">
                    <span className="w-6 h-6 rounded-full bg-muted text-xs inline-flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="flex-1 min-w-0 truncate">{r.name}</span>
                    {locked.includes(r.id) && <Lock className="w-3.5 h-3.5 text-primary shrink-0" />}
                    <span className="text-muted-foreground tabular-nums inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{cost(r, period)}m</span>
                  </li>
                ))}
              </ol>
              {result.rides.length === 0 && (
                <p className="font-body text-sm text-muted-foreground mt-2">No rides fit in this time budget.</p>
              )}
            </>
          )}
          <p className="font-body text-xs text-muted-foreground mt-4">
            Cost = average modeled wait + ride length + {WALK_MIN} min walking. The optimizer maximizes ride count, then uses as much of your time as possible.
          </p>
        </div>
      </div>
    </div>
  );
}
