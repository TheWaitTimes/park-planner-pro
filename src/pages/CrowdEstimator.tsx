import { useMemo, useState } from "react";
import { Users, Sun, Sunset, Moon, CalendarDays, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ESTIMATOR_PARKS, CROWD_HISTORY, estimateCrowd, rideRanges, type Period } from "@/lib/crowdEstimator";

const PERIODS: { id: Period; label: string; icon: typeof Sun }[] = [
  { id: "morning", label: "Morning", icon: Sun },
  { id: "afternoon", label: "Afternoon", icon: Sunset },
  { id: "evening", label: "Night", icon: Moon },
];

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function CrowdEstimator() {
  const [park, setPark] = useState(ESTIMATOR_PARKS[0]);
  const [date, setDate] = useState(todayISO());
  const [period, setPeriod] = useState<Period>("morning");

  const d = useMemo(() => {
    const [y, m, day] = date.split("-").map(Number);
    return new Date(y, (m || 1) - 1, day || 1);
  }, [date]);
  const est = useMemo(() => estimateCrowd(park, d), [park, d]);
  const ranges = useMemo(() => rideRanges(park, period, est.index), [park, period, est.index]);
  const h = CROWD_HISTORY[park];
  const pct = ((est.score - 1) / 9) * 100;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-foreground flex items-center gap-2">
          <Users className="w-7 h-7 text-primary" /> Crowd Estimator
        </h2>
        <p className="font-body text-muted-foreground mt-1">Pick your arrival date and park to see the expected crowd and wait ranges.</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 sm:p-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ce-date" className="font-body text-sm font-medium text-foreground">Arrival date</label>
          <Input id="ce-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="mt-1 min-h-[44px]" />
        </div>
        <div>
          <span className="font-body text-sm font-medium text-foreground">Park</span>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {ESTIMATOR_PARKS.map((p) => (
              <button key={p} type="button" onClick={() => setPark(p)}
                className={`min-h-[44px] rounded-lg border px-2 text-sm font-body transition-colors ${p === park ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-foreground hover:bg-muted"}`}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-body text-sm text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4" />
              {d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · {park}
            </p>
            <p className="font-display text-5xl font-bold text-foreground mt-2">{est.score}<span className="text-2xl text-muted-foreground">/10</span></p>
            <p className="font-display text-lg font-semibold text-primary">{est.label}</p>
          </div>
          <p className="font-body text-sm text-muted-foreground max-w-xs">
            Waits expected around <strong className="text-foreground">{Math.round(est.index * 100)}%</strong> of a typical recorded day.
            {est.holiday && <> Peak period: <strong className="text-foreground">{est.holiday}</strong>.</>}
          </p>
        </div>
        <div className="mt-4 h-3 rounded-full bg-muted overflow-hidden" aria-hidden>
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.max(6, pct)}%` }} />
        </div>
        {est.monthSource === "seasonal" && (
          <p className="mt-3 font-body text-xs text-muted-foreground flex items-start gap-1.5">
            <Info className="w-4 h-4 shrink-0" /> No recorded data for this month yet, so a typical seasonal pattern is used for the month.
          </p>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-display text-lg font-semibold text-foreground">Expected ride waits</h3>
          <div className="flex gap-2">
            {PERIODS.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => setPeriod(id)}
                className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border px-3 text-sm font-body ${id === period ? "bg-primary text-primary-foreground border-primary" : "border-border text-foreground hover:bg-muted"}`}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
        </div>
        {ranges.length === 0 ? (
          <p className="font-body text-sm text-muted-foreground">Not enough recorded waits for this time of day.</p>
        ) : (
          <ul className="divide-y divide-border">
            {ranges.map((r) => (
              <li key={r.name} className="py-2.5 flex items-center justify-between gap-3">
                <span className="font-body text-sm text-foreground min-w-0">{r.name}</span>
                <span className="font-body text-sm text-right shrink-0">
                  <strong className="text-foreground">{r.low}–{r.high} min</strong>
                  <span className="block text-xs text-muted-foreground">typical {r.typical}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <section className="font-body text-xs text-muted-foreground border-t border-border pt-4">
        Data source: The Wait Times historical posted standby waits (
        <a className="underline text-primary" href="https://github.com/TheWaitTimes/park_data" target="_blank" rel="noreferrer">park_data on GitHub</a>
        ), {h?.days ?? 0} recorded days for {park} between {h?.from} and {h?.to}, collected from{" "}
        <a className="underline text-primary" href="https://www.themeparks.wiki/" target="_blank" rel="noreferrer">themeparks.wiki</a>.
        Estimates combine month, day-of-week and holiday patterns — always check the official app on the day.
      </section>
    </div>
  );
}
