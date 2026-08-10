import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  Sun, CloudSun, Moon, Shuffle, Castle, Globe, Clapperboard, Trees,
  BarChart3, TrendingUp, Layers, Play, Download, Ticket, CloudRain,
  AlertTriangle, Info,
  type LucideIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Weather = "none" | "low" | "medium" | "high";

const WEATHER_LABELS: Record<Weather, string> = {
  none: "No Rain",
  low: "Low Chance",
  medium: "Medium Chance",
  high: "High Chance",
};

// Probability a weather-sensitive ride shuts down at each weather level —
// used both to flag rides in the report and to discount their contribution
// to the difficulty score.

// Probability a weather-sensitive ride shuts down at each level
const WEATHER_SHUTDOWN_CHANCE: Record<Weather, number> = {
  none: 0,
  low: 0.15,
  medium: 0.4,
  high: 0.7,
};
import { PARKS, type Ride } from "@/data/parks";
import { capWait, getHopTime, getWalkingTime, ROPE_DROP_MULTIPLIER } from "@/lib/parkModel";

type Slot = "morning" | "afternoon" | "night" | "hop";

const SLOT_LABELS: Record<Slot, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  night: "Night",
  hop: "Afternoon Park Hop",
};

const SLOT_ICONS: Record<Slot, LucideIcon> = {
  morning: Sun,
  afternoon: CloudSun,
  night: Moon,
  hop: Shuffle,
};

const SLOT_DESCRIPTIONS: Record<Slot, string> = {
  morning: "Park open – ~1 PM",
  afternoon: "~1 PM – ~6 PM",
  night: "~6 PM – Park close",
  hop: "Optional second park (after 2 PM)",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Mock seasonal demand multiplier per month (1.0 = baseline)
const MONTH_MULTIPLIER: Record<string, number> = {
  January: 0.85, February: 0.95, March: 1.20, April: 1.10, May: 0.95, June: 1.15,
  July: 1.25, August: 1.05, September: 0.80, October: 1.00, November: 1.10, December: 1.30,
};

const CROWD_MULTIPLIER = { Light: 0.75, Moderate: 1.0, Heavy: 1.35 } as const;

// Note: no separate slot multiplier — each ride's morning/afternoon/evening wait
// ranges in parks.ts already encode the time-of-day rhythm.


const PARK_OPTIONS: { name: string; icon: LucideIcon }[] = [
  { name: "Magic Kingdom", icon: Castle },
  { name: "EPCOT", icon: Globe },
  { name: "Hollywood Studios", icon: Clapperboard },
  { name: "Animal Kingdom", icon: Trees },
];

interface PlannedRide {
  rideId: string;
  parkName: string;
}

type Plan = Record<Slot, PlannedRide[]>;

interface ReportRow {
  rideId: string;
  rideName: string;
  parkArea: string;
  parkName: string;
  slot: Slot;
  expectedWait: number;
  onRideTime: number;
  /** Walking minutes to reach this ride from the previous one in the same slot. */
  walkMinutes: number;
  ropeDrop: boolean;
  shutdownChance: number; // 0..1 probability the ride may not run due to weather
}

function baseWait(ride: Ride, slot: Slot): number {
  const key = slot === "night" ? "evening" : slot === "hop" ? "afternoon" : slot;
  const range = ride.waitTimes[key];
  return (range[0] + range[1]) / 2;
}

/**
 * Expected wait for a ride in a slot.
 * The per-slot rhythm already lives in the ride's own morning/afternoon/evening
 * ranges, so no extra slot multiplier is applied here (that double-counted it).
 * `ropeDrop` applies to the very first ride of a morning plan.
 */
function computeExpectedWait(
  ride: Ride,
  slot: Slot,
  month: string,
  crowd: keyof typeof CROWD_MULTIPLIER,
  ropeDrop = false
): number {
  const base = baseWait(ride, slot);
  const wait =
    base *
    (MONTH_MULTIPLIER[month] ?? 1.0) *
    CROWD_MULTIPLIER[crowd] *
    (ropeDrop ? ROPE_DROP_MULTIPLIER : 1);
  return capWait(wait);
}

/** How the day's minutes are split across slots, scaled to the hours available. */
function slotCapacities(hoursAvailable: number): Record<Slot, number> {
  const totalMin = hoursAvailable * 60;
  // Nominal shape of a Disney day: morning 4h, afternoon 5h, night 3h.
  const shape = { morning: 4, afternoon: 5, night: 3 };
  const shapeTotal = shape.morning + shape.afternoon + shape.night;
  const morning = Math.round((totalMin * shape.morning) / shapeTotal);
  const afternoon = Math.round((totalMin * shape.afternoon) / shapeTotal);
  const night = totalMin - morning - afternoon;
  // The hop happens inside the afternoon window — it shares that budget.
  return { morning, afternoon, night, hop: afternoon };
}

function computeDifficulty(
  totalRideTimeMin: number,
  hoursAvailable: number,
  hopUsed: boolean,
  weatherBump: number
): { score: number; label: string; color: string } {
  const availableMin = hoursAvailable * 60;
  const ratio = totalRideTimeMin / Math.max(availableMin, 1);
  // ratio 0 -> 1, ratio 1 -> 10
  let score = Math.round(1 + ratio * 9);
  if (hopUsed) score += 1;
  score += weatherBump;
  score = Math.max(1, Math.min(10, score));
  const label =
    score <= 3 ? "Relaxed" : score <= 6 ? "Moderate" : score <= 8 ? "Challenging" : "Extreme";
  const color =
    score <= 3 ? "text-green-600" : score <= 6 ? "text-yellow-600" : score <= 8 ? "text-orange-600" : "text-red-600";
  return { score, label, color };
}


const SLOT_ORDER: Slot[] = ["morning", "afternoon", "night", "hop"];

export default function DayOptimizer() {
  const [primaryPark, setPrimaryPark] = useState("Magic Kingdom");
  const [hopPark, setHopPark] = useState("EPCOT");
  const [month, setMonth] = useState("October");
  const [crowd, setCrowd] = useState<keyof typeof CROWD_MULTIPLIER>("Moderate");
  const [weather, setWeather] = useState<Weather>("none");
  const [shutdownChance, setShutdownChance] = useState<number>(WEATHER_SHUTDOWN_CHANCE.none);
  const [hours, setHours] = useState(10);
  const [plan, setPlan] = useState<Plan>({ morning: [], afternoon: [], night: [], hop: [] });
  const [report, setReport] = useState<ReportRow[] | null>(null);
  const [exporting, setExporting] = useState<null | "png" | "pdf">(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const captureSections = useCallback(async () => {
    const node = reportRef.current;
    if (!node) return [];
    await document.fonts.ready;
    const sections = Array.from(
      node.querySelectorAll<HTMLElement>("[data-pdf-section]")
    );
    const bg = getComputedStyle(document.body).backgroundColor || "#ffffff";
    const canvases: HTMLCanvasElement[] = [];
    for (const section of sections) {
      const c = await html2canvas(section, {
        backgroundColor: bg,
        scale: 2,
        useCORS: true,
        logging: false,
        onclone: (clonedDoc) => {
          document.fonts.forEach((font) => {
            try {
              clonedDoc.fonts.add(font);
            } catch {
              // Ignore fonts the cloned document cannot re-register.
            }
          });

          const style = clonedDoc.createElement("style");
          style.textContent = `
            [data-pdf-section] {
              padding-top: 3px !important;
              padding-bottom: 3px !important;
              overflow: visible !important;
            }

            [data-pdf-section],
            [data-pdf-section] * {
              -webkit-font-smoothing: antialiased;
              text-rendering: geometricPrecision;
            }

            [data-pdf-section] [data-export-row] {
              padding-top: 0.75rem !important;
              padding-bottom: 0.75rem !important;
              align-items: flex-start !important;
            }

            [data-pdf-section] [data-export-text] {
              padding-top: 0.2rem !important;
              padding-bottom: 0.2rem !important;
              overflow: visible !important;
            }

            [data-pdf-section] [data-export-title],
            [data-pdf-section] [data-export-subtitle],
            [data-pdf-section] [data-export-label] {
              display: block !important;
              font-family: 'DM Sans', system-ui, sans-serif !important;
              white-space: normal !important;
              overflow: visible !important;
              text-overflow: clip !important;
              line-height: 1.45 !important;
              padding-top: 0.12rem !important;
              padding-bottom: 0.12rem !important;
            }
          `;
          clonedDoc.head.appendChild(style);
        },
      });
      canvases.push(c);
    }
    return canvases;
  }, []);

  const downloadPNG = useCallback(async () => {
    setExporting("png");
    try {
      const canvases = await captureSections();
      if (canvases.length === 0) return;
      const gap = 24; // px between sections (at scale 2 ≈ 12 CSS px)
      const width = Math.max(...canvases.map((c) => c.width));
      const totalHeight =
        canvases.reduce((s, c) => s + c.height, 0) + gap * (canvases.length - 1);
      const out = document.createElement("canvas");
      out.width = width;
      out.height = totalHeight;
      const ctx = out.getContext("2d");
      if (!ctx) return;
      const bg = getComputedStyle(document.body).backgroundColor || "#ffffff";
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, out.width, out.height);
      let y = 0;
      for (const c of canvases) {
        const x = Math.floor((width - c.width) / 2);
        ctx.drawImage(c, x, y);
        y += c.height + gap;
      }
      const link = document.createElement("a");
      link.download = `day-optimizer-${primaryPark.toLowerCase().replace(/\s+/g, "-")}.png`;
      link.href = out.toDataURL("image/png");
      link.click();
    } finally {
      setExporting(null);
    }
  }, [captureSections, primaryPark]);

  const downloadPDF = useCallback(async () => {
    setExporting("pdf");
    try {
      const canvases = await captureSections();
      if (canvases.length === 0) return;
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const contentW = pageW - margin * 2;
      const contentH = pageH - margin * 2;
      const gap = 8;
      let currentY = margin;
      let firstOnPage = true;
      for (const canvas of canvases) {
        const imgW = contentW;
        let imgH = (canvas.height * imgW) / canvas.width;
        // If a single section is taller than a page, scale it down to fit one page.
        if (imgH > contentH) {
          imgH = contentH;
        }
        const remaining = pageH - margin - currentY;
        if (!firstOnPage && imgH > remaining) {
          pdf.addPage();
          currentY = margin;
          firstOnPage = true;
        }
        const imgData = canvas.toDataURL("image/png");
        const drawW = (canvas.width * imgH) / canvas.height;
        const drawW2 = Math.min(drawW, contentW);
        const drawH2 = (canvas.height * drawW2) / canvas.width;
        const xOffset = margin + (contentW - drawW2) / 2;
        pdf.addImage(imgData, "PNG", xOffset, currentY, drawW2, drawH2);
        currentY += drawH2 + gap;
        firstOnPage = false;
      }
      pdf.save(`day-optimizer-${primaryPark.toLowerCase().replace(/\s+/g, "-")}.pdf`);
    } finally {
      setExporting(null);
    }
  }, [captureSections, primaryPark]);

  const primaryRides = PARKS[primaryPark]?.rides ?? [];
  const hopRides = PARKS[hopPark]?.rides ?? [];

  const addRide = useCallback((slot: Slot, rideId: string) => {
    if (!rideId) return;
    setPlan((prev) => {
      if (prev[slot].some((r) => r.rideId === rideId)) return prev;
      const parkName = slot === "hop" ? hopPark : primaryPark;
      return { ...prev, [slot]: [...prev[slot], { rideId, parkName }] };
    });
    setReport(null);
  }, [primaryPark, hopPark]);

  const removeRide = useCallback((slot: Slot, rideId: string) => {
    setPlan((prev) => ({ ...prev, [slot]: prev[slot].filter((r) => r.rideId !== rideId) }));
    setReport(null);
  }, []);

  const runReport = useCallback(() => {
    const rows: ReportRow[] = [];
    const shutdown = shutdownChance;
    for (const slot of SLOT_ORDER) {
      let previousArea: string | null = null;
      plan[slot].forEach((planned, index) => {
        const parkRides = PARKS[planned.parkName]?.rides ?? [];
        const ride = parkRides.find((r) => r.id === planned.rideId);
        if (!ride) return;
        // Rope drop only applies to the first attraction of a morning plan.
        const ropeDrop = slot === "morning" && index === 0;
        rows.push({
          rideId: ride.id,
          rideName: ride.name,
          parkArea: ride.parkArea,
          parkName: planned.parkName,
          slot,
          expectedWait: computeExpectedWait(ride, slot, month, crowd, ropeDrop),
          onRideTime: ride.onRideTime,
          walkMinutes: getWalkingTime(previousArea, ride.parkArea),
          ropeDrop,
          shutdownChance: ride.weatherEffect === 1 ? shutdown : 0,
        });
        previousArea = ride.parkArea;
      });
    }
    setReport(rows);
  }, [plan, month, crowd, shutdownChance]);

  // Instantly re-run whenever the shutdown chance slider moves (if a report exists).
  useEffect(() => {
    if (report !== null) runReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shutdownChance]);

  const totalRides = report?.length ?? 0;
  const totalWait = report?.reduce((s, r) => s + r.expectedWait, 0) ?? 0;
  const hopUsed = (report?.filter((r) => r.slot === "hop").length ?? 0) > 0;
  const hopTravelMinutes = hopUsed ? getHopTime(primaryPark, hopPark) : 0;
  // Committed minutes = wait + on-ride + walking, plus one-way travel if hopping.
  // Weather is reported as a risk, not netted out of the time budget.
  const totalRideTime =
    (report?.reduce((s, r) => s + r.expectedWait + r.onRideTime + r.walkMinutes, 0) ?? 0) +
    hopTravelMinutes;
  const weatherSensitiveRides = useMemo(() => {
    if (!report) return [];
    return report.filter((r) => r.shutdownChance > 0);
  }, [report]);
  const expectedShutdowns = weatherSensitiveRides.reduce((s, r) => s + r.shutdownChance, 0);
  const expectedCompleted = Math.max(0, totalRides - expectedShutdowns);
  // Difficulty bump scales with total expected shutdowns (capped at 3).
  const weatherBump = Math.min(3, Math.round(expectedShutdowns));
  const difficulty = report ? computeDifficulty(totalRideTime, hours, hopUsed, weatherBump) : null;
  const availableMinutes = hours * 60;
  const overBudgetMinutes = Math.max(0, totalRideTime - availableMinutes);

  const groupedReport = useMemo(() => {
    if (!report) return null;
    const grouped: Record<Slot, ReportRow[]> = { morning: [], afternoon: [], night: [], hop: [] };
    for (const r of report) grouped[r.slot].push(r);
    return grouped;
  }, [report]);

  const capacities = slotCapacities(hours);

  /** Planned minutes per slot, with hop travel charged to the hop slot. */
  const slotMinutes = useMemo(() => {
    const totals: Record<Slot, number> = { morning: 0, afternoon: 0, night: 0, hop: 0 };
    if (!groupedReport) return totals;
    for (const slot of SLOT_ORDER) {
      totals[slot] = groupedReport[slot].reduce(
        (s, r) => s + r.expectedWait + r.onRideTime + r.walkMinutes,
        0,
      );
    }
    if (totals.hop > 0) totals.hop += hopTravelMinutes;
    return totals;
  }, [groupedReport, hopTravelMinutes]);

  // Afternoon and the hop share the same window, so they're checked together.
  const slotOverflow = useMemo(() => {
    const afternoonUsed = slotMinutes.afternoon + slotMinutes.hop;
    return {
      morning: Math.max(0, slotMinutes.morning - capacities.morning),
      afternoonShared: Math.max(0, afternoonUsed - capacities.afternoon),
      afternoonUsed,
      night: Math.max(0, slotMinutes.night - capacities.night),
    };
  }, [slotMinutes, capacities]);


  const renderSlotCard = (slot: Slot) => {
    const isHop = slot === "hop";
    const sourceRides = isHop ? hopRides : primaryRides;
    const planned = plan[slot];
    const available = sourceRides.filter((r) => !planned.some((p) => p.rideId === r.id));
    const SlotIcon = SLOT_ICONS[slot];

    return (
      <div
        key={slot}
        className={`bg-card rounded-lg border p-4 ${
          isHop ? "border-dashed border-secondary/50" : "border-border"
        }`}
      >
        <div className="flex items-baseline justify-between mb-1">
          <h3 className="text-base font-display font-semibold text-foreground inline-flex items-center gap-2">
            <SlotIcon className="w-4 h-4 text-secondary" strokeWidth={2} />
            {SLOT_LABELS[slot]}
          </h3>
          <span className="text-xs text-muted-foreground font-body">
            {planned.length} ride{planned.length !== 1 ? "s" : ""}
          </span>
        </div>
        <p className="text-xs text-muted-foreground font-body mb-3">{SLOT_DESCRIPTIONS[slot]}</p>

        {planned.length > 0 && (
          <ul className="space-y-1.5 mb-3">
            {planned.map((p) => {
              const ride = sourceRides.find((r) => r.id === p.rideId);
              if (!ride) return null;
              return (
                <li
                  key={p.rideId}
                  className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md text-sm font-body"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground truncate">{ride.name}</div>
                    <div className="text-xs text-muted-foreground">{ride.parkArea}</div>
                  </div>
                  <button
                    onClick={() => removeRide(slot, p.rideId)}
                    className="text-muted-foreground hover:text-destructive shrink-0 text-lg leading-none"
                    aria-label={`Remove ${ride.name}`}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <select
          value=""
          onChange={(e) => addRide(slot, e.target.value)}
          className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm font-body text-foreground"
        >
          <option value="">+ Add a ride…</option>
          {available.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.parkArea})
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl md:text-4xl text-foreground mb-2 font-semibold tracking-tight">Day Optimizer</h1>
      <p className="font-body text-muted-foreground mb-8 max-w-2xl">
        Build your dream day — add rides to each part of the day, set your conditions, and run the report.
      </p>

      <div className="grid lg:grid-cols-[1fr_360px] gap-8">
        {/* LEFT: Plan builder */}
        <div className="space-y-6">
          {/* Park selectors */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h2 className="text-2xl font-display text-foreground mb-3">Parks</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-body font-semibold text-foreground">Primary Park</span>
                <select
                  value={primaryPark}
                  onChange={(e) => {
                    const next = e.target.value;
                    setPrimaryPark(next);
                    // Keep the hop park valid — it can never equal the primary park.
                    if (hopPark === next) {
                      const fallback = PARK_OPTIONS.find((p) => p.name !== next)?.name;
                      if (fallback) setHopPark(fallback);
                      setPlan((p) => ({ morning: [], afternoon: [], night: [], hop: [] }));
                    } else {
                      setPlan((p) => ({ ...p, morning: [], afternoon: [], night: [] }));
                    }
                    setReport(null);
                  }}
                  className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm font-body"
                >
                  {PARK_OPTIONS.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-body font-semibold text-foreground">Hop Park (optional)</span>
                <select
                  value={hopPark}
                  onChange={(e) => {
                    setHopPark(e.target.value);
                    setPlan((p) => ({ ...p, hop: [] }));
                    setReport(null);
                  }}
                  className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm font-body"
                >
                  {PARK_OPTIONS.filter((p) => p.name !== primaryPark).map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* Slots */}
          <div className="grid sm:grid-cols-2 gap-4">
            {(["morning", "afternoon", "night"] as Slot[]).map(renderSlotCard)}
            {renderSlotCard("hop")}
          </div>
        </div>

        {/* RIGHT: Conditions + Run */}
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <h2 className="text-2xl font-display text-foreground">Trip Conditions</h2>

            <label className="block">
              <span className="text-sm font-body font-semibold text-foreground">Time of Year</span>
              <select
                value={month}
                onChange={(e) => { setMonth(e.target.value); setReport(null); }}
                className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm font-body"
              >
                {MONTHS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>

            <div>
              <span className="text-sm font-body font-semibold text-foreground">Expected Crowds</span>
              <div className="flex gap-2 mt-1">
                {(Object.keys(CROWD_MULTIPLIER) as Array<keyof typeof CROWD_MULTIPLIER>).map((level) => (
                  <button
                    key={level}
                    onClick={() => { setCrowd(level); setReport(null); }}
                    className={`flex-1 py-2 rounded-md text-sm font-body font-semibold transition ${
                      crowd === level
                        ? "bg-secondary text-secondary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-body font-semibold text-foreground inline-flex items-center gap-1.5">
                  <CloudRain className="w-3.5 h-3.5 text-secondary" strokeWidth={2} />
                  Expected Weather
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label="How this slider works"
                          className="text-muted-foreground hover:text-foreground transition"
                        >
                          <Info className="w-3.5 h-3.5" strokeWidth={2} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs text-xs font-body leading-relaxed">
                        <p className="font-semibold mb-1">How this slider works</p>
                        <p className="mb-2">
                          The percentage is the chance each weather-sensitive ride
                          shuts down during your visit. Higher values discount those
                          rides in the difficulty score.
                        </p>
                        <ul className="space-y-0.5">
                          <li><span className="font-semibold">0%</span> — No Rain</li>
                          <li><span className="font-semibold">1–25%</span> — Low Chance</li>
                          <li><span className="font-semibold">26–55%</span> — Medium Chance</li>
                          <li><span className="font-semibold">56–100%</span> — High Chance</li>
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
                <span className="text-xs font-body font-semibold text-secondary">
                  {WEATHER_LABELS[weather]} · {Math.round(shutdownChance * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(shutdownChance * 100)}
                onChange={(e) => {
                  const pct = Number(e.target.value);
                  const chance = pct / 100;
                  setShutdownChance(chance);
                  const w: Weather =
                    pct === 0 ? "none" : pct <= 25 ? "low" : pct <= 55 ? "medium" : "high";
                  setWeather(w);
                }}
                className="w-full mt-2 accent-secondary"
                aria-label="Expected weather shutdown chance"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground font-body mt-1">
                <span>No Rain</span><span>High Chance</span>
              </div>
            </div>


            <label className="block">
              <span className="text-sm font-body font-semibold text-foreground">
                Hours in Park: <span className="text-secondary">{hours}h</span>
              </span>
              <input
                type="range"
                min={4}
                max={16}
                value={hours}
                onChange={(e) => { setHours(Number(e.target.value)); setReport(null); }}
                className="w-full mt-1 accent-secondary"
              />
              <div className="flex justify-between text-xs text-muted-foreground font-body mt-1">
                <span>4h</span><span>16h</span>
              </div>
            </label>
          </div>

          <button
            onClick={runReport}
            disabled={totalRidesPlanned(plan) === 0}
            className="w-full bg-secondary text-secondary-foreground font-body font-semibold text-base py-3.5 rounded-md hover:bg-secondary/90 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" strokeWidth={2.5} />
            Run Report
          </button>

          {report && groupedReport && difficulty && (
            <div className="space-y-4">
              {/* Download actions */}
              <div className="flex gap-2">
                <button
                  onClick={downloadPNG}
                  disabled={exporting !== null}
                  className="flex-1 border border-border bg-card text-foreground font-body font-medium text-sm py-2.5 rounded-md hover:bg-muted transition disabled:opacity-50 disabled:cursor-wait inline-flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" strokeWidth={2} />
                  {exporting === "png" ? "Generating…" : "PNG"}
                </button>
                <button
                  onClick={downloadPDF}
                  disabled={exporting !== null}
                  className="flex-1 border border-border bg-card text-foreground font-body font-medium text-sm py-2.5 rounded-md hover:bg-muted transition disabled:opacity-50 disabled:cursor-wait inline-flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" strokeWidth={2} />
                  {exporting === "pdf" ? "Generating…" : "PDF"}
                </button>
              </div>

              <div ref={reportRef} className="space-y-4 bg-background p-3 rounded-lg">
                <div data-pdf-section className="text-center pb-2 border-b border-border">
                  <div className="font-display text-2xl text-foreground">Day Optimizer Report</div>
                  <div className="text-xs font-body text-muted-foreground">
                    {primaryPark}{hopUsed ? ` + ${hopPark}` : ""} · {month} · {crowd} crowds · {hours}h
                  </div>
                  <div className="text-xs font-body text-muted-foreground mt-1 inline-flex items-center gap-1.5 justify-center">
                    <CloudRain className="w-3.5 h-3.5 text-secondary" strokeWidth={2} />
                    <span>Expected Weather: <span className="font-semibold text-foreground">{WEATHER_LABELS[weather]}{weather !== "none" ? " of Rain" : ""}</span></span>
                  </div>
                </div>
                {/* Summary */}
                <div data-pdf-section className="bg-card rounded-lg border border-border p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center">
                    <div className="text-xs font-body text-muted-foreground">Total Rides</div>
                    <div className="text-3xl font-display text-secondary">{totalRides}</div>
                    {expectedShutdowns > 0 && (
                      <div className="text-[11px] font-body text-muted-foreground mt-0.5">
                        ~{expectedCompleted.toFixed(1)} expected to run
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-body text-muted-foreground">Est. Wait</div>
                    <div className="text-3xl font-display text-secondary">{totalWait}m</div>
                  </div>
                </div>
                <div className="border-t border-border pt-3 text-center">
                  <div className="text-xs font-body text-muted-foreground">Difficulty</div>
                  <div className={`text-4xl font-display ${difficulty.color}`}>
                    {difficulty.score}<span className="text-xl text-muted-foreground">/10</span>
                  </div>
                  <div className={`text-sm font-body font-semibold ${difficulty.color}`}>
                    {difficulty.label}
                  </div>
                </div>
                {weatherBump > 0 && (
                  <div className="border-t border-border pt-3 text-xs font-body text-muted-foreground text-center">
                    Includes <span className="font-semibold text-foreground">+{weatherBump}</span> from{" "}
                    {WEATHER_LABELS[weather].toLowerCase()} of rain
                    ({weatherSensitiveRides.length} weather-sensitive ride{weatherSensitiveRides.length !== 1 ? "s" : ""},
                    ~{expectedShutdowns.toFixed(1)} may not run)
                  </div>
                )}
              </div>

              {/* Weather impact */}
              {weather !== "none" && weatherSensitiveRides.length > 0 && (
                <div data-pdf-section className="bg-card rounded-lg border border-border overflow-hidden">
                  <div className="bg-muted/40 px-4 py-2.5 border-b border-border">
                    <h3 className="font-display text-sm font-semibold text-foreground inline-flex items-center gap-2">
                      <CloudRain className="w-4 h-4 text-secondary" strokeWidth={2} />
                      Weather Impact
                    </h3>
                    <p className="text-xs font-body text-muted-foreground mt-0.5">
                      {WEATHER_LABELS[weather]} of rain · ~{Math.round(shutdownChance * 100)}% shutdown risk per ride below
                    </p>
                  </div>
                  <div className="divide-y divide-border">
                    {weatherSensitiveRides.map((r) => (
                      <div key={`weather-${r.slot}-${r.rideId}`} data-export-row className="px-4 py-3 flex items-start gap-2 text-sm font-body">
                        <CloudRain className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-1" strokeWidth={2} />
                        <div data-export-text className="flex-1 min-w-0">
                          <div data-export-title className="font-semibold text-foreground leading-snug break-words">{r.rideName}</div>
                          <div data-export-subtitle className="text-xs text-muted-foreground leading-snug break-words mt-0.5">
                            {r.parkArea} · {SLOT_LABELS[r.slot]}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-display text-secondary text-sm">
                            {Math.round(r.shutdownChance * 100)}%
                          </div>
                          <div className="text-[11px] text-muted-foreground">shutdown risk</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Per-slot summary */}
              <div data-pdf-section className="bg-card rounded-lg border border-border overflow-hidden">
                <div className="bg-muted/40 px-4 py-2.5 border-b border-border">
                  <h3 className="font-display text-sm font-semibold text-foreground inline-flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-secondary" strokeWidth={2} />
                    Per-Slot Summary
                  </h3>
                </div>
                <div className="divide-y divide-border">
                  {SLOT_ORDER.map((slot) => {
                    const rows = groupedReport[slot];
                    const count = rows.length;
                    const total = rows.reduce((s, r) => s + r.expectedWait, 0);
                    const avg = count > 0 ? Math.round(total / count) : 0;
                    return (
                      <div key={`sum-${slot}`} data-export-row className="px-4 py-3 flex items-start gap-2 text-sm font-body">
                        <div className="flex-1 min-w-0">
                          <div data-export-label className="font-semibold text-foreground leading-snug break-words inline-flex items-start gap-2">
                            {(() => { const I = SLOT_ICONS[slot]; return <I className="w-3.5 h-3.5 text-secondary" strokeWidth={2} />; })()}
                            {SLOT_LABELS[slot]}
                          </div>
                          <div data-export-subtitle className="text-xs text-muted-foreground leading-snug mt-0.5">
                            {count} ride{count !== 1 ? "s" : ""}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-display text-secondary">{total}m total</div>
                          <div className="text-xs text-muted-foreground">
                            {count > 0 ? `${avg}m avg wait` : "—"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Per-slot bar chart */}
              {(() => {
                const slotTotals = SLOT_ORDER.map((slot) => ({
                  slot,
                  total: groupedReport[slot].reduce((s, r) => s + r.expectedWait, 0),
                }));
                const maxTotal = Math.max(1, ...slotTotals.map((s) => s.total));
                return (
                  <div data-pdf-section className="bg-card rounded-lg border border-border overflow-hidden">
                    <div className="bg-muted/40 px-4 py-2.5 border-b border-border">
                      <h3 className="font-display text-sm font-semibold text-foreground inline-flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-secondary" strokeWidth={2} />
                        Wait Time by Slot
                      </h3>
                    </div>
                    <div className="p-4 space-y-3">
                      {slotTotals.map(({ slot, total }) => {
                        const pct = (total / maxTotal) * 100;
                        const I = SLOT_ICONS[slot];
                        return (
                          <div key={`bar-${slot}`} className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-body">
                              <span className="font-semibold text-foreground inline-flex items-center gap-1.5">
                                <I className="w-3.5 h-3.5 text-secondary" strokeWidth={2} />
                                {SLOT_LABELS[slot]}
                              </span>
                              <span className="text-secondary font-display">{total}m</span>
                            </div>
                            <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-secondary rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Stacked bar chart: ride contribution per slot */}
              {(() => {
                const slotData = SLOT_ORDER.map((slot) => ({
                  slot,
                  rows: groupedReport[slot],
                  total: groupedReport[slot].reduce((s, r) => s + r.expectedWait, 0),
                }));
                const maxTotal = Math.max(1, ...slotData.map((s) => s.total));
                // Distinct shades for stacked segments
                const SEGMENT_COLORS = [
                  "hsl(var(--secondary))",
                  "hsl(var(--primary))",
                  "hsl(var(--secondary) / 0.65)",
                  "hsl(var(--primary) / 0.65)",
                  "hsl(var(--secondary) / 0.4)",
                  "hsl(var(--primary) / 0.4)",
                ];
                const hasAny = slotData.some((s) => s.rows.length > 0);
                if (!hasAny) return null;
                return (
                  <div data-pdf-section className="bg-card rounded-lg border border-border overflow-hidden">
                    <div className="bg-muted/40 px-4 py-2.5 border-b border-border">
                      <h3 className="font-display text-sm font-semibold text-foreground inline-flex items-center gap-2">
                        <Layers className="w-4 h-4 text-secondary" strokeWidth={2} />
                        Ride Contribution by Slot
                      </h3>
                      <p className="text-xs font-body text-muted-foreground mt-0.5">
                        Each segment = one ride's expected wait
                      </p>
                    </div>
                    <div className="p-4 space-y-4">
                      {slotData.map(({ slot, rows, total }) => {
                        const slotPct = (total / maxTotal) * 100;
                        const I = SLOT_ICONS[slot];
                        return (
                          <div key={`stack-${slot}`} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-body">
                              <span className="font-semibold text-foreground inline-flex items-center gap-1.5">
                                <I className="w-3.5 h-3.5 text-secondary" strokeWidth={2} />
                                {SLOT_LABELS[slot]}
                              </span>
                              <span className="text-secondary font-display">
                                {rows.length === 0 ? "—" : `${total}m`}
                              </span>
                            </div>
                            <div className="h-6 w-full bg-muted rounded-md overflow-hidden flex">
                              {rows.length > 0 && (
                                <div
                                  className="h-full flex transition-all"
                                  style={{ width: `${slotPct}%` }}
                                >
                                  {rows.map((r, i) => {
                                    const segPct = total > 0 ? (r.expectedWait / total) * 100 : 0;
                                    return (
                                      <div
                                        key={`seg-${slot}-${r.rideId}`}
                                        className="h-full flex items-center justify-center text-[10px] font-body font-semibold text-background overflow-hidden border-r border-card last:border-r-0"
                                        style={{
                                          width: `${segPct}%`,
                                          backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                                        }}
                                        title={`${r.rideName} — ${r.expectedWait}m`}
                                      >
                                        {segPct >= 12 ? `${r.expectedWait}m` : ""}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            {rows.length > 0 && (
                              <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                                {rows.map((r, i) => (
                                  <div
                                    key={`leg-${slot}-${r.rideId}`}
                                    className="flex items-start gap-1.5 text-[11px] font-body text-muted-foreground"
                                  >
                                    <span
                                      className="inline-block w-2.5 h-2.5 rounded-sm shrink-0 mt-1"
                                      style={{ backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
                                    />
                                    <span data-export-label className="max-w-[140px] leading-snug break-words">{r.rideName}</span>
                                    <span className="text-foreground font-semibold">{r.expectedWait}m</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Per-slot breakdown */}
              {SLOT_ORDER.map((slot) => {
                const rows = groupedReport[slot];
                if (rows.length === 0) return null;
                const I = SLOT_ICONS[slot];
                return (
                  <div data-pdf-section key={slot} className="bg-card rounded-lg border border-border overflow-hidden">
                    <div className="bg-muted/40 px-4 py-2.5 border-b border-border">
                      <h3 className="font-display text-sm font-semibold text-foreground inline-flex items-center gap-2">
                        <I className="w-4 h-4 text-secondary" strokeWidth={2} />
                        {SLOT_LABELS[slot]}
                      </h3>
                    </div>
                    <div className="divide-y divide-border">
                      {rows.map((r) => (
                        <div key={`${slot}-${r.rideId}`} data-export-row className="px-4 py-3 flex items-start gap-2 text-sm font-body">
                          <div data-export-text className="flex-1 min-w-0">
                            <div data-export-title className="font-semibold text-foreground leading-snug break-words inline-flex items-center gap-2 flex-wrap">
                              {r.rideName}
                              {r.shutdownChance > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 px-2 py-0.5 text-[10px] font-body font-semibold uppercase tracking-wide">
                                  <AlertTriangle className="w-3 h-3" strokeWidth={2.5} />
                                  May not run · {Math.round(r.shutdownChance * 100)}%
                                </span>
                              )}
                            </div>
                            <div data-export-subtitle className="text-xs text-muted-foreground leading-snug break-words mt-0.5">
                              {r.parkArea}{slot === "hop" ? ` · ${r.parkName}` : ""}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-display text-secondary">{r.expectedWait}m</div>
                            <div className="text-xs text-muted-foreground">+{r.onRideTime}m ride</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}

          {!report && (
            <div className="bg-card rounded-lg border border-border p-6 text-center">
              <Ticket className="w-8 h-8 mx-auto mb-2 text-muted-foreground" strokeWidth={1.5} />
              <p className="text-sm font-body text-muted-foreground">
                Add rides to your day, set your conditions, then run the report.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function totalRidesPlanned(plan: Plan): number {
  return plan.morning.length + plan.afternoon.length + plan.night.length + plan.hop.length;
}
