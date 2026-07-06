import { useReducer, useState, useEffect, useMemo } from "react";
import {
  Castle, Globe, Clapperboard, Trees, CloudRain, Star, Download, type LucideIcon,
} from "lucide-react";
import jsPDF from "jspdf";
import {
  simulationReducer,
  initialSimulationState,
} from "@/simulation/simulationReducer";
import { PARKS } from "@/data/parks";

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

const PARK_HOP_TIMES: Record<string, Record<string, number>> = {
  "Magic Kingdom": { EPCOT: 25, "Hollywood Studios": 35, "Animal Kingdom": 45 },
  EPCOT: { "Magic Kingdom": 25, "Hollywood Studios": 15, "Animal Kingdom": 30 },
  "Hollywood Studios": { "Magic Kingdom": 35, EPCOT: 15, "Animal Kingdom": 25 },
  "Animal Kingdom": { "Magic Kingdom": 45, EPCOT: 30, "Hollywood Studios": 25 },
};

function getHopTime(from: string, to: string): number {
  return PARK_HOP_TIMES[from]?.[to] ?? 30;
}

function getWalkingTime(fromArea: string | null, toArea: string): number {
  if (!fromArea) return 5;
  return fromArea === toArea ? 3 : 7;
}

export default function DaySimulator() {
  const [state, dispatch] = useReducer(simulationReducer, initialSimulationState);
  const [startPark, setStartPark] = useState("Magic Kingdom");
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

  const ridesWithWaits = useMemo(() => {
    if (!currentPark || !state.currentTime) return [];
    const timeOfDay = getTimeOfDay(state.currentTime);
    return currentPark.rides.map((ride) => {
      let [min, max] = ride.waitTimes[timeOfDay];
      min = Math.max(5, min + crowdModifier);
      max = Math.max(min, max + crowdModifier);
      const waitTime = randomWait(min, max);
      const closed = state.weatherActive && ride.weatherEffect === 1;
      return { ...ride, waitTime, min, closed };
    });
  }, [state.currentTime, state.weatherActive, currentParkName, crowdModifier]);

  // Composite score: lower is better. Primary = wait time; walk penalty; ridden penalty; on-ride bonus.
  const recommendedRide = ridesWithWaits.reduce<
    { ride: typeof ridesWithWaits[0]; score: number } | null
  >((best, ride) => {
    if (ride.closed) return best;
    const walkPenalty = lastArea && ride.parkArea !== lastArea ? 6 : 0;
    const riddenPenalty = (ridesRiddenCount[ride.id] ?? 0) * 40;
    const rideValueBonus = ride.onRideTime * 0.4;
    const score = ride.waitTime + walkPenalty + riddenPenalty - rideValueBonus;
    if (!best || score < best.score) return { ride, score };
    return best;
  }, null)?.ride;

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
      const clearMinutes = 60 + Math.floor(Math.random() * 241);
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
        const isAction = ride.rideId === "rest" || ride.rideId === "explore" || ride.rideId === "shop";
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


  // ENDED STATE
  if (state.status === "ended") {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl md:text-4xl text-foreground mb-6 font-semibold tracking-tight">Day Summary</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-card rounded-lg p-5 border border-border">
            <div className="text-muted-foreground text-sm font-body">Parks Visited</div>
            <div className="text-2xl font-display text-foreground">{state.selectedParks.join(" → ")}</div>
          </div>
          <div className="bg-card rounded-lg p-5 border border-border">
            <div className="text-muted-foreground text-sm font-body">Total Rides</div>
            <div className="text-4xl font-display text-secondary">{state.completedRides.length}</div>
          </div>
          <div className="bg-card rounded-lg p-5 border border-border">
            <div className="text-muted-foreground text-sm font-body">Total Wait Time</div>
            <div className="text-4xl font-display text-secondary">{totalWait} min</div>
          </div>
        </div>

        <h2 className="text-3xl text-foreground mb-4">Timeline</h2>
        {groupedVisits.map(({ key, park, rides }) => (
          <div key={key} className="mb-6">
            <h3 className="text-2xl text-secondary mb-2">{park}</h3>
            <div className="space-y-1">
              {rides.map((ride, i) => {
                const isAction = ride.rideId === "rest" || ride.rideId === "explore" || ride.rideId === "shop";
                const totalMin = ride.waitTime + ride.onRideTime;
                return (
                  <div key={i} className={`flex items-center gap-2 text-sm font-body rounded px-3 py-2 border ${isAction ? "bg-secondary/5 border-secondary/30" : "bg-card border-border"}`}>
                    <span className="text-muted-foreground w-32 shrink-0">
                      {formatTime(ride.timeStarted)} – {formatTime(ride.timeFinished)}
                    </span>
                    <span className={`font-semibold ${isAction ? "text-secondary" : "text-foreground"}`}>{ride.rideName}</span>
                    <span className="text-muted-foreground ml-auto">
                      {isAction ? `${totalMin} min` : `${ride.waitTime} min wait · ${ride.onRideTime} min ride`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="bg-secondary text-secondary-foreground font-display text-xl px-8 py-3 rounded-lg hover:opacity-90 transition"
            onClick={() => window.location.reload()}
          >
            Start New Day
          </button>
          <button
            onClick={handleExportPDF}
            disabled={state.completedRides.length === 0}
            className="inline-flex items-center gap-2 border border-secondary text-secondary font-display text-xl px-8 py-3 rounded-lg hover:bg-secondary/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-5 h-5" />
            Export PDF
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

            <button
              onClick={handleStartSimulation}
              className="w-full bg-secondary text-secondary-foreground font-display text-xl py-3 rounded-lg hover:opacity-90 transition"
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
            Closed rides: {currentPark.rides.filter((r) => r.weatherEffect === 1).map((r) => r.name).join(", ")}
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
              .map((ride) => (
                <button
                  key={ride.id}
                  onClick={() =>
                    setPendingRide({
                      id: ride.id,
                      name: ride.name,
                      waitTime: ride.waitTime,
                      onRideTime: ride.onRideTime,
                      parkArea: ride.parkArea,
                    })
                  }
                  className={`w-full text-left px-4 py-3 rounded-lg border transition font-body text-sm ${
                    ride.id === recommendedRide?.id
                      ? "border-secondary bg-secondary/10 shadow-md"
                      : "border-border bg-card hover:border-secondary/40"
                  }`}
                >
                  <span className="text-muted-foreground">{ride.parkArea}</span>
                  <span className="mx-2 text-muted-foreground">—</span>
                  <span className={`font-semibold ${ride.id === recommendedRide?.id ? "text-secondary-foreground" : "text-foreground"}`}>
                    {ride.name}
                  </span>
                  <span className="float-right text-muted-foreground inline-flex items-center gap-1">
                    {ride.waitTime}m wait · {ride.onRideTime}m ride
                    {ride.id === recommendedRide?.id && <Star className="w-3.5 h-3.5 text-secondary fill-secondary" />}
                  </span>
                </button>
              ))}
          </div>

          {/* Park Hop */}
          <h3 className="text-xl text-foreground mt-6 mb-2">Park Hop To</h3>
          <div className="flex flex-wrap gap-2">
            {Object.keys(PARKS)
              .filter((park) => park !== currentParkName)
              .map((park) => (
                <button
                  key={park}
                  onClick={() => setPendingAction({ kind: "hop", targetPark: park, travelTime: 30 })}
                  className="bg-primary text-primary-foreground font-display text-lg px-5 py-2 rounded-lg hover:opacity-90 transition"
                >
                  {park}
                </button>
              ))}
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
              {Object.entries(grouped).map(([park, rides]) => (
                <div key={park}>
                  <div className="font-semibold text-secondary mb-1">{park}</div>
                  {rides.map((ride, i) => {
                    const isAction = ride.rideId === "rest" || ride.rideId === "explore" || ride.rideId === "shop";
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
            className="bg-card rounded-lg border border-border shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-2xl text-foreground mb-1">Confirm Ride</h3>
            <p className="text-sm font-body text-muted-foreground mb-4">
              Ready to ride this attraction?
            </p>
            <div className="bg-secondary/5 border border-secondary/30 rounded-lg p-4 mb-5">
              <div className="text-xs font-body text-muted-foreground uppercase tracking-wide mb-1">
                {pendingRide.parkArea}
              </div>
              <div className="font-display text-lg text-foreground mb-3">{pendingRide.name}</div>
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
                <span className="font-semibold text-secondary">
                  {pendingRide.waitTime + pendingRide.onRideTime} min
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPendingRide(null)}
                className="flex-1 bg-muted text-foreground font-display text-base py-2 rounded-lg hover:bg-muted/80 transition"
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
                      waitTime: pendingRide.waitTime,
                      onRideTime: pendingRide.onRideTime,
                      walkingTime: 5,
                    },
                  });
                  setPendingRide(null);
                }}
                className="flex-1 bg-secondary text-secondary-foreground font-display text-base py-2 rounded-lg hover:opacity-90 transition"
              >
                Confirm
              </button>
            </div>
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
            className="bg-card rounded-lg border border-border shadow-xl max-w-sm w-full p-6"
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
                className="flex-1 bg-muted text-foreground font-display text-base py-2 rounded-lg hover:bg-muted/80 transition"
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
                className="flex-1 bg-secondary text-secondary-foreground font-display text-base py-2 rounded-lg hover:opacity-90 transition"
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
