import { useState, useMemo, useCallback, useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  Sun, CloudSun, Moon, Shuffle, Castle, Globe, Clapperboard, Trees,
  BarChart3, TrendingUp, Layers, Play, Download, Ticket,
  type LucideIcon,
} from "lucide-react";
import { PARKS, type Ride } from "@/data/parks";

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

// Slot-of-day base wait multiplier (afternoon is busiest)
const SLOT_WAIT_MULTIPLIER: Record<Slot, number> = {
  morning: 0.7,
  afternoon: 1.2,
  night: 0.9,
  hop: 1.1,
};

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
}

function baseWait(ride: Ride, slot: Slot): number {
  const key = slot === "night" ? "evening" : slot === "hop" ? "afternoon" : slot;
  const range = ride.waitTimes[key];
  return (range[0] + range[1]) / 2;
}

function computeExpectedWait(
  ride: Ride,
  slot: Slot,
  month: string,
  crowd: keyof typeof CROWD_MULTIPLIER
): number {
  const base = baseWait(ride, slot);
  const wait =
    base *
    SLOT_WAIT_MULTIPLIER[slot] *
    (MONTH_MULTIPLIER[month] ?? 1.0) *
    CROWD_MULTIPLIER[crowd];
  return Math.max(5, Math.round(wait));
}

function computeDifficulty(
  totalRideTimeMin: number,
  hoursAvailable: number,
  hopUsed: boolean
): { score: number; label: string; color: string } {
  const availableMin = hoursAvailable * 60;
  const ratio = totalRideTimeMin / Math.max(availableMin, 1);
  // ratio 0 -> 1, ratio 1 -> 10
  let score = Math.round(1 + ratio * 9);
  if (hopUsed) score += 1;
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
  const [hours, setHours] = useState(10);
  const [plan, setPlan] = useState<Plan>({ morning: [], afternoon: [], night: [], hop: [] });
  const [report, setReport] = useState<ReportRow[] | null>(null);
  const [exporting, setExporting] = useState<null | "png" | "pdf">(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const captureReport = useCallback(async () => {
    const node = reportRef.current;
    if (!node) return null;
    const bg = getComputedStyle(document.body).backgroundColor || "#ffffff";
    return await html2canvas(node, {
      backgroundColor: bg,
      scale: 2,
      useCORS: true,
    });
  }, []);

  const downloadPNG = useCallback(async () => {
    setExporting("png");
    try {
      const canvas = await captureReport();
      if (!canvas) return;
      const link = document.createElement("a");
      link.download = `day-optimizer-${primaryPark.toLowerCase().replace(/\s+/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setExporting(null);
    }
  }, [captureReport, primaryPark]);

  const downloadPDF = useCallback(async () => {
    setExporting("pdf");
    try {
      const canvas = await captureReport();
      if (!canvas) return;
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const imgW = pageW - margin * 2;
      const imgH = (canvas.height * imgW) / canvas.width;
      let heightLeft = imgH;
      let position = margin;
      pdf.addImage(imgData, "PNG", margin, position, imgW, imgH);
      heightLeft -= pageH - margin * 2;
      while (heightLeft > 0) {
        position = margin - (imgH - heightLeft);
        pdf.addPage();
        pdf.addImage(imgData, "PNG", margin, position, imgW, imgH);
        heightLeft -= pageH - margin * 2;
      }
      pdf.save(`day-optimizer-${primaryPark.toLowerCase().replace(/\s+/g, "-")}.pdf`);
    } finally {
      setExporting(null);
    }
  }, [captureReport, primaryPark]);

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
    for (const slot of SLOT_ORDER) {
      for (const planned of plan[slot]) {
        const parkRides = PARKS[planned.parkName]?.rides ?? [];
        const ride = parkRides.find((r) => r.id === planned.rideId);
        if (!ride) continue;
        rows.push({
          rideId: ride.id,
          rideName: ride.name,
          parkArea: ride.parkArea,
          parkName: planned.parkName,
          slot,
          expectedWait: computeExpectedWait(ride, slot, month, crowd),
          onRideTime: ride.onRideTime,
        });
      }
    }
    setReport(rows);
  }, [plan, month, crowd]);

  const totalRides = report?.length ?? 0;
  const totalWait = report?.reduce((s, r) => s + r.expectedWait, 0) ?? 0;
  const totalRideTime = report?.reduce((s, r) => s + r.expectedWait + r.onRideTime + 5, 0) ?? 0;
  const hopUsed = (report?.filter((r) => r.slot === "hop").length ?? 0) > 0;
  const difficulty = report ? computeDifficulty(totalRideTime, hours, hopUsed) : null;

  const groupedReport = useMemo(() => {
    if (!report) return null;
    const grouped: Record<Slot, ReportRow[]> = { morning: [], afternoon: [], night: [], hop: [] };
    for (const r of report) grouped[r.slot].push(r);
    return grouped;
  }, [report]);

  const renderSlotCard = (slot: Slot) => {
    const isHop = slot === "hop";
    const sourceRides = isHop ? hopRides : primaryRides;
    const planned = plan[slot];
    const available = sourceRides.filter((r) => !planned.some((p) => p.rideId === r.id));

    return (
      <div
        key={slot}
        className={`bg-card rounded-lg border p-4 ${
          isHop ? "border-dashed border-secondary/50" : "border-border"
        }`}
      >
        <div className="flex items-baseline justify-between mb-1">
          <h3 className="text-2xl font-display text-foreground">
            {SLOT_ICONS[slot]} {SLOT_LABELS[slot]}
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
      <h1 className="text-5xl md:text-6xl text-foreground mb-2">Day Optimizer</h1>
      <p className="font-body text-muted-foreground mb-8">
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
                    setPrimaryPark(e.target.value);
                    setPlan((p) => ({ ...p, morning: [], afternoon: [], night: [] }));
                    setReport(null);
                  }}
                  className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm font-body"
                >
                  {PARK_OPTIONS.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.icon} {p.name}
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
                      {p.icon} {p.name}
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
            className="w-full bg-secondary text-secondary-foreground font-display text-2xl py-4 rounded-lg hover:opacity-90 transition shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ▶ Run Report
          </button>

          {report && groupedReport && difficulty && (
            <div className="space-y-4">
              {/* Download actions */}
              <div className="flex gap-2">
                <button
                  onClick={downloadPNG}
                  disabled={exporting !== null}
                  className="flex-1 bg-primary text-primary-foreground font-body font-semibold text-sm py-2.5 rounded-md hover:opacity-90 transition disabled:opacity-50 disabled:cursor-wait"
                >
                  {exporting === "png" ? "Generating…" : "⬇ Download PNG"}
                </button>
                <button
                  onClick={downloadPDF}
                  disabled={exporting !== null}
                  className="flex-1 bg-primary text-primary-foreground font-body font-semibold text-sm py-2.5 rounded-md hover:opacity-90 transition disabled:opacity-50 disabled:cursor-wait"
                >
                  {exporting === "pdf" ? "Generating…" : "⬇ Download PDF"}
                </button>
              </div>

              <div ref={reportRef} className="space-y-4 bg-background p-3 rounded-lg">
                <div className="text-center pb-2 border-b border-border">
                  <div className="font-display text-2xl text-foreground">Day Optimizer Report</div>
                  <div className="text-xs font-body text-muted-foreground">
                    {primaryPark}{hopUsed ? ` + ${hopPark}` : ""} · {month} · {crowd} crowds · {hours}h
                  </div>
                </div>
                {/* Summary */}
                <div className="bg-card rounded-lg border border-border p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center">
                    <div className="text-xs font-body text-muted-foreground">Total Rides</div>
                    <div className="text-3xl font-display text-secondary">{totalRides}</div>
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
              </div>

              {/* Per-slot summary */}
              <div className="bg-card rounded-lg border border-border overflow-hidden">
                <div className="bg-primary/10 px-4 py-2 border-b border-border">
                  <h3 className="font-display text-lg text-foreground">📊 Per-Slot Summary</h3>
                </div>
                <div className="divide-y divide-border">
                  {SLOT_ORDER.map((slot) => {
                    const rows = groupedReport[slot];
                    const count = rows.length;
                    const total = rows.reduce((s, r) => s + r.expectedWait, 0);
                    const avg = count > 0 ? Math.round(total / count) : 0;
                    return (
                      <div key={`sum-${slot}`} className="px-4 py-2 flex items-center gap-2 text-sm font-body">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-foreground truncate">
                            {SLOT_ICONS[slot]} {SLOT_LABELS[slot]}
                          </div>
                          <div className="text-xs text-muted-foreground">
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
                  <div className="bg-card rounded-lg border border-border overflow-hidden">
                    <div className="bg-primary/10 px-4 py-2 border-b border-border">
                      <h3 className="font-display text-lg text-foreground">📈 Wait Time by Slot</h3>
                    </div>
                    <div className="p-4 space-y-3">
                      {slotTotals.map(({ slot, total }) => {
                        const pct = (total / maxTotal) * 100;
                        return (
                          <div key={`bar-${slot}`} className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-body">
                              <span className="font-semibold text-foreground">
                                {SLOT_ICONS[slot]} {SLOT_LABELS[slot]}
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
                  <div className="bg-card rounded-lg border border-border overflow-hidden">
                    <div className="bg-primary/10 px-4 py-2 border-b border-border">
                      <h3 className="font-display text-lg text-foreground">📊 Ride Contribution by Slot</h3>
                      <p className="text-xs font-body text-muted-foreground">
                        Each segment = one ride's expected wait
                      </p>
                    </div>
                    <div className="p-4 space-y-4">
                      {slotData.map(({ slot, rows, total }) => {
                        const slotPct = (total / maxTotal) * 100;
                        return (
                          <div key={`stack-${slot}`} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-body">
                              <span className="font-semibold text-foreground">
                                {SLOT_ICONS[slot]} {SLOT_LABELS[slot]}
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
                                    className="flex items-center gap-1.5 text-[11px] font-body text-muted-foreground"
                                  >
                                    <span
                                      className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                                      style={{ backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
                                    />
                                    <span className="truncate max-w-[140px]">{r.rideName}</span>
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
                return (
                  <div key={slot} className="bg-card rounded-lg border border-border overflow-hidden">
                    <div className="bg-primary/10 px-4 py-2 border-b border-border">
                      <h3 className="font-display text-lg text-foreground">
                        {SLOT_ICONS[slot]} {SLOT_LABELS[slot]}
                      </h3>
                    </div>
                    <div className="divide-y divide-border">
                      {rows.map((r) => (
                        <div key={`${slot}-${r.rideId}`} className="px-4 py-2 flex items-center gap-2 text-sm font-body">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-foreground truncate">{r.rideName}</div>
                            <div className="text-xs text-muted-foreground truncate">
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
              <div className="text-4xl mb-2">🎢</div>
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
