import { useEffect, useMemo, useState } from "react";
import {
  RefreshCw, Ticket, Zap, Clock, Castle, Globe, Clapperboard, Trees, Database,
  type LucideIcon,
} from "lucide-react";
import { cachedFetch, readCacheMeta, TTL_30_MIN } from "@/lib/liveCache";

const PARK_OPTIONS: { id: string; name: string; icon: LucideIcon }[] = [
  { id: "75ea578a-adc8-4116-a54d-dccb60765ef9", name: "Magic Kingdom", icon: Castle },
  { id: "47f90d2c-e191-4239-a466-5892ef59a88b", name: "EPCOT", icon: Globe },
  { id: "288747d1-8b4f-4a64-867e-ea7c9b27bad8", name: "Hollywood Studios", icon: Clapperboard },
  { id: "1c84a229-8862-4648-9c71-378ddd2c7693", name: "Animal Kingdom", icon: Trees },
];

type LLKind = "multi" | "single";

function usd(n: number) {
  return `$${n.toFixed(2).replace(/\.00$/, "")}`;
}


interface LaneRow {
  name: string;
  park: string;
  kind: LLKind;
  state: string;
  returnStart: string | null;
  returnEnd: string | null;
  // Only prices reported by the live feed are shown; no estimates.
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
            const amount =
              typeof lane.price?.amount === "number" ? lane.price.amount / 100 : null;
            const formatted: string | null =
              lane.price?.formatted ?? (amount != null ? usd(amount) : null);
            rows.push({
              name: entity.name,
              park: name,
              kind,
              state: lane.state ?? "UNKNOWN",
              returnStart: lane.returnStart ?? null,
              returnEnd: lane.returnEnd ?? null,
              price: formatted,
              priceAmount: amount,
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

export default function LightningLanes() {
  const [lanes, setLanes] = useState<LaneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [park, setPark] = useState("Magic Kingdom");

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

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
            Lightning Lanes
          </h1>
          <p className="font-body text-sm sm:text-base text-muted-foreground mt-2">
            Live return windows across Walt Disney World.
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 min-h-[44px]"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Park selector */}
      <section>
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

      {error && <div className="text-sm text-destructive">{error}</div>}

      {/* Lane list */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">
            {park} Lightning Lanes
          </h2>
          {updated && (
            <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              {updated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · refreshes 30 min
            </span>
          )}
        </div>

        {loading && !lanes.length ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : !parkLanes.length ? (
          <div className="text-sm text-muted-foreground">
            No Lightning Lane return windows reported for {park} right now.
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card divide-y divide-border">
            {parkLanes.map((l) => (
              <div key={`${l.name}|${l.kind}`} className="p-3 sm:p-4 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground text-sm sm:text-base leading-snug">
                    {l.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="inline-flex items-center gap-1">
                      {l.kind === "single" ? (
                        <>
                          <Ticket className="w-3.5 h-3.5" /> Single Pass
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5" /> Multi Pass
                        </>
                      )}
                      {l.price ? ` · ${l.price}` : ""}
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
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Data Sources */}
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-5 h-5 text-secondary" />
          <h2 className="font-display text-base font-semibold text-foreground">Data Sources</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Lightning Lane return windows, prices, and standby waits:</span>{" "}
          <a
            href="https://www.themeparks.wiki/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            themeparks.wiki
          </a>
          . Data refreshes automatically every 30 minutes. Availability and pricing change throughout the day — confirm in the official app before purchasing.
        </p>
      </section>
    </div>
  );
}
