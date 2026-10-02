import { useMemo, useRef, useState, type ReactNode } from "react";
import { Sparkles, Loader2, Square, X, Wand2 } from "lucide-react";
import { PARKS } from "@/data/parks";

const PACES = [
  { id: "relaxed", label: "Relaxed", desc: "Fewer rides, plenty of downtime" },
  { id: "balanced", label: "Balanced", desc: "A steady mix of rides and rest" },
  { id: "intense", label: "Commando", desc: "Maximize rides, minimal breaks" },
];
const BREAKS = ["Lunch only", "Lunch and dinner", "Lunch, dinner and an afternoon rest", "Snacks on the go"];

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plan-itinerary`;

function fmtHour(h: number) {
  const hh = Math.floor(h);
  const mm = h % 1 ? "30" : "00";
  const suffix = hh >= 12 ? "PM" : "AM";
  return `${((hh + 11) % 12) + 1}:${mm} ${suffix}`;
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="text-foreground">{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part.replace(/^_|_$/g, "")}</span>
    ),
  );
}

function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  let list: ReactNode[] = [];
  const flush = () => {
    if (list.length) out.push(<ul key={`u${out.length}`} className="space-y-2 my-3">{list}</ul>);
    list = [];
  };
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (/^#{1,3}\s/.test(line)) {
      flush();
      out.push(
        <h3 key={i} className="font-display text-lg font-semibold text-primary mt-6 first:mt-0 mb-2">
          {line.replace(/^#+\s/, "")}
        </h3>,
      );
    } else if (/^[-*]\s/.test(line)) {
      list.push(
        <li key={i} className="pl-4 border-l-2 border-secondary/40 text-sm leading-relaxed text-muted-foreground">
          {inline(line.replace(/^[-*]\s/, ""))}
        </li>,
      );
    } else if (line) {
      flush();
      out.push(<p key={i} className="text-sm leading-relaxed text-muted-foreground my-2">{inline(line)}</p>);
    }
  });
  flush();
  return <div>{out}</div>;
}

export default function AiPlanner() {
  const parkNames = Object.keys(PARKS);
  const today = new Date().toISOString().slice(0, 10);
  const [park, setPark] = useState(parkNames[0]);
  const [date, setDate] = useState(today);
  const [start, setStart] = useState(9);
  const [end, setEnd] = useState(21);
  const [pace, setPace] = useState("balanced");
  const [breaks, setBreaks] = useState(BREAKS[0]);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const rides = useMemo(() => [...PARKS[park].rides].sort((a, b) => a.name.localeCompare(b.name)), [park]);
  const available = rides.filter((r) => !priorities.includes(r.name));

  const changePark = (p: string) => {
    setPark(p);
    setPriorities([]);
  };

  const generate = async () => {
    if (end <= start) {
      setError("Your departure time must be after your arrival time.");
      return;
    }
    setError("");
    setOutput("");
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(FN_URL, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, apikey: key },
        body: JSON.stringify({
          park,
          date,
          startTime: fmtHour(start),
          endTime: fmtHour(end),
          pace,
          breaks,
          priorities,
          notes,
          rides: rides.map((r) => ({ name: r.name, area: r.parkArea, rideMinutes: r.onRideTime, waits: r.waitTimes })),
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong creating your itinerary.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setOutput((o) => o + decoder.decode(value, { stream: true }));
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const inputCls =
    "w-full min-h-[44px] rounded-lg border border-border bg-card px-3 font-body text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-secondary";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-primary flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-secondary" /> AI Day Planner
        </h2>
        <p className="font-body text-muted-foreground mt-1 text-sm sm:text-base">
          Tell us how you like to tour and get a personalized, time-stamped plan for your park day.
        </p>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,420px)_1fr] gap-6">
        <section className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-5 font-body">
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 sm:col-span-1 space-y-1.5">
              <span className="text-sm font-medium text-foreground">Park</span>
              <select className={inputCls} value={park} onChange={(e) => changePark(e.target.value)}>
                {parkNames.map((p) => <option key={p}>{p}</option>)}
              </select>
            </label>
            <label className="col-span-2 sm:col-span-1 space-y-1.5">
              <span className="text-sm font-medium text-foreground">Visit date</span>
              <input type="date" className={inputCls} value={date} min={today} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium text-foreground">
              In park: {fmtHour(start)} – {fmtHour(end)}
            </span>
            <div className="grid grid-cols-2 gap-3">
              <input type="range" min={7} max={22} step={0.5} value={start} onChange={(e) => setStart(+e.target.value)} aria-label="Arrival time" className="accent-secondary" />
              <input type="range" min={8} max={23} step={0.5} value={end} onChange={(e) => setEnd(+e.target.value)} aria-label="Departure time" className="accent-secondary" />
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium text-foreground">Pacing</span>
            <div className="grid grid-cols-3 gap-2">
              {PACES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPace(p.id)}
                  className={`rounded-lg border p-2 text-left min-h-[44px] transition-colors ${
                    pace === p.id ? "border-secondary bg-secondary/10" : "border-border hover:border-secondary/50"
                  }`}
                >
                  <div className="text-sm font-semibold text-foreground">{p.label}</div>
                  <div className="text-[11px] text-muted-foreground leading-tight">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Breaks</span>
            <select className={inputCls} value={breaks} onChange={(e) => setBreaks(e.target.value)}>
              {BREAKS.map((b) => <option key={b}>{b}</option>)}
            </select>
          </label>

          <div className="space-y-2">
            <span className="text-sm font-medium text-foreground">Ride priorities (in order)</span>
            {priorities.length > 0 && (
              <ol className="space-y-1.5">
                {priorities.map((p, i) => (
                  <li key={p} className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
                    <span><span className="font-semibold text-secondary mr-2">{i + 1}.</span>{p}</span>
                    <button type="button" aria-label={`Remove ${p}`} onClick={() => setPriorities(priorities.filter((x) => x !== p))} className="p-1 text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ol>
            )}
            {priorities.length < 8 && (
              <select className={inputCls} value="" onChange={(e) => e.target.value && setPriorities([...priorities, e.target.value])}>
                <option value="">Add a must-do ride...</option>
                {available.map((r) => <option key={r.id}>{r.name}</option>)}
              </select>
            )}
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Anything else?</span>
            <textarea
              className={`${inputCls} py-2 min-h-[80px]`}
              placeholder="e.g. traveling with a 5-year-old, avoid big drops, want to see the fireworks"
              value={notes}
              maxLength={500}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          {loading ? (
            <button type="button" onClick={() => abortRef.current?.abort()} className="w-full min-h-[48px] rounded-lg border border-border text-foreground font-semibold inline-flex items-center justify-center gap-2">
              <Square className="w-4 h-4" /> Stop
            </button>
          ) : (
            <button type="button" onClick={generate} className="w-full min-h-[48px] rounded-lg bg-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-2 hover:opacity-90">
              <Wand2 className="w-4 h-4" /> Create my itinerary
            </button>
          )}
        </section>

        <section className="bg-card border border-border rounded-xl p-4 sm:p-6 min-h-[300px] font-body">
          {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-sm p-3 mb-4">{error}</div>}
          {!output && loading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Building your personalized plan...
            </div>
          )}
          {!output && !loading && !error && (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground text-sm gap-2 py-12">
              <Sparkles className="w-8 h-8 text-secondary/60" />
              Fill in your preferences and your itinerary will appear here.
            </div>
          )}
          {output && <Markdown text={output} />}
          {output && !loading && (
            <p className="text-xs text-muted-foreground mt-6 border-t border-border pt-3">
              AI-generated using modeled wait times. Actual waits and hours vary — confirm in the official Disney app.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
