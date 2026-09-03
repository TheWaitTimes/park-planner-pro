import { useReducer, useState, useEffect, useMemo, useRef } from "react";
import {
  Castle, Globe, Clapperboard, Trees, CloudRain, Download, type LucideIcon,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  simulationReducer,
  initialSimulationState,
} from "@/simulation/simulationReducer";
import { PARKS } from "@/data/parks";
import { getHopTime, getWalkingTime, RAIN_CLOSURE_CHANCE, capWait } from "@/lib/parkModel";


function getTimeOfDay(date: Date): "morning" | "afternoon" | "evening" {
  const hour = date.getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function formatTime(time: Date | null): string {
  if (!time) return "";
  return time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function randomWait(min: number, max: number): number {
  const values: number[] = [];
  for (let i = min; i <= max; i += 5) values.push(i);
  return values[Math.floor(Math.random() * values.length)];
}

function formatHourToEST(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:00 ${period}`;
}

const PARK_OPTIONS: { name: string; icon: LucideIcon }[] = [
  { name: "Magic Kingdom", icon: Castle },
  { name: "EPCOT", icon: Globe },
  { name: "Hollywood Studios", icon: Clapperboard },
  { name: "Animal Kingdom", icon: Trees },
];

// Travel / walking / weather model is shared with the Day Optimizer.


export default function DaySimulator({ initialPark }: { initialPark?: string } = {}) {
  const [state, dispatch] = useReducer(simulationReducer, initialSimulationState);
  const [startPark, setStartPark] = useState(
    initialPark && PARKS[initialPark] ? initialPark : "Magic Kingdom",
  );

  useEffect(() => {
    if (initialPark && PARKS[initialPark]) setStartPark(initialPark);
  }, [initialPark]);

  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(21);
  const [crowdLevel, setCrowdLevel] = useState("Moderate");
  const [weatherChance, setWeatherChance] = useState(0);
  const [restMinutes, setRestMinutes] = useState(15);
  const [pendingRide, setPendingRide] = useState<{ id: string; name: string; waitTime: number; onRideTime: number; parkArea: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<
    | { kind: "break"; id: "rest" | "explore" | "shop"; label: string; name: string; minutes: number }
    | { kind: "hop"; targetPark: string; travelTime: number }
    | null
  >(null);

  const crowdModifier = crowdLevel === "Light" ? -20 : crowdLevel === "Heavy" ? 20 : 0;
  const currentParkName = state.selectedParks[state.currentParkIndex];
  const currentPark = PARKS[currentParkName];
  const totalWait = state.completedRides.reduce((sum, r) => sum + r.waitTime, 0);
  const totalOnRide = state.completedRides.reduce(
    (sum, r) => sum + (r.kind === "action" ? 0 : r.onRideTime),
    0,
  );
  const totalWalking = state.completedRides.reduce((sum, r) => sum + (r.walkingTime ?? 0), 0);
  const totalBreak = state.completedRides.reduce(
    (sum, r) => sum + (r.kind === "action" ? r.onRideTime : 0),
    0,
  );
  const rideCount = state.completedRides.filter((r) => r.kind === "ride").length;
  const parkHopCount = Math.max(0, state.selectedParks.length - 1);
  const distinctParkCount = new Set(state.selectedParks).size;
  const minutesRemaining =
    state.currentTime && state.endTime
      ? Math.max(0, Math.round((state.endTime.getTime() - state.currentTime.getTime()) / 60000))
      : 0;
  const timeInvalid = endHour <= startHour;

  // Track ride counts and last area visited (for walking-time & recommendation logic)
  const ridesRiddenCount = useMemo(() => {
    const map: Record<string, number> = {};
    state.completedRides.forEach((r) => {
      map[r.rideId] = (map[r.rideId] ?? 0) + 1;
    });
    return map;
  }, [state.completedRides]);

  const lastArea = useMemo(() => {
    for (let i = state.completedRides.length - 1; i >= 0; i--) {
      const r = state.completedRides[i];
      if (r.visitIndex === state.currentParkIndex && r.parkArea) return r.parkArea;
    }
    return null;
  }, [state.completedRides, state.currentParkIndex]);

  const timeOfDay = state.currentTime ? getTimeOfDay(state.currentTime) : "morning";

  // Which weather-sensitive rides are actually down for THIS storm.
  // Re-rolled once per storm, not on every clock tick.
  const closedRideIds = useMemo(() => {
    if (!state.weatherActive || !currentPark) return new Set<string>();
    const down = new Set<string>();
    currentPark.rides.forEach((ride) => {
      if (ride.weatherEffect === 1 && Math.random() < RAIN_CLOSURE_CHANCE) down.add(ride.id);
    });
    return down;
  }, [state.weatherActive, state.weatherEventCount, currentParkName]);

  // Waits are re-quoted every time the clock advances, so posted times shift
  // as the day moves along.
  const ridesWithWaits = useMemo(() => {
    if (!currentPark) return [];
    return currentPark.rides.map((ride) => {
      const [baseLo, baseHi] = ride.waitTimes[timeOfDay];
      let min = capWait(baseLo + crowdModifier);
      let max = capWait(Math.max(min, baseHi + crowdModifier));
      const waitTime = randomWait(min, max);
      const closed = closedRideIds.has(ride.id);
      return { ...ride, waitTime, min, closed };
    });
  }, [timeOfDay, closedRideIds, currentParkName, crowdModifier, state.currentTime]);



  useEffect(() => {
    if (state.status === "active") {
      dispatch({ type: "CHECK_WEATHER" });
    }
  }, [state.currentTime, state.status]);


  const handleStartSimulation = () => {
    if (timeInvalid) return;
    const windowMinutes = Math.max(1, (endHour - startHour) * 60);
    let weatherStartTime: Date | null = null;
    let weatherClearTime: Date | null = null;
    if (Math.random() * 100 < weatherChance) {
      const randomMinute = Math.floor(Math.random() * windowMinutes);
      weatherStartTime = new Date(`2026-01-21T${String(startHour).padStart(2, "0")}:00:00`);
      weatherStartTime.setMinutes(weatherStartTime.getMinutes() + randomMinute);
      const clearMinutes = 45 + Math.floor(Math.random() * 120);
      weatherClearTime = new Date(weatherStartTime);
      weatherClearTime.setMinutes(weatherClearTime.getMinutes() + clearMinutes);
    }
    dispatch({
      type: "START_SIMULATION",
      payload: {
        selectedParks: [startPark],
        startTime: new Date(`2026-01-21T${String(startHour).padStart(2, "0")}:00:00`),
        endTime: new Date(`2026-01-21T${String(endHour).padStart(2, "0")}:00:00`),
        weatherStartTime,
        weatherClearTime,
        weatherChance,
      },
    });
  };

  // Group rides by park VISIT (so revisits render as separate sections chronologically)
  const groupedVisits: { key: string; park: string; rides: typeof state.completedRides }[] = [];
  state.completedRides.forEach((ride) => {
    const last = groupedVisits[groupedVisits.length - 1];
    if (last && last.key === `${ride.visitIndex}-${ride.park}`) {
      last.rides.push(ride);
    } else {
      groupedVisits.push({
        key: `${ride.visitIndex}-${ride.park}`,
        park: ride.park,
        rides: [ride],
      });
    }
  });

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const totalSimMinutes = state.completedRides.reduce(
      (sum, r) => sum + r.waitTime + r.onRideTime + (r.walkingTime ?? 0),
      0,
    );
    const generatedAt = new Date().toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    });
    const firstStart = state.completedRides[0]?.timeStarted ?? state.currentTime;
    const lastEnd =
      state.completedRides[state.completedRides.length - 1]?.timeFinished ?? state.currentTime;
    const simDateStr = firstStart
      ? firstStart.toLocaleDateString([], { dateStyle: "long" } as Intl.DateTimeFormatOptions)
      : "—";
    const simWindowStr =
      firstStart && lastEnd
        ? `${formatTime(firstStart)} – ${formatTime(lastEnd)}`
        : "—";

    const margin = 14;
    const contentWidth = pageWidth - margin * 2;

    // ---------- COVER PAGE ----------
    let cy = 60;
    doc.setFontSize(28);
    doc.setTextColor(20, 30, 70);
    doc.text("Disney Day Itinerary", pageWidth / 2, cy, { align: "center" });
    cy += 10;
    doc.setFontSize(12);
    doc.setTextColor(110);
    doc.text("Theme Park Data Hub", pageWidth / 2, cy, { align: "center" });

    cy += 30;
    doc.setDrawColor(200);
    doc.line(30, cy, pageWidth - 30, cy);
    cy += 14;

    const label = (l: string, v: string) => {
      const labelText = l.toUpperCase();
      doc.setFontSize(11);
      doc.setTextColor(120);
      doc.text(labelText, 40, cy);
      // Reserve space for the label so the value can wrap if it's long.
      doc.setFontSize(13);
      doc.setTextColor(30);
      const labelWidth = doc.getTextWidth(labelText);
      const valueMaxWidth = pageWidth - 40 - (40 + labelWidth + 8);
      const lines = doc.splitTextToSize(v, Math.max(40, valueMaxWidth));
      doc.text(lines, pageWidth - 40, cy, { align: "right" });
      const lineHeight = 6;
      cy += Math.max(12, lines.length * lineHeight + 4);
    };

    label("Parks Visited", state.selectedParks.join(" → ") || "—");
    label("Simulated Date", simDateStr);
    label("Simulated Window", simWindowStr);
    label("Total Simulated Minutes", `${totalSimMinutes} min`);
    label("Total Wait Time", `${totalWait} min`);
    label("Total Activities", `${state.completedRides.length}`);

    cy += 8;
    doc.setDrawColor(200);
    doc.line(30, cy, pageWidth - 30, cy);

    doc.setFontSize(10);
    doc.setTextColor(140);
    doc.text(`Generated ${generatedAt}`, pageWidth / 2, pageHeight - 20, { align: "center" });

    // ---------- ITINERARY ----------
    doc.addPage();
    let y = 20;
    doc.setFontSize(18);
    doc.setTextColor(20, 30, 70);
    doc.text("Activity Timeline", pageWidth / 2, y, { align: "center" });
    y += 12;

    const lineHeight = 5;
    const bottomLimit = pageHeight - 20;

    groupedVisits.forEach(({ park, rides }) => {
      if (y > bottomLimit - 20) { doc.addPage(); y = 20; }
      doc.setFontSize(14);
      doc.setTextColor(30, 60, 120);
      doc.text(park, margin, y);
      y += 7;
      doc.setFontSize(10);
      doc.setTextColor(40);
      rides.forEach((ride) => {
        const isAction = ride.kind === "action";
        const totalMin = ride.waitTime + ride.onRideTime;
        const detail = isAction ? `${totalMin} min` : `${ride.waitTime}m wait · ${ride.onRideTime}m ride`;
        const time = `${formatTime(ride.timeStarted)} – ${formatTime(ride.timeFinished)}`;
        const text = `${time}  ${ride.rideName}  (${detail})`;
        const lines = doc.splitTextToSize(text, contentWidth - 4);
        const blockHeight = lines.length * lineHeight;
        if (y + blockHeight > bottomLimit) { doc.addPage(); y = 20; }
        doc.text(lines, margin + 4, y);
        y += blockHeight + 1;
      });
      y += 4;
    });

    doc.save("disney-itinerary.pdf");
  };

  const [exportingPDF, setExportingPDF] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  const handleExportSummaryScreenshot = async () => {
    const node = summaryRef.current;
    if (!node) return;
    setExportingPDF(true);
    try {
      await document.fonts.ready;
      const bg = getComputedStyle(document.body).backgroundColor || "#ffffff";
      const canvas = await html2canvas(node, {
        backgroundColor: bg,
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 24;
      const imgW = pageW - margin * 2;
      const imgH = (canvas.height * imgW) / canvas.width;
      const imgData = canvas.toDataURL("image/png");
      const usableH = pageH - margin * 2;

      if (imgH <= usableH) {
        doc.addImage(imgData, "PNG", margin, margin, imgW, imgH);
      } else {
        // Slice the tall screenshot across pages.
        const pxPerPage = (usableH * canvas.width) / imgW;
        let offset = 0;
        let first = true;
        while (offset < canvas.height) {
          const sliceH = Math.min(pxPerPage, canvas.height - offset);
          const slice = document.createElement("canvas");
          slice.width = canvas.width;
          slice.height = sliceH;
          const ctx = slice.getContext("2d");
          if (!ctx) break;
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, slice.width, slice.height);
          ctx.drawImage(canvas, 0, offset, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
          if (!first) doc.addPage();
          doc.addImage(
            slice.toDataURL("image/png"),
            "PNG",
            margin,
            margin,
            imgW,
            (sliceH * imgW) / canvas.width,
          );
          first = false;
          offset += sliceH;
        }
      }
      doc.save("day-summary.pdf");
    } finally {
      setExportingPDF(false);
    }
  };





  // ENDED STATE
  if (state.status === "ended") {
    return (
      <div className="max-w-4xl mx-auto">
        <div ref={summaryRef} className="bg-background p-4 rounded-lg">
        <h1 className="text-3xl md:text-4xl text-foreground mb-6 font-semibold tracking-tight">Day Summary</h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <div className="bg-card rounded-lg p-4 sm:p-5 border border-border col-span-2">
            <div className="text-muted-foreground text-sm font-body">Parks Visited</div>
            <div className="text-lg sm:text-2xl font-display text-foreground break-words">{state.selectedParks.join(" → ")}</div>
          </div>
          <div className="bg-card rounded-lg p-4 sm:p-5 border border-border">
            <div className="text-muted-foreground text-sm font-body">Total Rides</div>
            <div className="text-3xl sm:text-4xl font-display text-secondary">{rideCount}</div>
          </div>
          <div className="bg-card rounded-lg p-4 sm:p-5 border border-border">
            <div className="text-muted-foreground text-sm font-body">Ended At</div>
            <div className="text-2xl sm:text-4xl font-display text-secondary">{formatTime(state.currentTime)}</div>
          </div>
          <div className="bg-card rounded-lg p-4 border border-border">
            <div className="text-muted-foreground text-xs font-body uppercase tracking-wide">Wait</div>
            <div className="text-xl sm:text-2xl font-display text-foreground">{totalWait} min</div>
          </div>
          <div className="bg-card rounded-lg p-4 border border-border">
            <div className="text-muted-foreground text-xs font-body uppercase tracking-wide">On-Ride</div>
            <div className="text-xl sm:text-2xl font-display text-foreground">{totalOnRide} min</div>
          </div>
          <div className="bg-card rounded-lg p-4 border border-border">
            <div className="text-muted-foreground text-xs font-body uppercase tracking-wide">Walking / Travel</div>
            <div className="text-xl sm:text-2xl font-display text-foreground">{totalWalking + state.totalTravelMinutes} min</div>
          </div>
          <div className="bg-card rounded-lg p-4 border border-border">
            <div className="text-muted-foreground text-xs font-body uppercase tracking-wide">Hops · Weather</div>
            <div className="text-xl sm:text-2xl font-display text-foreground">{parkHopCount} · {state.weatherEventCount}</div>
            <div className="text-xs font-body text-muted-foreground mt-1">{distinctParkCount} distinct park{distinctParkCount !== 1 ? "s" : ""}</div>
          </div>
        </div>


        <h2 className="text-2xl sm:text-3xl text-foreground mb-4">Timeline</h2>
        {groupedVisits.map(({ key, park, rides }) => (
          <div key={key} className="mb-6">
            <h3 className="text-xl sm:text-2xl text-secondary mb-2">{park}</h3>
            <div className="space-y-1">
              {rides.map((ride, i) => {
                const isAction = ride.kind === "action";
                const totalMin = ride.waitTime + ride.onRideTime;
                return (
                  <div key={i} className={`flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 text-xs sm:text-sm font-body rounded px-3 py-2 border ${isAction ? "bg-secondary/5 border-secondary/30" : "bg-card border-border"}`}>
                    <span className="text-muted-foreground sm:w-32 shrink-0">
                      {formatTime(ride.timeStarted)} – {formatTime(ride.timeFinished)}
                    </span>
                    <span className={`font-semibold break-words ${isAction ? "text-secondary" : "text-foreground"}`}>{ride.rideName}</span>
                    <span className="text-muted-foreground sm:ml-auto">
                      {isAction ? `${totalMin} min` : `${ride.waitTime} min wait · ${ride.onRideTime} min ride`}
                    </span>
                  </div>
                );
              })}

            </div>
          </div>
        ))}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row sm:flex-wrap gap-3">
          <button
            className="w-full sm:w-auto bg-secondary text-secondary-foreground font-display text-lg sm:text-xl px-8 py-3 min-h-[48px] rounded-lg hover:opacity-90 transition"
            onClick={() => dispatch({ type: "RESET_SIMULATION" })}
          >
            Start New Day
          </button>
          <button
            onClick={handleExportSummaryScreenshot}
            disabled={state.completedRides.length === 0 || exportingPDF}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-secondary text-secondary font-display text-lg sm:text-xl px-8 py-3 min-h-[48px] rounded-lg hover:bg-secondary/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-5 h-5" />
            {exportingPDF ? "Exporting…" : "Export PDF"}
          </button>


        </div>
      </div>
    );
  }

  // SETUP STATE
  if (state.status === "setup") {
    return (
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl md:text-4xl text-foreground mb-8 font-semibold tracking-tight">Disney Day Simulator</h1>
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Park Selection */}
          <div className="flex-1">
            <h2 className="text-lg text-foreground mb-4 font-semibold">Select Your Park</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {PARK_OPTIONS.map((park) => {
                const Icon = park.icon;
                const isActive = startPark === park.name;
                return (
                  <button
                    key={park.name}
                    onClick={() => setStartPark(park.name)}
                    className={`text-center p-5 rounded-lg border transition-all cursor-pointer ${
                      isActive
                        ? "border-secondary bg-secondary/5 shadow-sm"
                        : "border-border bg-card hover:border-secondary/40"
                    }`}
                  >
                    <Icon className={`w-7 h-7 mx-auto mb-2 ${isActive ? "text-secondary" : "text-muted-foreground"}`} strokeWidth={1.75} />
                    <div className="font-body text-sm font-medium text-foreground">{park.name}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Settings */}
          <div className="w-full lg:w-80 bg-card rounded-lg p-6 border border-border">
            <h3 className="text-2xl font-display text-foreground mb-4">Advanced Settings</h3>

            <label className="block mb-4">
              <span className="text-sm font-body font-semibold text-foreground">Start Time: {formatHourToEST(startHour)}</span>
              <input type="range" min="7" max="22" value={startHour} onChange={(e) => setStartHour(Number(e.target.value))}
                className="w-full mt-1 accent-secondary" />
            </label>

            <label className="block mb-4">
              <span className="text-sm font-body font-semibold text-foreground">End Time: {formatHourToEST(endHour)}</span>
              <input type="range" min="10" max="23" value={endHour} onChange={(e) => setEndHour(Number(e.target.value))}
                className="w-full mt-1 accent-secondary" />
            </label>

            <div className="mb-4">
              <span className="text-sm font-body font-semibold text-foreground block mb-2">Crowd Level</span>
              <div className="flex gap-2">
                {(["Light", "Moderate", "Heavy"] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setCrowdLevel(level)}
                    className={`flex-1 py-2 rounded-md text-sm font-body font-semibold transition ${
                      crowdLevel === level
                        ? "bg-secondary text-secondary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <label className="block mb-6">
              <span className="text-sm font-body font-semibold text-foreground">Weather Risk: {weatherChance}%</span>
              <input type="range" min="0" max="100" value={weatherChance} onChange={(e) => setWeatherChance(Number(e.target.value))}
                className="w-full mt-1 accent-secondary" />
            </label>

            {timeInvalid && (
              <p className="text-xs font-body text-destructive mb-2">
                End time must be after start time.
              </p>
            )}
            <button
              onClick={handleStartSimulation}
              disabled={timeInvalid}
              className="w-full bg-secondary text-secondary-foreground font-display text-xl py-3 rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Enter Park
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE STATE
  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl text-foreground font-semibold tracking-tight">{currentParkName}</h1>
        <span className="bg-secondary/15 text-secondary font-body font-semibold text-sm px-3 py-1 rounded-full">
          {formatTime(state.currentTime)}
        </span>
      </div>

      {/* Weather Alert */}
      {state.weatherActive && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg p-4 mb-6">
          <div className="font-display text-base font-semibold inline-flex items-center gap-2">
            <CloudRain className="w-4 h-4" strokeWidth={2} />
            Bad Weather until: {formatTime(state.weatherClearTime)}
          </div>
          <div className="text-sm font-body mt-1">
            Closed rides: {ridesWithWaits.filter((r) => r.closed).map((r) => r.name).join(", ") || "None — every attraction is still running"}
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Ride Selection */}
        <div className="flex-1">
          <h2 className="text-2xl text-foreground mb-3">Choose a Ride</h2>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
            {ridesWithWaits
              .slice()
              .sort((a, b) => a.parkArea.localeCompare(b.parkArea))
              .map((ride) => {
                const riddenCount = ridesRiddenCount[ride.id] ?? 0;
                const disabled = ride.closed;
                const walk = getWalkingTime(lastArea, ride.parkArea);
                const wontFinish =
                  !disabled && ride.waitTime + ride.onRideTime + walk > minutesRemaining;
                return (
                  <button
                    key={ride.id}
                    disabled={disabled}
                    onClick={() =>
                      setPendingRide({
                        id: ride.id,
                        name: ride.name,
                        waitTime: ride.waitTime,
                        onRideTime: ride.onRideTime,
                        parkArea: ride.parkArea,
                      })
                    }
                    className={`w-full text-left px-3 sm:px-4 py-3 min-h-[56px] rounded-lg border transition font-body text-sm flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 ${
                      disabled
                        ? "border-border bg-muted/40 text-muted-foreground cursor-not-allowed opacity-60"
                        : wontFinish
                          ? "border-destructive/40 bg-destructive/5 hover:border-destructive/60"
                          : riddenCount > 0
                            ? "border-border bg-card opacity-70 hover:opacity-100 hover:border-secondary/40"
                            : "border-border bg-card hover:border-secondary/40"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold text-foreground block sm:inline break-words">
                        {ride.name}
                      </span>
                      <span className="text-muted-foreground text-xs sm:text-sm block sm:inline sm:before:content-['·'] sm:before:mx-2">
                        {ride.parkArea}
                      </span>
                      {riddenCount > 0 && !disabled && (
                        <span className="ml-0 sm:ml-2 mt-1 sm:mt-0 inline-block text-[11px] font-body text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          Ridden ×{riddenCount}
                        </span>
                      )}
                      {wontFinish && (
                        <span className="ml-0 sm:ml-2 mt-1 sm:mt-0 inline-block text-[11px] font-body text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                          Won't finish before close
                        </span>
                      )}
                    </span>
                    <span className="text-muted-foreground text-xs sm:text-sm shrink-0 sm:text-right">
                      {disabled ? (
                        <span className="inline-flex items-center gap-1 text-destructive">
                          <CloudRain className="w-3.5 h-3.5" /> Closed
                          {state.weatherClearTime && ` · reopens ${formatTime(state.weatherClearTime)}`}
                        </span>
                      ) : (
                        <>
                          {ride.waitTime}m wait · {ride.onRideTime}m ride
                        </>
                      )}
                    </span>
                  </button>

                );

              })}
          </div>

          {/* Park Hop */}
          <h3 className="text-xl text-foreground mt-6 mb-2">Park Hop To</h3>
          <div className="flex flex-wrap gap-2">
            {Object.keys(PARKS)
              .filter((park) => park !== currentParkName)
              .map((park) => {
                const travelTime = getHopTime(currentParkName, park);
                return (
                  <button
                    key={park}
                    onClick={() => setPendingAction({ kind: "hop", targetPark: park, travelTime })}
                    className="bg-primary text-primary-foreground font-display text-base px-4 py-2 min-h-[48px] rounded-lg hover:opacity-90 transition inline-flex flex-col items-start justify-center flex-1 sm:flex-none min-w-[45%]"
                  >
                    <span>{park}</span>
                    <span className="text-xs opacity-80 font-body">{travelTime} min travel</span>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-72">
          {/* Break */}
          <div className="bg-card rounded-lg p-4 border border-border mb-4">
            <h3 className="font-display text-xl text-foreground mb-2">Take a Break, Explore the park, Hop into a gift shop!</h3>
            <div className="flex items-center gap-2 mb-3">
              <input type="range" min="15" max="240" step="15" value={restMinutes}
                onChange={(e) => setRestMinutes(Number(e.target.value))}
                className="flex-1 accent-secondary" />
              <span className="text-sm font-body text-muted-foreground w-16 text-right">{restMinutes} min</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {([
                { id: "rest", label: "Rest", name: "Rest Break" },
                { id: "explore", label: "Explore the Park", name: "Explored Park" },
                { id: "shop", label: "Hop into a Gift Shop", name: "Gift Shop Visit" },
              ] as const).map((action) => (
                <button
                  key={action.id}
                  onClick={() =>
                    setPendingAction({
                      kind: "break",
                      id: action.id,
                      label: action.label,
                      name: action.name,
                      minutes: restMinutes,
                    })
                  }
                  className="w-full bg-muted text-foreground font-display text-base py-2 rounded-lg hover:bg-secondary/15 hover:text-secondary transition flex items-center justify-between px-4"
                >
                  <span>{action.label}</span>
                  <span className="text-sm font-body text-muted-foreground">{restMinutes}m</span>
                </button>
              ))}
            </div>
          </div>

          {/* Day Summary */}
          <div className="bg-card rounded-lg p-4 border border-border mb-4">
            <h3 className="font-display text-xl text-foreground mb-3">Day Summary</h3>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm font-body">
              <dt className="text-muted-foreground">Wait time</dt>
              <dd className="text-right font-semibold text-foreground">{totalWait} min</dd>
              <dt className="text-muted-foreground">On-ride time</dt>
              <dd className="text-right font-semibold text-foreground">{totalOnRide} min</dd>
              <dt className="text-muted-foreground">Walking</dt>
              <dd className="text-right font-semibold text-foreground">{totalWalking} min</dd>
              <dt className="text-muted-foreground">Park-hop travel</dt>
              <dd className="text-right font-semibold text-foreground">{state.totalTravelMinutes} min</dd>
              <dt className="text-muted-foreground">Breaks / explore</dt>
              <dd className="text-right font-semibold text-foreground">{totalBreak} min</dd>
              <dt className="text-muted-foreground">Park hops</dt>
              <dd className="text-right font-semibold text-foreground">
                {parkHopCount} ({distinctParkCount} park{distinctParkCount !== 1 ? "s" : ""})
              </dd>
              <dt className="text-muted-foreground">Weather events</dt>
              <dd className="text-right font-semibold text-foreground">
                {state.weatherEventCount}{state.weatherActive ? " (active)" : ""}
              </dd>
              <dt className="text-muted-foreground border-t border-border pt-2 mt-1">Current time</dt>
              <dd className="text-right font-semibold text-secondary border-t border-border pt-2 mt-1">
                {formatTime(state.currentTime)}
              </dd>
              <dt className="text-muted-foreground">Park closes</dt>
              <dd className="text-right font-semibold text-foreground">{formatTime(state.endTime)}</dd>
            </dl>
          </div>

          {/* Activity Timeline */}
          <div className="bg-card rounded-lg p-4 border border-border mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display text-xl text-foreground">Activity Timeline</h3>
              <button
                onClick={handleExportPDF}
                disabled={state.completedRides.length === 0}
                className="inline-flex items-center gap-1 text-xs font-body font-semibold text-secondary hover:text-secondary/80 disabled:text-muted-foreground disabled:cursor-not-allowed transition"
                title="Export itinerary as PDF"
              >
                <Download className="w-3.5 h-3.5" />
                Export PDF
              </button>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto text-sm font-body">
              {groupedVisits.map(({ key, park, rides }) => (
                <div key={key}>
                  <div className="font-semibold text-secondary mb-1">{park}</div>
                  {rides.map((ride, i) => {
                    const isAction = ride.kind === "action";
                    const totalMin = ride.waitTime + ride.onRideTime;
                    return (
                      <div key={i} className={`ml-2 ${isAction ? "text-secondary" : "text-muted-foreground"}`}>
                        {formatTime(ride.timeStarted)} – {ride.rideName} ({isAction ? `${totalMin}m` : `${ride.waitTime}m wait`})
                      </div>
                    );
                  })}
                </div>
              ))}
              {state.completedRides.length === 0 && (
                <div className="text-muted-foreground italic">No activity yet</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ride Confirmation Modal */}
      {pendingRide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          onClick={() => setPendingRide(null)}
        >
          <div
            className="bg-card rounded-lg border border-border shadow-xl max-w-sm w-full p-5 sm:p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-2xl text-foreground mb-1">Confirm Ride</h3>
            <p className="text-sm font-body text-muted-foreground mb-4">
              Ready to ride this attraction?
            </p>
            {(() => {
              const walkingTime = getWalkingTime(lastArea, pendingRide.parkArea);
              const totalMin = pendingRide.waitTime + pendingRide.onRideTime + walkingTime;
              const finishTime = state.currentTime
                ? new Date(state.currentTime.getTime() + totalMin * 60000)
                : null;
              const overshoot =
                !!state.endTime && !!finishTime && finishTime > state.endTime;
              return (
                <>
                  <div className="bg-secondary/5 border border-secondary/30 rounded-lg p-4 mb-5">
                    <div className="text-xs font-body text-muted-foreground uppercase tracking-wide mb-1">
                      {pendingRide.parkArea}
                    </div>
                    <div className="font-display text-lg text-foreground mb-3">{pendingRide.name}</div>
                    <div className="flex justify-between text-sm font-body">
                      <span className="text-muted-foreground">Walk</span>
                      <span className="font-semibold text-foreground">{walkingTime} min</span>
                    </div>
                    <div className="flex justify-between text-sm font-body">
                      <span className="text-muted-foreground">Wait Time</span>
                      <span className="font-semibold text-foreground">{pendingRide.waitTime} min</span>
                    </div>
                    <div className="flex justify-between text-sm font-body">
                      <span className="text-muted-foreground">Ride Time</span>
                      <span className="font-semibold text-foreground">{pendingRide.onRideTime} min</span>
                    </div>
                    <div className="border-t border-border mt-2 pt-2 flex justify-between text-sm font-body">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-semibold text-secondary">{totalMin} min</span>
                    </div>
                  </div>
                  {overshoot && (
                    <div className="mb-4 text-xs font-body text-destructive bg-destructive/10 border border-destructive/30 rounded p-2">
                      Heads up: this ride will finish at {formatTime(finishTime)}, after your day ends.
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPendingRide(null)}
                      className="flex-1 bg-muted text-foreground font-display text-base py-3 min-h-[48px] rounded-lg hover:bg-muted/80 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        dispatch({
                          type: "COMPLETE_RIDE",
                          payload: {
                            rideId: pendingRide.id,
                            rideName: pendingRide.name,
                            parkArea: pendingRide.parkArea,
                            waitTime: pendingRide.waitTime,
                            onRideTime: pendingRide.onRideTime,
                            walkingTime,
                          },
                        });
                        setPendingRide(null);
                      }}
                      className="flex-1 bg-secondary text-secondary-foreground font-display text-base py-3 min-h-[48px] rounded-lg hover:opacity-90 transition"
                    >
                      Confirm
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Action / Park-Hop Confirmation Modal */}
      {pendingAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          onClick={() => setPendingAction(null)}
        >
          <div
            className="bg-card rounded-lg border border-border shadow-xl max-w-sm w-full p-5 sm:p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-2xl text-foreground mb-1">
              {pendingAction.kind === "hop" ? "Confirm Park Hop" : "Confirm Activity"}
            </h3>
            <p className="text-sm font-body text-muted-foreground mb-4">
              {pendingAction.kind === "hop"
                ? "Travel to a different park?"
                : "Spend this time on a non-ride activity?"}
            </p>
            <div className="bg-secondary/5 border border-secondary/30 rounded-lg p-4 mb-5">
              {pendingAction.kind === "hop" ? (
                <>
                  <div className="text-xs font-body text-muted-foreground uppercase tracking-wide mb-1">
                    Park Hop
                  </div>
                  <div className="font-display text-lg text-foreground mb-3">
                    {currentParkName} → {pendingAction.targetPark}
                  </div>
                  <div className="flex justify-between text-sm font-body">
                    <span className="text-muted-foreground">Travel Time</span>
                    <span className="font-semibold text-foreground">{pendingAction.travelTime} min</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xs font-body text-muted-foreground uppercase tracking-wide mb-1">
                    {currentParkName}
                  </div>
                  <div className="font-display text-lg text-foreground mb-3">{pendingAction.label}</div>
                  <div className="flex justify-between text-sm font-body">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-semibold text-secondary">{pendingAction.minutes} min</span>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPendingAction(null)}
                className="flex-1 bg-muted text-foreground font-display text-base py-3 min-h-[48px] rounded-lg hover:bg-muted/80 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (pendingAction.kind === "hop") {
                    dispatch({
                      type: "PARK_HOP",
                      payload: { travelTime: pendingAction.travelTime, targetPark: pendingAction.targetPark },
                    });
                  } else {
                    dispatch({
                      type: "COMPLETE_RIDE",
                      payload: {
                        kind: "action",
                        rideId: pendingAction.id,
                        rideName: pendingAction.name,
                        waitTime: 0,
                        onRideTime: pendingAction.minutes,
                        walkingTime: 0,
                      },
                    });
                  }
                  setPendingAction(null);
                }}
                className="flex-1 bg-secondary text-secondary-foreground font-display text-base py-3 min-h-[48px] rounded-lg hover:opacity-90 transition"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
