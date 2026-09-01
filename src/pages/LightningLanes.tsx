import { useEffect, useMemo, useState } from "react";
import {
  RefreshCw, Ticket, Zap, Clock, Castle, Globe, Clapperboard, Trees,
  Plus, Check, X, AlertTriangle, type LucideIcon,
} from "lucide-react";
import { cachedFetch, readCacheMeta, TTL_30_MIN } from "@/lib/liveCache";

const PARK_OPTIONS: { id: string; name: string; icon: LucideIcon }[] = [
  { id: "75ea578a-adc8-4116-a54d-dccb60765ef9", name: "Magic Kingdom", icon: Castle },
  { id: "47f90d2c-e191-4239-a466-5892ef59a88b", name: "EPCOT", icon: Globe },
  { id: "288747d1-8b4f-4a64-867e-ea7c9b27bad8", name: "Hollywood Studios", icon: Clapperboard },
  { id: "1c84a229-8862-4648-9c71-378ddd2c7693", name: "Animal Kingdom", icon: Trees },
];

const MAX_PLAN_LANES = 3;

type LLKind = "multi" | "single";

interface LaneRow {
  name: string;
  park: string;
  kind: LLKind;
  state: string;
  returnStart: string | null;
  returnEnd: string | null;
  price: string | null;
  priceAmount: number | null;
  standby: number | null;
}

function fmtTime(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

function formatHourToEST(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:00 ${period}`;
}

/** Hour-of-day (park local time) for a return window timestamp. */
function parkHour(iso: string | null): number | null {
  if (!iso) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date(iso));
  const h = parts.find((p) => p.type === "hour")?.value;
  return h ? Number(h) % 24 : null;
}

async function fetchLanes(): Promise<LaneRow[]> {
  const results = await Promise.all(
    PARK_OPTIONS.map(async ({ id, name }) => {
      try {
        const res = await fetch(`https://api.themeparks.wiki/v1/entity/${id}/live`);
        const json = await res.json();
        const rows: LaneRow[] = [];
        for (const entity of json.liveData ?? []) {
          if (entity.entityType !== "ATTRACTION") continue;
          const q = entity.queue ?? {};
          const standby = q.STANDBY?.waitTime ?? null;
          for (const [key, kind] of [
            ["RETURN_TIME", "multi"],
            ["PAID_RETURN_TIME", "single"],
          ] as [string, LLKind][]) {
            const lane = q[key];
            if (!lane) continue;
            rows.push({
              name: entity.name,
              park: name,
              kind,
              state: lane.state ?? "UNKNOWN",
              returnStart: lane.returnStart ?? null,
              returnEnd: lane.returnEnd ?? null,
              price: lane.price?.formatted ?? null,
              priceAmount: lane.price?.amount ?? null,
              standby,
            });
          }
        }
        return rows;
      } catch {
        return [];
      }
    }),
  );
  return results.flat();
}

const STATE_LABEL: Record<string, string> = {
  AVAILABLE: "Available",
  FINISHED: "Distribution finished",
  TEMPORARILY_FULL: "Temporarily unavailable",
  PAUSED: "Paused",
};

function laneKey(l: LaneRow) {
  return `${l.park}|${l.name}|${l.kind}`;
}

export default function LightningLanes() {
  const [lanes, setLanes] = useState<LaneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [park, setPark] = useState("Magic Kingdom");
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(21);
  const [plan, setPlan] = useState<string[]>([]);

  const timeInvalid = endHour <= startHour;

  const load = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const rows = await cachedFetch("wdw:lanes", TTL_30_MIN, fetchLanes, force);
      setLanes(rows);
      const meta = readCacheMeta("wdw:lanes");
      setUpdated(meta ? new Date(meta.at) : new Date());
    } catch {
      setError("Unable to load Lightning Lane data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(() => load(), 30 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Clear plan picks that belong to another park.
  useEffect(() => {
    setPlan((prev) => prev.filter((k) => k.startsWith(`${park}|`)));
  }, [park]);

  const parkLanes = useMemo(
    () =>
      lanes
        .filter((l) => l.park === park)
        .sort((a, b) => {
          if (a.state !== b.state) return a.state === "AVAILABLE" ? -1 : 1;
          if (a.kind !== b.kind) return a.kind === "single" ? -1 : 1;
          return a.name.localeCompare(b.name);
        }),
    [lanes, park],
  );

  const inWindow = (l: LaneRow) => {
    const h = parkHour(l.returnStart);
    if (h == null) return true;
    return h >= startHour && h < endHour;
  };

  const visible = parkLanes.filter((l) => l.state !== "AVAILABLE" || inWindow(l));
  const availableInWindow = parkLanes.filter((l) => l.state === "AVAILABLE" && inWindow(l));

  const planLanes = plan
    .map((k) => lanes.find((l) => laneKey(l) === k))
    .filter((l): l is LaneRow => Boolean(l))
    .sort((a, b) => (a.returnStart ?? "").localeCompare(b.returnStart ?? ""));

  const planCost = planLanes.reduce((sum, l) => sum + (l.priceAmount ?? 0), 0);
  const overlap = planLanes.some((l, i) => {
    const next = planLanes[i + 1];
    return next && l.returnEnd && next.returnStart && next.returnStart < l.returnEnd;
  });

  const toggle = (l: LaneRow) => {
    const key = laneKey(l);
    setPlan((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : prev.length >= MAX_PLAN_LANES
          ? prev
          : [...prev, key],
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
          Lightning Lanes
        </h1>
        <p className="font-body text-sm sm:text-base text-muted-foreground mt-2">
          Live return windows, filtered to the hours you'll be in the park.
        </p>
      </div>

      {/* Park tiles */}
      <section>
        <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3">Select Your Park</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {PARK_OPTIONS.map((p) => {
            const Icon = p.icon;
            const isActive = park === p.name;
            return (
              <button
                key={p.name}
                onClick={() => setPark(p.name)}
                aria-pressed={isActive}
                className={`text-center p-4 sm:p-5 min-h-[88px] rounded-lg border transition-all ${
                  isActive
                    ? "border-secondary bg-secondary/5 shadow-sm"
                    : "border-border bg-card hover:border-secondary/40"
                }`}
              >
                <Icon
                  className={`w-6 h-6 sm:w-7 sm:h-7 mx-auto mb-2 ${isActive ? "text-secondary" : "text-muted-foreground"}`}
                  strokeWidth={1.75}
                />
                <div className="font-body text-xs sm:text-sm font-medium text-foreground leading-tight">
                  {p.name}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Time window */}
      <section className="bg-card rounded-lg border border-border p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">Your Park Window</h2>
          <button
            onClick={() => load(true)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 min-h-[44px]"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        <label className="block mb-4">
          <span className="text-sm font-body font-semibold text-foreground">
            Arrive: {formatHourToEST(startHour)}
          </span>
          <input
            type="range"
            min="7"
            max="22"
            value={startHour}
            onChange={(e) => setStartHour(Number(e.target.value))}
            className="w-full mt-2 h-6 accent-secondary"
            aria-label="Arrival hour"
          />
        </label>
        <label className="block">
          <span className="text-sm font-body font-semibold text-foreground">
            Leave: {formatHourToEST(endHour)}
          </span>
          <input
            type="range"
            min="10"
            max="23"
            value={endHour}
            onChange={(e) => setEndHour(Number(e.target.value))}
            className="w-full mt-2 h-6 accent-secondary"
            aria-label="Departure hour"
          />
        </label>

        {timeInvalid && (
          <p className="text-xs font-body text-destructive mt-2">Leave time must be after arrival.</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-secondary" /> {availableInWindow.length} lanes in your window
          </span>
          {updated && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {updated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · refreshes 30 min
            </span>
          )}
        </div>
      </section>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {/* Plan builder */}
      <section className="bg-card rounded-lg border border-border p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">
            Your Lane Plan{" "}
            <span className="text-muted-foreground font-normal">
              ({planLanes.length}/{MAX_PLAN_LANES})
            </span>
          </h2>
          {planLanes.length > 0 && (
            <button
              onClick={() => setPlan([])}
              className="text-sm text-muted-foreground hover:text-foreground min-h-[44px]"
            >
              Clear
            </button>
          )}
        </div>

        {planLanes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add up to {MAX_PLAN_LANES} lanes below to build a return-time order for your day.
          </p>
        ) : (
          <>
            <ol className="space-y-2">
              {planLanes.map((l, i) => (
                <li
                  key={laneKey(l)}
                  className="flex items-center gap-3 rounded-md border border-secondary/30 bg-secondary/5 p-3"
                >
                  <span className="font-display text-lg text-secondary w-5 shrink-0">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground text-sm truncate">{l.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {l.state === "AVAILABLE" && l.returnStart
                        ? `${fmtTime(l.returnStart)}${l.returnEnd ? ` – ${fmtTime(l.returnEnd)}` : ""}`
                        : STATE_LABEL[l.state] ?? l.state}
                      {l.price ? ` · ${l.price}` : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => toggle(l)}
                    aria-label={`Remove ${l.name} from plan`}
                    className="text-muted-foreground hover:text-destructive min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {planCost > 0 && (
                <span className="text-foreground font-medium">
                  Est. cost ${(planCost / 100).toFixed(2)} per guest
                </span>
              )}
              <span>
                Saves ~{planLanes.reduce((s, l) => s + (l.standby ?? 0), 0)} min of standby waiting
              </span>
            </div>
            {overlap && (
              <p className="mt-3 flex items-start gap-2 text-xs text-amber-700">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
                Two of these return windows overlap — you may not make both.
              </p>
            )}
          </>
        )}
      </section>

      {/* Lane list */}
      <section>
        <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3">
          {park} Lightning Lanes
        </h2>
        {loading && !lanes.length ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : !visible.length ? (
          <div className="text-sm text-muted-foreground">
            No Lightning Lane return windows reported for {park} right now.
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card divide-y divide-border">
            {visible.map((l) => {
              const key = laneKey(l);
              const picked = plan.includes(key);
              const canAdd = l.state === "AVAILABLE" && (picked || plan.length < MAX_PLAN_LANES);
              return (
                <div key={key} className="p-3 sm:p-4 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground text-sm sm:text-base leading-snug">
                      {l.name}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="inline-flex items-center gap-1">
                        {l.kind === "single" ? (
                          <>
                            <Ticket className="w-3.5 h-3.5" /> Single Pass
                            {l.price ? ` · ${l.price}` : ""}
                          </>
                        ) : (
                          <>
                            <Zap className="w-3.5 h-3.5" /> Multi Pass
                          </>
                        )}
                      </span>
                      {l.standby != null && <span>Standby {l.standby}m</span>}
                    </div>
                    <div
                      className={`text-xs sm:text-sm font-display font-semibold mt-1 ${
                        l.state === "AVAILABLE" ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {l.state === "AVAILABLE" && (l.returnStart || l.returnEnd)
                        ? `${fmtTime(l.returnStart) ?? "—"}${l.returnEnd ? ` – ${fmtTime(l.returnEnd)}` : ""}`
                        : STATE_LABEL[l.state] ?? l.state}
                    </div>
                  </div>
                  <button
                    onClick={() => toggle(l)}
                    disabled={!canAdd}
                    aria-label={picked ? `Remove ${l.name} from plan` : `Add ${l.name} to plan`}
                    className={`shrink-0 min-h-[44px] min-w-[44px] rounded-md border inline-flex items-center justify-center transition ${
                      picked
                        ? "border-secondary bg-secondary text-secondary-foreground"
                        : "border-border text-muted-foreground hover:border-secondary/50 disabled:opacity-40"
                    }`}
                  >
                    {picked ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Return windows come from the same live feed as wait times and park hours. Availability and pricing
        change throughout the day — confirm in the official app before purchasing.
      </p>
    </div>
  );
}
