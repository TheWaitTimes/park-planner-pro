import { useEffect, useState } from "react";
import { CloudRain, Thermometer, ThermometerSun, AlertTriangle, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { PARKS } from "@/data/parks";

// Walt Disney World coordinates
const WDW_LAT = 28.3852;
const WDW_LON = -81.5639;

// themeparks.wiki v1 park entity IDs
const PARK_IDS: { id: string; name: string }[] = [
  { id: "75ea578a-adc8-4116-a54d-dccb60765ef9", name: "Magic Kingdom" },
  { id: "47f90d2c-e191-4239-a466-5892ef59a88b", name: "EPCOT" },
  { id: "288747d1-8b4f-4a64-867e-ea7c9b27bad8", name: "Hollywood Studios" },
  { id: "1c84a229-8862-4648-9c71-378ddd2c7693", name: "Animal Kingdom" },
];

interface Weather {
  temp: number;
  feels: number;
  precipProb: number;
}

interface WaitRow {
  name: string;
  park: string;
  wait: number;
}

async function fetchWeather(): Promise<Weather> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${WDW_LAT}&longitude=${WDW_LON}&current=temperature_2m,apparent_temperature,precipitation_probability&temperature_unit=fahrenheit`;
  const res = await fetch(url);
  const json = await res.json();
  return {
    temp: Math.round(json.current.temperature_2m),
    feels: Math.round(json.current.apparent_temperature),
    precipProb: Math.round(json.current.precipitation_probability ?? 0),
  };
}

async function fetchWaits(): Promise<WaitRow[]> {
  const results = await Promise.all(
    PARK_IDS.map(async ({ id, name }) => {
      try {
        const res = await fetch(`https://api.themeparks.wiki/v1/entity/${id}/live`);
        const json = await res.json();
        const rows: WaitRow[] = [];
        for (const entity of json.liveData ?? []) {
          if (entity.entityType !== "ATTRACTION") continue;
          const wait = entity.queue?.STANDBY?.waitTime;
          if (entity.status !== "OPERATING" || wait == null) continue;
          rows.push({ name: entity.name, park: name, wait });
        }
        return rows;
      } catch {
        return [];
      }
    }),
  );
  return results.flat();
}

export default function Home() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [waits, setWaits] = useState<WaitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [w, r] = await Promise.all([fetchWeather(), fetchWaits()]);
      setWeather(w);
      setWaits(r);
      setUpdated(new Date());
    } catch (e) {
      setError("Unable to load live data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000); // 30 min
    return () => clearInterval(id);
  }, []);

  const sortedWaits = [...waits].sort((a, b) => b.wait - a.wait);
  const top5Long = sortedWaits.slice(0, 5);
  const top5Short = [...sortedWaits].reverse().slice(0, 5);

  // Weather-sensitive rides across all parks
  const weatherRides = Object.entries(PARKS).flatMap(([park, p]) =>
    p.rides.filter((r) => r.weatherEffect === 1).map((r) => ({ name: r.name, park })),
  );

  const showClosures = weather && weather.precipProb > 50;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-semibold text-foreground">
          Welcome to Main Street Insights
        </h1>
        <p className="font-body text-muted-foreground mt-2">
          Live conditions and wait times across the Walt Disney World Resort.
        </p>
      </div>

      {/* Weather */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-semibold text-foreground">Live Weather · Walt Disney World</h2>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {error && (
          <div className="text-sm text-destructive mb-3">{error}</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <WeatherCard
            icon={<Thermometer className="w-5 h-5" />}
            label="Temperature"
            value={weather ? `${weather.temp}°F` : "—"}
          />
          <WeatherCard
            icon={<ThermometerSun className="w-5 h-5" />}
            label="Feels Like"
            value={weather ? `${weather.feels}°F` : "—"}
          />
          <WeatherCard
            icon={<CloudRain className="w-5 h-5" />}
            label="Chance of Rain"
            value={weather ? `${weather.precipProb}%` : "—"}
          />
        </div>

        {showClosures && (
          <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-5">
            <div className="flex items-center gap-2 mb-3 text-amber-900">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-display font-semibold">
                Potential Ride Closures Due to Weather
              </h3>
            </div>
            <p className="text-sm text-amber-800 mb-3">
              Rain chance is {weather!.precipProb}%. These outdoor attractions may temporarily close during storms.
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-amber-900">
              {weatherRides.map((r) => (
                <li key={`${r.park}-${r.name}`} className="flex justify-between">
                  <span>{r.name}</span>
                  <span className="text-amber-700">{r.park}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Wait Times */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-semibold text-foreground">Live Wait Times</h2>
          <span className="text-xs text-muted-foreground">
            {updated ? `Updated ${updated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · auto-refresh 30 min` : ""}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <WaitList title="Longest Waits" icon={<TrendingUp className="w-5 h-5 text-rose-600" />} rows={top5Long} tone="long" loading={loading && !waits.length} />
          <WaitList title="Shortest Waits" icon={<TrendingDown className="w-5 h-5 text-emerald-600" />} rows={top5Short} tone="short" loading={loading && !waits.length} />
        </div>
      </section>
    </div>
  );
}

function WeatherCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
        {icon}
        <span>{label}</span>
      </div>
      <div className="font-display text-3xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

function WaitList({
  title,
  icon,
  rows,
  tone,
  loading,
}: {
  title: string;
  icon: React.ReactNode;
  rows: WaitRow[];
  tone: "long" | "short";
  loading: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="font-display font-semibold text-foreground">{title}</h3>
      </div>
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground">No live data available.</div>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r, i) => (
            <li key={`${r.park}-${r.name}-${i}`} className="py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-foreground truncate">{r.name}</div>
                <div className="text-xs text-muted-foreground">{r.park}</div>
              </div>
              <div
                className={`font-display font-semibold text-lg ${
                  tone === "long" ? "text-rose-600" : "text-emerald-600"
                }`}
              >
                {r.wait}m
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
