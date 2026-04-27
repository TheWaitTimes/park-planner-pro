import { useReducer, useState, useEffect, useMemo } from "react";
import {
  Castle, Globe, Clapperboard, Trees, CloudRain, Star, type LucideIcon,
} from "lucide-react";
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

export default function DaySimulator() {
  const [state, dispatch] = useReducer(simulationReducer, initialSimulationState);
  const [startPark, setStartPark] = useState("Magic Kingdom");
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(21);
  const [crowdLevel, setCrowdLevel] = useState("Moderate");
  const [weatherChance, setWeatherChance] = useState(0);
  const [restMinutes, setRestMinutes] = useState(30);

  const crowdModifier = crowdLevel === "Light" ? -20 : crowdLevel === "Heavy" ? 20 : 0;
  const currentParkName = state.selectedParks[state.currentParkIndex];
  const currentPark = PARKS[currentParkName];
  const totalWait = state.completedRides.reduce((sum, r) => sum + r.waitTime, 0);

  const ridesWithWaits = useMemo(() => {
    if (!currentPark || !state.currentTime) return [];
    const timeOfDay = getTimeOfDay(state.currentTime);
    return currentPark.rides
      .filter((ride) => !(state.weatherActive && ride.weatherEffect === 1))
      .map((ride) => {
        let [min, max] = ride.waitTimes[timeOfDay];
        min = Math.max(0, min + crowdModifier);
        max = Math.max(min, max + crowdModifier);
        const waitTime = randomWait(min, max);
        return { ...ride, waitTime, min };
      });
  }, [state.currentTime, state.weatherActive, currentParkName, crowdModifier]);

  const recommendedRide = ridesWithWaits.reduce<{ ride: typeof ridesWithWaits[0]; diff: number } | null>((best, ride) => {
    const diff = ride.waitTime - ride.min;
    if (!best || diff < best.diff) return { ride, diff };
    return best;
  }, null)?.ride;

  useEffect(() => {
    if (state.status === "active") {
      dispatch({ type: "CHECK_WEATHER" });
    }
  }, [state.currentTime, state.status]);

  const handleStartSimulation = () => {
    let weatherStartTime: Date | null = null;
    let weatherClearTime: Date | null = null;
    if (Math.random() * 100 < weatherChance) {
      const randomMinute = Math.floor(Math.random() * ((endHour - startHour) * 60));
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

  // Group rides by park
  const grouped: Record<string, typeof state.completedRides> = {};
  state.completedRides.forEach((ride) => {
    if (!grouped[ride.park]) grouped[ride.park] = [];
    grouped[ride.park].push(ride);
  });

  // ENDED STATE
  if (state.status === "ended") {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl text-foreground mb-6">Day Summary</h1>
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
        {Object.entries(grouped).map(([park, rides]) => (
          <div key={park} className="mb-6">
            <h3 className="text-2xl text-secondary mb-2">{park}</h3>
            <div className="space-y-1">
              {rides.map((ride, i) => (
                <div key={i} className="flex items-center gap-2 text-sm font-body bg-card rounded px-3 py-2 border border-border">
                  <span className="text-muted-foreground w-32 shrink-0">
                    {formatTime(ride.timeStarted)} – {formatTime(ride.timeFinished)}
                  </span>
                  <span className="font-semibold text-foreground">{ride.rideName}</span>
                  <span className="text-muted-foreground ml-auto">({ride.waitTime} min wait)</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <button
          className="mt-6 bg-secondary text-secondary-foreground font-display text-xl px-8 py-3 rounded-lg hover:opacity-90 transition"
          onClick={() => window.location.reload()}
        >
          Start New Day
        </button>
      </div>
    );
  }

  // SETUP STATE
  if (state.status === "setup") {
    return (
      <div className="max-w-5xl mx-auto">
        <h1 className="text-5xl md:text-6xl text-foreground mb-8">Disney Day Simulator</h1>
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Park Selection */}
          <div className="flex-1">
            <h2 className="text-3xl text-foreground mb-4">Select Your Park</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {PARK_OPTIONS.map((park) => (
                <button
                  key={park.name}
                  onClick={() => setStartPark(park.name)}
                  className={`text-center p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    startPark === park.name
                      ? "border-secondary bg-secondary/10 shadow-lg"
                      : "border-border bg-card hover:border-secondary/50"
                  }`}
                >
                  <div className="text-4xl mb-2">{park.icon}</div>
                  <div className="font-display text-lg text-foreground">{park.name}</div>
                </button>
              ))}
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
        <h1 className="text-4xl text-foreground">{currentParkName}</h1>
        <span className="bg-secondary/20 text-secondary font-display text-xl px-4 py-1 rounded-full">
          {formatTime(state.currentTime)}
        </span>
      </div>

      {/* Weather Alert */}
      {state.weatherActive && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg p-4 mb-6">
          <div className="font-display text-xl">⚠️ Bad Weather until: {formatTime(state.weatherClearTime)}</div>
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
                    dispatch({
                      type: "COMPLETE_RIDE",
                      payload: {
                        rideId: ride.id,
                        rideName: ride.name,
                        waitTime: ride.waitTime,
                        onRideTime: ride.onRideTime,
                        walkingTime: 5,
                      },
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
                  <span className="float-right text-muted-foreground">
                    {ride.waitTime}m wait · {ride.onRideTime}m ride
                    {ride.id === recommendedRide?.id && " ⭐"}
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
                  onClick={() => dispatch({ type: "PARK_HOP", payload: { travelTime: 30, targetPark: park } })}
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
            <h3 className="font-display text-xl text-foreground mb-2">Take a Break</h3>
            <div className="flex items-center gap-2 mb-3">
              <input type="range" min="30" max="240" step="30" value={restMinutes}
                onChange={(e) => setRestMinutes(Number(e.target.value))}
                className="flex-1 accent-secondary" />
              <span className="text-sm font-body text-muted-foreground w-16 text-right">{restMinutes} min</span>
            </div>
            <button
              onClick={() =>
                dispatch({
                  type: "COMPLETE_RIDE",
                  payload: { rideId: "rest", rideName: "Rest Break", waitTime: 0, onRideTime: restMinutes, walkingTime: 0 },
                })
              }
              className="w-full bg-muted text-muted-foreground font-display text-lg py-2 rounded-lg hover:bg-muted/80 transition"
            >
              Rest
            </button>
          </div>

          {/* Ride History */}
          <div className="bg-card rounded-lg p-4 border border-border">
            <h3 className="font-display text-xl text-foreground mb-2">Ride History</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto text-sm font-body">
              {Object.entries(grouped).map(([park, rides]) => (
                <div key={park}>
                  <div className="font-semibold text-secondary mb-1">{park}</div>
                  {rides.map((ride, i) => (
                    <div key={i} className="text-muted-foreground ml-2">
                      {formatTime(ride.timeStarted)} – {ride.rideName} ({ride.waitTime}m)
                    </div>
                  ))}
                </div>
              ))}
              {state.completedRides.length === 0 && (
                <div className="text-muted-foreground italic">No rides yet</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
