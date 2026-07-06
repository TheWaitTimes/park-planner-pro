# Day Simulator — Logic Fixes

Targeted fixes to the flaws found in `src/pages/DaySimulator.tsx` and `src/simulation/simulationReducer.ts`. Purely simulator scope — Optimizer and Rankings untouched.

## 1. Validate start/end times
- Enforce `endHour > startHour` in the setup UI.
- Disable **Enter Park** and show a small inline warning when the window is invalid.
- Guard the weather-timing math so a zero/negative window can never produce NaN.

## 2. Realistic park-hop travel times + no park collapsing
- Replace the flat `travelTime: 30` with a small pair lookup table (rough Disney transit estimates):
  - MK ↔ EPCOT: 25, MK ↔ HS: 35, MK ↔ AK: 45
  - EPCOT ↔ HS: 15 (Skyliner), EPCOT ↔ AK: 30, HS ↔ AK: 25
- Fix timeline grouping so a re-visited park renders as a **new section** in chronological order (group by park-visit index, not by park name). The PDF export uses the same grouping.

## 3. Smarter walking time
- Add a `walkingTime` calculation based on whether the next ride is in the same `parkArea` as the previous activity:
  - Same area: 3 min
  - Different area within same park: 7 min
- Apply the same rule after breaks (you still walk to the next ride).

## 4. Better recommended ride
Replace the "closest to floor" heuristic with a composite score that favors:
- Lower absolute wait time (primary).
- Shorter walk from current area (small bonus if `parkArea` matches the last activity).
- Not already ridden today (large penalty if repeated).

Ties broken by longer on-ride time (better value).

## 5. Track and surface already-ridden attractions
- Compute a `ridesRiddenCount` map from `state.completedRides`.
- In the ride list, show a subtle `Ridden ×N` tag on repeats and de-emphasize them.
- Recommendation logic uses this map (see #4).

## 6. Show weather-closed rides as unavailable
- Stop filtering weather-affected rides out of `ridesWithWaits`.
- Instead render them disabled with a "Closed — reopens ~{clearTime}" label so users see the full park inventory.

## 7. Sensible crowd-adjusted wait floor
- Change `Math.max(0, min + crowdModifier)` to `Math.max(5, min + crowdModifier)` so Light crowds don't produce implausible 0-minute waits on major attractions.

## 8. End-of-day overshoot warning
- When `currentTime + waitTime + onRideTime > endTime`, show a warning in the ride confirmation modal ("This ride will finish after park close") but still allow it.

## Technical notes

- **Files touched:**
  - `src/pages/DaySimulator.tsx` — UI validation, walking calc, recommendation, ridden tracking, weather-closed rendering, overshoot warning, park-hop table, grouping-by-visit.
  - `src/simulation/simulationReducer.ts` — `PARK_HOP` accepts computed `travelTime`; add a `visitIndex` field to `CompletedRide` (or derive it from `currentParkIndex`) so the timeline can group by visit.
- **No data-model changes** in `src/data/parks.ts`.
- **No Rankings / Optimizer changes.**

## Out of scope (flagged, not fixed here)
- Weather re-rolling multiple storms per day.
- Modeling ride throughput / capacity beyond `onRideTime`.
- Persisting simulation results to the backend.
