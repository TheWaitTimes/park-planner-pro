import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Database,
  PartyPopper,
  RefreshCw,
  Sparkles,
  Ticket,
} from "lucide-react";
import { cachedFetch, TTL_30_MIN } from "@/lib/liveCache";

// themeparks.wiki v1 park entity IDs
const PARK_IDS: { id: string; name: string }[] = [
  { id: "75ea578a-adc8-4116-a54d-dccb60765ef9", name: "Magic Kingdom" },
  { id: "47f90d2c-e191-4239-a466-5892ef59a88b", name: "EPCOT" },
  { id: "288747d1-8b4f-4a64-867e-ea7c9b27bad8", name: "Hollywood Studios" },
  { id: "1c84a229-8862-4648-9c71-378ddd2c7693", name: "Animal Kingdom" },
];

interface ScheduleEntry {
  date: string;
  type: string;
  description?: string;
  openingTime?: string;
  closingTime?: string;
}

interface DayInfo {
  date: string;
  operating: ScheduleEntry | null;
  extras: ScheduleEntry[];
}

// Holidays and peak periods that shape Walt Disney World crowds.
const HOLIDAYS: { md: string; label: string }[] = [
  { md: "01-01", label: "New Year's Day" },
  { md: "02-14", label: "Valentine's Day" },
  { md: "03-17", label: "St. Patrick's Day" },
  { md: "07-04", label: "Independence Day" },
  { md: "10-31", label: "Halloween" },
  { md: "11-11", label: "Veterans Day" },
  { md: "12-24", label: "Christmas Eve" },
  { md: "12-25", label: "Christmas Day" },
  { md: "12-31", label: "New Year's Eve" },
];

// Recurring seasonal events by park (approximate annual windows).
const SEASONAL_EVENTS: { park: string; label: string; start: string; end: string }[] = [
  { park: "Magic Kingdom", label: "Mickey's Not-So-Scary Halloween Party season", start: "08-01", end: "10-31" },
  { park: "Magic Kingdom", label: "Mickey's Very Merry Christmas Party season", start: "11-08", end: "12-21" },
  { park: "EPCOT", label: "EPCOT International Flower & Garden Festival", start: "02-25", end: "06-01" },
  { park: "EPCOT", label: "EPCOT International Food & Wine Festival", start: "08-15", end: "11-22" },
  { park: "EPCOT", label: "EPCOT International Festival of the Holidays", start: "11-24", end: "12-30" },
  { park: "EPCOT", label: "EPCOT International Festival of the Arts", start: "01-12", end: "02-20" },
  { park: "Hollywood Studios", label: "Jollywood Nights season", start: "11-08", end: "12-21" },
  { park: "Animal Kingdom", label: "Merry Menagerie holiday offerings", start: "11-24", end: "12-31" },
];

function fmtTime(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

function todayInPark() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

async function fetchSchedule(id: string): Promise<ScheduleEntry[]> {
  const res = await fetch(`https://api.themeparks.wiki/v1/entity/${id}/schedule`);
  if (!res.ok) throw new Error(`Schedule request failed (${res.status})`);
  const json = await res.json();
  return (json.schedule ?? []) as ScheduleEntry[];
}

async function fetchNextMonth(id: string, year: number, month: number): Promise<ScheduleEntry[]> {
  const res = await fetch(
    `https://api.themeparks.wiki/v1/entity/${id}/schedule/${year}/${String(month + 1).padStart(2, "0")}`,
  );
  if (!res.ok) return [];
  const json = await res.json();
  return (json.schedule ?? []) as ScheduleEntry[];
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString([], { month: "long", year: "numeric" });
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isTicketed(type: string) {
  return type === "TICKETED_EVENT";
}

export default function ParkCalendar({ initialPark }: { initialPark?: string } = {}) {
  const [park, setPark] = useState(
    () => PARK_IDS.find((p) => p.name === initialPark)?.name ?? PARK_IDS[0].name,
  );
  const today = todayInPark();
  const [cursor, setCursor] = useState(() => {
    const [y, m] = today.split("-").map(Number);
    return { year: y, month: m - 1 };
  });
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const parkId = PARK_IDS.find((p) => p.name === park)!.id;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const key = `calendar:${parkId}:${cursor.year}-${cursor.month}`;
    cachedFetch(key, TTL_30_MIN, async () => {
      const [base, extra] = await Promise.all([
        fetchSchedule(parkId),
        fetchNextMonth(parkId, cursor.year, cursor.month),
      ]);
      const seen = new Set<string>();
      const merged: ScheduleEntry[] = [];
      for (const e of [...extra, ...base]) {
        const k = `${e.date}|${e.type}|${e.description ?? ""}|${e.openingTime ?? ""}`;
        if (seen.has(k)) continue;
        seen.add(k);
        merged.push(e);
      }
      return merged;
    })
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .catch(() => {
        if (!cancelled) setError("Calendar data is unavailable right now. Please try again later.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [parkId, cursor.year, cursor.month]);

  const byDate = useMemo(() => {
    const map = new Map<string, DayInfo>();
    for (const e of entries) {
      if (!e.date) continue;
      const info = map.get(e.date) ?? { date: e.date, operating: null, extras: [] };
      if (e.type === "OPERATING" && !info.operating) info.operating = e;
      else if (e.type !== "OPERATING") info.extras.push(e);
      map.set(e.date, info);
    }
    return map;
  }, [entries]);

  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const leadingBlanks = new Date(cursor.year, cursor.month, 1).getDay();

  const monthHolidays = HOLIDAYS.filter((h) => Number(h.md.slice(0, 2)) === cursor.month + 1).map((h) => ({
    ...h,
    date: `${cursor.year}-${h.md}`,
  }));
  const holidayByDate = new Map(monthHolidays.map((h) => [h.date, h.label]));

  const monthNumber = cursor.month + 1;
  const activeSeasonal = SEASONAL_EVENTS.filter((ev) => {
    if (ev.park !== park) return false;
    const startM = Number(ev.start.slice(0, 2));
    const endM = Number(ev.end.slice(0, 2));
    return startM <= endM
      ? monthNumber >= startM && monthNumber <= endM
      : monthNumber >= startM || monthNumber <= endM;
  });

  const ticketedDays = Array.from(byDate.values())
    .filter((d) => d.date.startsWith(`${cursor.year}-${String(monthNumber).padStart(2, "0")}`))
    .filter((d) => d.extras.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  const shiftMonth = (delta: number) => {
    setCursor((c) => {
      const next = new Date(c.year, c.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-center gap-2 mb-2">
          <CalendarDays className="w-6 h-6 text-secondary" />
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-foreground">Park Calendar</h2>
        </div>
        <p className="font-body text-muted-foreground text-sm sm:text-base">
          Operating dates, hours, holidays, and special ticketed events across the Walt Disney World theme parks.
        </p>
      </header>

      {/* Park selector */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {PARK_IDS.map((p) => {
          const active = p.name === park;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPark(p.name)}
              aria-pressed={active}
              className={`min-h-[56px] rounded-lg border px-4 py-3 text-left font-body text-sm font-medium transition-colors ${
                active
                  ? "border-secondary bg-accent/60 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-secondary/60 hover:text-foreground"
              }`}
            >
              {p.name}
            </button>
          );
        })}
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg border border-border bg-card text-foreground hover:border-secondary"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="font-display text-lg sm:text-xl font-semibold text-foreground text-center">
          {monthLabel(cursor.year, cursor.month)}
        </div>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg border border-border bg-card text-foreground hover:border-secondary"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">{error}</div>
      )}

      {loading && !entries.length ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading calendar…
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="py-2 text-center text-[11px] sm:text-xs font-body font-semibold uppercase tracking-wide text-muted-foreground"
              >
                <span className="sm:hidden">{d.slice(0, 1)}</span>
                <span className="hidden sm:inline">{d}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} className="border-b border-r border-border/60 min-h-[72px] sm:min-h-[104px]" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const key = dateKey(cursor.year, cursor.month, day);
              const info = byDate.get(key);
              const holiday = holidayByDate.get(key);
              const isToday = key === today;
              const closed = !!info && !info.operating;
              return (
                <div
                  key={key}
                  className={`border-b border-r border-border/60 min-h-[72px] sm:min-h-[104px] p-1.5 sm:p-2 ${
                    isToday ? "bg-accent/50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-body text-xs sm:text-sm ${
                        isToday ? "font-bold text-secondary" : "text-foreground"
                      }`}
                    >
                      {day}
                    </span>
                    {holiday && <Sparkles className="w-3 h-3 text-primary" aria-label={holiday} />}
                  </div>
                  {info?.operating ? (
                    <div className="mt-1 text-[10px] sm:text-xs leading-tight text-muted-foreground">
                      {fmtTime(info.operating.openingTime)}
                      <span className="hidden sm:inline"> – {fmtTime(info.operating.closingTime)}</span>
                      <span className="sm:hidden block">{fmtTime(info.operating.closingTime)}</span>
                    </div>
                  ) : closed ? (
                    <div className="mt-1 text-[10px] sm:text-xs text-muted-foreground">Closed</div>
                  ) : null}
                  {info && info.extras.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {info.extras.slice(0, 2).map((e, idx) => (
                        <span
                          key={idx}
                          title={e.description ?? e.type}
                          className={`inline-flex items-center rounded px-1 py-0.5 text-[9px] sm:text-[10px] font-medium ${
                            isTicketed(e.type)
                              ? "bg-primary/10 text-primary"
                              : "bg-secondary/10 text-secondary"
                          }`}
                        >
                          {isTicketed(e.type) ? <Ticket className="w-2.5 h-2.5" /> : <PartyPopper className="w-2.5 h-2.5" />}
                        </span>
                      ))}
                    </div>
                  )}
                  {holiday && (
                    <div className="mt-1 hidden sm:block text-[10px] leading-tight text-primary">{holiday}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Ticket className="w-3.5 h-3.5 text-primary" /> Ticketed event
        </span>
        <span className="inline-flex items-center gap-1.5">
          <PartyPopper className="w-3.5 h-3.5 text-secondary" /> Extra hours / special hours
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" /> Holiday
        </span>
      </div>

      {/* Special events this month */}
      <section>
        <h3 className="font-display text-lg font-semibold text-foreground mb-3">
          Special Events &amp; Holidays — {monthLabel(cursor.year, cursor.month)}
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="text-sm font-medium text-foreground mb-3">Scheduled event nights &amp; extra hours</div>
            {ticketedDays.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No ticketed events or extra hours reported for {park} this month.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {ticketedDays.map((d) => (
                  <li key={d.date} className="py-2.5 text-sm">
                    <div className="font-medium text-foreground">
                      {new Date(`${d.date}T12:00:00`).toLocaleDateString([], {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                    {d.extras.map((e, idx) => (
                      <div key={idx} className="text-muted-foreground text-xs mt-0.5">
                        {e.description ?? e.type.replaceAll("_", " ")}
                        {e.openingTime && ` · ${fmtTime(e.openingTime)}–${fmtTime(e.closingTime)}`}
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <div className="text-sm font-medium text-foreground mb-3">Seasonal festivals &amp; holidays</div>
            {activeSeasonal.length === 0 && monthHolidays.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing seasonal on the calendar this month.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {activeSeasonal.map((ev) => (
                  <li key={ev.label} className="flex items-start gap-2">
                    <PartyPopper className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">
                      <span className="text-foreground font-medium">{ev.label}</span> — typical window{" "}
                      {ev.start.replace("-", "/")} to {ev.end.replace("-", "/")}
                    </span>
                  </li>
                ))}
                {monthHolidays.map((h) => (
                  <li key={h.md} className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">
                      <span className="text-foreground font-medium">{h.label}</span> —{" "}
                      {new Date(`${h.date}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
                      · expect peak crowds
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Data Sources */}
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-5 h-5 text-secondary" />
          <h3 className="font-display text-base font-semibold text-foreground">Data Sources</h3>
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Operating dates, hours &amp; events:</span>{" "}
            <a
              href="https://www.themeparks.wiki/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              themeparks.wiki
            </a>{" "}
            — published park schedules, extra hours, and ticketed event nights.
          </li>
          <li>
            <span className="font-medium text-foreground">Seasonal festivals &amp; holidays:</span> compiled from
            historical Walt Disney World event windows — dates are approximate until Disney publishes them.
          </li>
        </ul>
        <p className="text-xs text-muted-foreground mt-3">
          Schedules refresh every 30 minutes and are shown in Eastern Time. Always confirm dates in the official My
          Disney Experience app before booking.
        </p>
      </section>
    </div>
  );
}
