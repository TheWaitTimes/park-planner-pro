import { useState, useMemo, useCallback } from "react";
import { PARKS } from "@/data/parks";

const PARK_OPTIONS = [
  { name: "Magic Kingdom", icon: "🏰" },
  { name: "EPCOT", icon: "⚪" },
  { name: "Hollywood Studios", icon: "🗼" },
  { name: "Animal Kingdom", icon: "🌳" },
];

type Period = "day" | "evening" | "night";

const PERIOD_LABELS: Record<Period, string> = {
  day: "Day (9 AM – 2 PM)",
  evening: "Evening (2 PM – 7 PM)",
  night: "Night (7 PM – Close)",
};

const PERIOD_ICONS: Record<Period, string> = {
  day: "☀️",
  evening: "🌅",
  night: "🌙",
};

// Map our periods to ride data's time-of-day keys
const PERIOD_TO_WAIT_KEY: Record<Period, "morning" | "afternoon" | "evening"> = {
  day: "morning",
  evening: "afternoon",
  night: "evening",
};

// Hour boundaries for each period
const PERIOD_HOURS: Record<Period, [number, number]> = {
  day: [9, 14],
  evening: [14, 19],
  night: [19, 23],
};

function getActivePeriodsFromRange(startHour: number, endHour: number): Period[] {
  const periods: Period[] = [];
  if (startHour < 14 && endHour > 9) periods.push("day");
  if (startHour < 19 && endHour > 14) periods.push("evening");
  if (startHour < 23 && endHour > 19) periods.push("night");
  return periods;
}

function formatHour(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:00 ${period}`;
}

function avgWait(range: [number, number], crowdMod: number = 0): number {
  const base = Math.round((range[0] + range[1]) / 2);
  return Math.max(0, base + crowdMod);
}

interface OptimizedRide {
  id: string;
  name: string;
  parkArea: string;
  period: Period;
  estimatedWait: number;
  onRideTime: number;
  locked: boolean;
}

export default function DayOptimizer() {
  const [selectedPark, setSelectedPark] = useState("Magic Kingdom");
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(21);
  const [lockedRides, setLockedRides] = useState<Record<string, Period>>({});
  const [crowdLevel, setCrowdLevel] = useState<"Light" | "Moderate" | "Heavy">("Moderate");
  const [optimizedPlan, setOptimizedPlan] = useState<OptimizedRide[] | null>(null);

  const crowdModifier = crowdLevel === "Light" ? -15 : crowdLevel === "Heavy" ? 15 : 0;

  const activePeriods = useMemo(
    () => getActivePeriodsFromRange(startHour, endHour),
    [startHour, endHour]
  );

  const park = PARKS[selectedPark];

  // Available minutes per active period (clamped to user's range)
  const periodMinutes = useMemo(() => {
    const mins: Partial<Record<Period, number>> = {};
    for (const p of activePeriods) {
      const [pStart, pEnd] = PERIOD_HOURS[p];
      const effectiveStart = Math.max(startHour, pStart);
      const effectiveEnd = Math.min(endHour, pEnd);
      mins[p] = (effectiveEnd - effectiveStart) * 60;
    }
    return mins;
  }, [activePeriods, startHour, endHour]);

  const lockedCount = Object.keys(lockedRides).length;

  const toggleLock = useCallback(
    (rideId: string, period: Period) => {
      setLockedRides((prev) => {
        if (prev[rideId]) {
          const next = { ...prev };
          delete next[rideId];
          return next;
        }
        if (Object.keys(prev).length >= 3) return prev;
        return { ...prev, [rideId]: period };
      });
      setOptimizedPlan(null);
    },
    []
  );

  const runOptimizer = useCallback(() => {
    const rides = park.rides;
    const plan: OptimizedRide[] = [];

    // Track time budget per period
    const budgets: Partial<Record<Period, number>> = { ...periodMinutes };

    // 1. Add locked rides first
    for (const [rideId, period] of Object.entries(lockedRides)) {
      const ride = rides.find((r) => r.id === rideId);
      if (!ride) continue;
      const waitKey = PERIOD_TO_WAIT_KEY[period];
      const wait = avgWait(ride.waitTimes[waitKey], crowdModifier);
      const totalTime = wait + ride.onRideTime + 5; // 5 min walking
      budgets[period] = (budgets[period] || 0) - totalTime;
      plan.push({
        id: ride.id,
        name: ride.name,
        parkArea: ride.parkArea,
        period,
        estimatedWait: wait,
        onRideTime: ride.onRideTime,
        locked: true,
      });
    }

    // 2. Greedily fill remaining time — pick rides with lowest wait
    const usedIds = new Set(Object.keys(lockedRides));

    for (const period of activePeriods) {
      const waitKey = PERIOD_TO_WAIT_KEY[period];
      let remaining = budgets[period] || 0;

      // Sort available rides by avg wait ascending
      const candidates = rides
        .filter((r) => !usedIds.has(r.id))
        .map((r) => ({
          ...r,
          avgWait: avgWait(r.waitTimes[waitKey], crowdModifier),
          totalTime: avgWait(r.waitTimes[waitKey], crowdModifier) + r.onRideTime + 5,
        }))
        .sort((a, b) => a.avgWait - b.avgWait);

      for (const ride of candidates) {
        if (remaining < ride.totalTime) continue;
        remaining -= ride.totalTime;
        usedIds.add(ride.id);
        plan.push({
          id: ride.id,
          name: ride.name,
          parkArea: ride.parkArea,
          period,
          estimatedWait: ride.avgWait,
          onRideTime: ride.onRideTime,
          locked: false,
        });
      }
    }

    setOptimizedPlan(plan);
  }, [park, lockedRides, activePeriods, periodMinutes, crowdModifier]);

  // Group optimized plan by period
  const groupedPlan = useMemo(() => {
    if (!optimizedPlan) return null;
    const grouped: Record<Period, OptimizedRide[]> = { day: [], evening: [], night: [] };
    for (const ride of optimizedPlan) {
      grouped[ride.period].push(ride);
    }
    return grouped;
  }, [optimizedPlan]);

  const totalWait = optimizedPlan?.reduce((s, r) => s + r.estimatedWait, 0) ?? 0;
  const totalRides = optimizedPlan?.length ?? 0;

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-5xl md:text-6xl text-foreground mb-2">Day Optimizer</h1>
      <p className="font-body text-muted-foreground mb-8">
        Lock up to 3 must-do rides, and we'll fill the rest of your day to minimize wait times.
      </p>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Column — Settings */}
        <div className="flex-1 space-y-6">
          {/* Park Selection */}
          <div>
            <h2 className="text-3xl text-foreground mb-3">Select Your Park</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {PARK_OPTIONS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => {
                    setSelectedPark(p.name);
                    setLockedRides({});
                    setOptimizedPlan(null);
                  }}
                  className={`text-center p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    selectedPark === p.name
                      ? "border-secondary bg-secondary/10 shadow-lg"
                      : "border-border bg-card hover:border-secondary/50"
                  }`}
                >
                  <div className="text-3xl mb-1">{p.icon}</div>
                  <div className="font-display text-base text-foreground">{p.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Time Range */}
          <div className="bg-card rounded-lg p-5 border border-border">
            <h3 className="text-2xl font-display text-foreground mb-4">Time Range</h3>
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-body font-semibold text-foreground">
                  Start: {formatHour(startHour)}
                </span>
                <input
                  type="range"
                  min={7}
                  max={endHour - 1}
                  value={startHour}
                  onChange={(e) => {
                    setStartHour(Number(e.target.value));
                    setOptimizedPlan(null);
                  }}
                  className="w-full mt-1 accent-secondary"
                />
              </label>
              <label className="block">
                <span className="text-sm font-body font-semibold text-foreground">
                  End: {formatHour(endHour)}
                </span>
                <input
                  type="range"
                  min={startHour + 1}
                  max={23}
                  value={endHour}
                  onChange={(e) => {
                    setEndHour(Number(e.target.value));
                    setOptimizedPlan(null);
                  }}
                  className="w-full mt-1 accent-secondary"
                />
              </label>
            </div>
            <div className="flex gap-2 mt-4 flex-wrap">
              {activePeriods.map((p) => (
                <span
                  key={p}
                  className="bg-secondary/15 text-secondary font-display text-sm px-3 py-1 rounded-full"
                >
                  {PERIOD_ICONS[p]} {PERIOD_LABELS[p]}
                </span>
              ))}
            </div>
          </div>

          {/* Crowd Level */}
          <div className="bg-card rounded-lg p-5 border border-border">
            <h3 className="text-2xl font-display text-foreground mb-3">Crowd Level</h3>
            <div className="flex gap-2">
              {(["Light", "Moderate", "Heavy"] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => {
                    setCrowdLevel(level);
                    setOptimizedPlan(null);
                  }}
                  className={`flex-1 py-2 rounded-md text-sm font-body font-semibold transition ${
                    crowdLevel === level
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {level === "Light" ? "🌤️" : level === "Moderate" ? "☁️" : "🌧️"} {level}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground font-body mt-2">
              {crowdLevel === "Light" ? "Shorter waits (−15 min avg)" : crowdLevel === "Heavy" ? "Longer waits (+15 min avg)" : "Average wait times"}
            </p>
          </div>
          {/* Lock Rides */}
          <div>
            <h2 className="text-3xl text-foreground mb-1">Lock Must-Do Rides</h2>
            <p className="text-sm text-muted-foreground font-body mb-3">
              Select up to 3 rides and assign them to a time period. ({lockedCount}/3 locked)
            </p>
            <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-2">
              {park.rides
                .slice()
                .sort((a, b) => a.parkArea.localeCompare(b.parkArea))
                .map((ride) => {
                  const isLocked = !!lockedRides[ride.id];
                  const lockedPeriod = lockedRides[ride.id];
                  return (
                    <div
                      key={ride.id}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border transition font-body text-sm ${
                        isLocked
                          ? "border-secondary bg-secondary/10 shadow-sm"
                          : "border-border bg-card hover:border-secondary/40"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-muted-foreground text-xs">{ride.parkArea}</span>
                        <div className={`font-semibold truncate ${isLocked ? "text-secondary" : "text-foreground"}`}>
                          {isLocked && "🔒 "}{ride.name}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {activePeriods.map((period) => (
                          <button
                            key={period}
                            onClick={() => toggleLock(ride.id, period)}
                            disabled={!isLocked && lockedCount >= 3}
                            className={`text-xs px-2.5 py-1 rounded-md font-display transition ${
                              isLocked && lockedPeriod === period
                                ? "bg-secondary text-secondary-foreground"
                                : !isLocked && lockedCount >= 3
                                ? "bg-muted text-muted-foreground/40 cursor-not-allowed"
                                : "bg-muted text-muted-foreground hover:bg-secondary/20 hover:text-secondary"
                            }`}
                          >
                            {PERIOD_ICONS[period]}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Right Column — Optimize Button & Results */}
        <div className="w-full lg:w-96 space-y-5">
          <button
            onClick={runOptimizer}
            className="w-full bg-secondary text-secondary-foreground font-display text-2xl py-4 rounded-lg hover:opacity-90 transition shadow-lg"
          >
            ⚡ Optimize My Day
          </button>

          {optimizedPlan && groupedPlan && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-card rounded-lg p-4 border border-border text-center">
                  <div className="text-muted-foreground text-xs font-body">Total Rides</div>
                  <div className="text-3xl font-display text-secondary">{totalRides}</div>
                </div>
                <div className="bg-card rounded-lg p-4 border border-border text-center">
                  <div className="text-muted-foreground text-xs font-body">Est. Wait</div>
                  <div className="text-3xl font-display text-secondary">{totalWait} min</div>
                </div>
              </div>

              {/* Plan by Period */}
              {activePeriods.map((period) => {
                const rides = groupedPlan[period];
                if (rides.length === 0) return null;
                return (
                  <div key={period} className="bg-card rounded-lg border border-border overflow-hidden">
                    <div className="bg-primary/10 px-4 py-2 border-b border-border">
                      <h3 className="font-display text-xl text-foreground">
                        {PERIOD_ICONS[period]} {PERIOD_LABELS[period]}
                      </h3>
                    </div>
                    <div className="divide-y divide-border">
                      {rides.map((ride) => (
                        <div
                          key={ride.id}
                          className={`px-4 py-2.5 flex items-center gap-2 text-sm font-body ${
                            ride.locked ? "bg-secondary/5" : ""
                          }`}
                        >
                          <span className="text-base">{ride.locked ? "🔒" : "✅"}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-foreground truncate">{ride.name}</div>
                            <div className="text-xs text-muted-foreground">{ride.parkArea}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-muted-foreground">{ride.estimatedWait}m wait</div>
                            <div className="text-xs text-muted-foreground">{ride.onRideTime}m ride</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {!optimizedPlan && (
            <div className="bg-card rounded-lg p-6 border border-border text-center">
              <div className="text-4xl mb-3">🎢</div>
              <p className="text-muted-foreground font-body text-sm">
                Select your park, set your time range, lock any must-do rides, then hit optimize!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
