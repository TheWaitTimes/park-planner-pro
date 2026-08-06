# Day Simulator & Day Optimizer — Logic Review and Fixes

Findings from reading `src/pages/DaySimulator.tsx`, `src/simulation/simulationReducer.ts`, `src/pages/DayOptimizer.tsx`, and `src/data/parks.ts`. Ordered by severity.

## Day Simulator — issues confirmed in code

1. **Park hopping can't end your day.** `PARK_HOP` in the reducer advances the clock by travel time but never checks `endTime`, unlike `COMPLETE_RIDE` and `TAKE_BREAK`. Hopping at 8:45 PM with a 9 PM close leaves the day "active" past closing.
2. **Nothing stops you riding past park close.** The confirm modal warns about an overshoot, but confirming is allowed and the day just ends mid-ride. Rides that cannot finish before close should be visibly flagged as "won't finish" in the list, not only in the modal.
3. **"Start New Day" reloads the whole page** (`window.location.reload()`), which throws the user back to the Home tab and clears everything else. Should be a `RESET_SIMULATION` action in the reducer that returns to the setup screen inside the tab.
4. **Weather can only ever happen once per day.** When weather clears, the reducer nulls out `weatherStartTime`/`weatherClearTime`, so a 100% weather risk day still produces at most one storm. Should support repeat events, and `weatherEventCount` should match what's shown.
5. **Wait times are re-rolled on every clock change,** including for rides you're just browsing. Two rides done back-to-back can show a lower afternoon wait than a morning one purely from re-rolling. Waits should be re-rolled per time-of-day block (and on weather change), not on every minute change.
6. **Rain closures ignore ride type.** Every `weatherEffect: 1` ride closes 100% of the time during a storm. Should apply a closure probability (as the Optimizer already does) so covered/partially-affected rides differ.
7. **Park hop revisits pile up in "Parks Visited".** Hopping MK → EPCOT → MK renders "Magic Kingdom → EPCOT → Magic Kingdom" which is correct chronologically, but the summary stat "Park Hops" and the PDF cover both read confusingly. Show a distinct-park count alongside the hop sequence.
8. **Breaks/explore/shop are stored as fake rides** with `rideId: "rest" | "explore" | "shop"`, and eight separate places re-derive "is this an action?" with a literal triple comparison. One `kind: "ride" | "action"` field on the log entry removes the duplication and the risk of a missed check.
9. **The recommendation ignores time remaining.** The starred "recommended" ride can be a 21-minute Carousel of Progress with 10 minutes left in the day. Recommendation should exclude rides that can't finish before close.
10. **Parks' real operating hours are ignored.** Start/end sliders allow 7 AM–11 PM for Animal Kingdom, which closes far earlier. Optional improvement: clamp defaults to the live park hours already fetched on the Home page.

## Day Optimizer — issues confirmed in code

1. **Slot wait multipliers are double-counted.** `baseWait()` already pulls the slot-specific range from `parks.ts` (afternoon ranges are already higher), then `computeExpectedWait()` multiplies again by `SLOT_WAIT_MULTIPLIER` (afternoon 1.2, morning 0.7). Afternoon waits are inflated and morning waits deflated twice over. The multiplier should be removed, or the data ranges collapsed to a single baseline.
2. **Multipliers compound without a cap.** December (1.30) × Heavy (1.35) = 1.75×, pushing Rise of the Resistance to ~150+ minutes. Needs a realistic ceiling per ride.
3. **The Afternoon Park Hop double-books the afternoon.** Afternoon slot rides and hop slot rides both occupy roughly 1 PM–6 PM, and the 25–45 min inter-park travel time is never added to the time budget. Hop should consume part of the afternoon and charge travel time.
4. **No per-slot capacity check.** You can stack 12 rides into Morning and the report shows no problem — only the whole-day `hours` ratio matters. Each slot should compare its planned minutes against that slot's real length and flag overflow.
5. **Weather is counted twice, in opposite directions.** `totalRideTime` *discounts* rides by shutdown chance (making the day look easier) while `weatherBump` *adds* up to +3 difficulty for the same rides. The two partly cancel. Pick one model: treat weather as a risk callout, not a change to committed time.
6. **`hopPark` can go stale and invalid.** Selecting a primary park that equals the current hop park filters that option out of the hop dropdown but leaves the value set, producing an empty-looking select while the hop plan still references it. The hop park should auto-move to another park.
7. **No walking time between rides.** A flat `+5` min per ride is used regardless of whether you cross from Tomorrowland to Adventureland. Use the same area-based walk estimate the Simulator has.
8. **Ride order within a slot is meaningless,** so rope-drop (first ride of the day is dramatically shorter) isn't modeled. Adding a first-slot-first-ride discount makes plan ordering matter.
9. **A plan that cannot fit is never called out.** Difficulty saturates at 10/10; there's no explicit "this plan needs 13.5h but you have 10h" message.

## Suggested implementation scope

I'd fix in this order, all in frontend/logic files:

- **Round 1 (correctness bugs):** Simulator items 1–4; Optimizer items 1, 3, 6, plus the fit warning (9).
- **Round 2 (model quality):** Simulator 5, 6, 9; Optimizer 2, 4, 5, 7.
- **Round 3 (cleanup/UX):** Simulator 7, 8; Optimizer 8; optional live-hours clamp (Simulator 10).

Files touched: `src/simulation/simulationReducer.ts` (new `RESET_SIMULATION`, end-of-day check on hop, repeatable weather, `kind` field), `src/pages/DaySimulator.tsx`, `src/pages/DayOptimizer.tsx`, and a small shared helper for walking-time/wait-model constants so both tools use one source of truth.
