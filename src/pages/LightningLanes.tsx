import { useEffect, useState } from "react";
import { RefreshCw, Ticket, Zap, Clock } from "lucide-react";
import { cachedFetch, readCacheMeta, TTL_30_MIN } from "@/lib/liveCache";

const PARK_IDS: { id: string; name: string }[] = [
  { id: "75ea578a-adc8-4116-a54d-dccb60765ef9", name: "Magic Kingdom" },
  { id: "47f90d2c-e191-4239-a466-5892ef59a88b", name: "EPCOT" },
  { id: "288747d1-8b4f-4a64-867e-ea7c9b27bad8", name: "Hollywood Studios" },
  { id: "1c84a229-8862-4648-9c71-378ddd2c7693", name: "Animal Kingdom" },
];

type LLKind = "multi" | "single";

interface LaneRow {
  name: string;
  park: string;
  kind: LLKind;
  state: string;
  returnStart: string | null;
  returnEnd: string | null;
  price: string | null;
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
    PARK_IDS.map(async ({ id, name }) => {
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

  const availableCount = lanes.filter((l) => l.state === "AVAILABLE").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-semibold text-foreground">
            Lightning Lanes
          </h1>
          <p className="font-body text-muted-foreground mt-2">
            Live Lightning Lane return windows across the Walt Disney World parks.
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 min-h-[44px]"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-secondary" /> {availableCount} lanes currently available
        </span>
        {updated && (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-4 h-4" /> Updated{" "}
            {updated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · auto-refresh 30 min
          </span>
        )}
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {loading && !lanes.length ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !lanes.length ? (
        <div className="text-sm text-muted-foreground">
          No Lightning Lane data is being reported right now.
        </div>
      ) : (
        <div className="space-y-8">
          {PARK_IDS.map(({ name }) => {
            const rows = lanes
              .filter((l) => l.park === name)
              .sort((a, b) => {
                if (a.kind !== b.kind) return a.kind === "single" ? -1 : 1;
                if (a.state !== b.state) return a.state === "AVAILABLE" ? -1 : 1;
                return a.name.localeCompare(b.name);
              });
            if (!rows.length) return null;
            return (
              <section key={name}>
                <h2 className="font-display text-xl font-semibold text-foreground mb-3">{name}</h2>
                <div className="rounded-lg border border-border bg-card divide-y divide-border">
                  {rows.map((r) => (
                    <div
                      key={`${r.name}-${r.kind}`}
                      className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-foreground">{r.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="inline-flex items-center gap-1">
                            {r.kind === "single" ? (
                              <>
                                <Ticket className="w-3.5 h-3.5" /> Single Lightning Lane
                                {r.price ? ` · ${r.price}` : ""}
                              </>
                            ) : (
                              <>
                                <Zap className="w-3.5 h-3.5" /> Multi Pass
                              </>
                            )}
                          </span>
                          {r.standby != null && <span>Standby {r.standby}m</span>}
                        </div>
                      </div>
                      <div className="sm:text-right">
                        {r.state === "AVAILABLE" && (r.returnStart || r.returnEnd) ? (
                          <div className="font-display font-semibold text-foreground">
                            {fmtTime(r.returnStart) ?? "—"}
                            {r.returnEnd ? ` – ${fmtTime(r.returnEnd)}` : ""}
                          </div>
                        ) : (
                          <div className="font-display font-semibold text-muted-foreground">
                            {STATE_LABEL[r.state] ?? r.state}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {r.state === "AVAILABLE" ? "Next return window" : "No return window"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Return windows come from the same live park data feed used for wait times and hours. Availability
        and pricing change throughout the day — always confirm in the official app before purchasing.
      </p>
    </div>
  );
}
